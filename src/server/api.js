var config = require('../config')
var FlexBuffer = require('../protocol/flex-buffer')
var ChunkIO = require('../protocol/chunk-io')

module.exports = {
  init: init,
  addClient: addClient,
  tick: tick
}

var CB = config.CHUNK_BITS

// Allocate once and re-use
var buf = new FlexBuffer()
var state = null

function init (s) {
  state = s
}

function addClient (client) {
  state.clients.push(client)
  client.on('update', handleUpdate)
  client.on('close', function () {
    var index = state.clients.indexOf(client)
    console.log('Removing client %d: %s', index, client.player.name)
    state.clients.splice(index, 1)
  })

  client.send({type: 'handshake', serverVersion: config.SERVER.VERSION})
  if (state.config) client.send({type: 'config', config: state.config})
}

// Talk to clients. Add
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
        console.error('Ignoring unknown command type ' + command.type)
    }
  })
}

function handleSet (cmd) {
  state.world.setVox(cmd.x, cmd.y, cmd.z, cmd.v)
}
