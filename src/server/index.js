var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var config = require('../config')
var World = require('../world')
var Client = require('./client')
var gen = require('../gen')
var FlexBuffer = require('../protocol/flex-buffer')
var ChunkIO = require('../protocol/chunk-io')
var monitor = require('./monitor')
var api = require('./api')

var CB = config.CHUNK_BITS

var httpServer = http.createServer()
var wsServer = new WebSocketServer({server: httpServer})

var state = {
  clients: [],
  world: new World(),
  tick: 0
}

// Generate the world around the origin, then on the fly around players
gen.generateWorldAt(state.world, {x: 0, y: 0, z: 0})
tick()

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

function tick () {
  // Update perf
  state.tick++
  if (state.tick % 10 === 0) gen.generateWorld(state)
  api.tick()
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
app.use('/monitor', monitor.init(state))
httpServer.on('request', app)

httpServer.listen(config.SERVER.PORT, function () {
  console.log('Listening on ' + JSON.stringify(httpServer.address()))
})
