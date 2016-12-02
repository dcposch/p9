var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var config = require('../config')
var World = require('../world')
var Client = require('./client')
var gen = require('../gen')
var FlexBuffer = require('../protocol/flex-buffer')
var ChunkIO = require('../protocol/chunk-io')
var serveMonitor = require('./serve-monitor')

var CB = config.CHUNK_BITS

var httpServer = http.createServer()
var wsServer = new WebSocketServer({server: httpServer})

var state = {
  clients: [],
  world: new World()
}

// Generate the world around the origin, then on the fly around players
console.time('world gen')
gen.generateWorldAt(state.world, {x: 0, y: 0, z: 0})
console.timeEnd('world gen')
setInterval(gen.generateWorld.bind(null, state), 1000)

// Allocate once and re-use
var buf = new FlexBuffer()

// Serve the Voxelwave Server API
wsServer.on('connection', function (ws) {
  // TODO: auth
  var client = new Client(ws)
  state.clients.push(client)
  client.on('update', handleUpdate)
  client.on('close', function () {
    var index = state.clients.indexOf(client)
    console.log('removing client %d: %s', index, client.player.name)
    state.clients.splice(index, 1)
  })
})

setInterval(tick, 100)

function tick () {
  var now = new Date().getTime()
  var chunksToSend = []
  for (var j = 0; j < state.clients.length; j++) {
    chunksToSend.push([])
  }
  for (var i = 0; i < state.world.chunks.length; i++) {
    var chunk = state.world.chunks[i]
    if (chunk.dirty || !chunk.lastModified) {
      chunk.dirty = false
      chunk.lastModified = now
    }
    var key = chunk.getKey()
    for (j = 0; j < state.clients.length; j++) {
      var client = state.clients[j]
      var cts = chunksToSend[j]
      if (!isInRange(client, chunk)) continue // client doesn't need this chunk
      if (client.chunksSent[key] >= chunk.lastModified) continue // client up-to-date
      cts.push(chunk)
      client.chunksSent[key] = now
    }
  }
  for (j = 0; j < state.clients.length; j++) {
    sendChunks(state.clients[j], chunksToSend[j])
  }
}

function isInRange (client, chunk) {
  var loc = client.player.location
  if (!loc) return false
  var dx = (chunk.x >> CB) - (client.x >> CB)
  var dy = (chunk.y >> CB) - (client.y >> CB)
  var dz = (chunk.z >> CB) - (client.z >> CB)
  var r2 = dx * dx + dy * dy + dz * dz
  var rmax = config.WORLD_GEN.CHUNK_RADIUS
  return r2 < rmax * rmax
}

function sendChunks (client, chunks) {
  if (!chunks.length) return
  buf.reset()
  ChunkIO.write(buf, chunks)
  client.send(buf.slice())
}

function handleUpdate (message) {
  message.commands.forEach(function (command) {
    switch (command.type) {
      case 'set':
        return handleSet(command)
      default:
        console.error('ignoring unknown command type ' + command.type)
    }
  })
}

function handleSet (cmd) {
  state.world.setVox(cmd.x, cmd.y, cmd.z, cmd.v)
}

// Serve the client files
var app = express()
app.use(express.static('build'))
app.use('/monitor', serveMonitor(state))
httpServer.on('request', app)

httpServer.listen(config.SERVER.PORT, function () {
  console.log('Listening on ' + JSON.stringify(httpServer.address()))
})
