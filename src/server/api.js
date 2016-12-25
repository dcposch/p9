var config = require('../config')
var FlexBuffer = require('../protocol/flex-buffer')
var ChunkIO = require('../protocol/chunk-io')

module.exports = {
  init: init,
  tick: tick,
  addClient: addClient,
  updateChunks: updateChunks,
  updateObjects: updateObjects
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
  if (state.config.client) client.send({type: 'config', config: state.config.client})
}

function tick () {
  state.clients.forEach(function (client) {
    var loc = client.player.location
    if (loc && loc.z < -100) client.die({message: 'you fell'})
  })
}

// Tell each client about objects around them, including other players
function updateObjects (now) {
  // TODO: this runs in O(numClients ^ 2). Needs a better algorithm.
  var n = state.clients.length
  for (var i = 0; i < n; i++) {
    var client = state.clients[i]
    var a = client.player
    var objsToSend = []

    for (var j = 0; j < n; j++) {
      if (j === i) continue
      var b = state.clients[j].player
      if (!a.location || !b.location) continue
      if (!b.name) continue
      if (!isInRange(a.location, b.location)) continue

      var dir = b.direction
      objsToSend.push({
        type: 'player',
        key: 'player-' + b.name,
        name: b.name,
        location: b.location,
        direction: {azimuth: dir.azimuth, altitude: 0},
        velocity: b.velocity,
        situation: b.situation,
        // TODO: just send the bones?
        props: {altitude: dir.altitude}
      })
    }

    sendObjects(client, objsToSend)
  }
}

// Tell each client about the blocks around them. Send chunks where a voxel has changed.
function updateChunks (now) {
  // Figure out which clients need which chunks.
  // TODO: this runs in O(numClients * numChunks). Needs a better algorithm.
  var chunksToSend = []
  for (var j = 0; j < state.clients.length; j++) {
    chunksToSend.push([])
  }
  var chunks = state.world.chunks
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]
    if (chunk.dirty || !chunk.lastModified) {
      chunk.dirty = false
      chunk.lastModified = now
    }
    var key = chunk.getKey()
    for (j = 0; j < state.clients.length; j++) {
      var client = state.clients[j]
      var cts = chunksToSend[j]
      var loc = client.player.location
      if (!loc) continue
      if (!isInRange(loc, chunk)) continue // client too far away
      if (client.chunksSent[key] >= chunk.lastModified) continue // client up-to-date
      cts.push(chunk)
      client.chunksSent[key] = now
    }
  }

  // Send chunk updates
  for (j = 0; j < state.clients.length; j++) {
    sendChunks(state.clients[j], chunksToSend[j])
  }
}

function isInRange (a, b) {
  var dx = (b.x >> CB) - (a.x >> CB)
  var dy = (b.y >> CB) - (a.y >> CB)
  var dz = (b.z >> CB) - (a.z >> CB)
  var r2 = dx * dx + dy * dy + dz * dz
  var rmax = config.WORLD_GEN.CHUNK_RADIUS
  return r2 < rmax * rmax
}

function sendObjects (client, objects) {
  if (!objects.length) return
  client.send({
    type: 'objects',
    objects: objects
  })
}

function sendChunks (client, chunks) {
  if (!chunks.length) return
  console.log('Sending %d chunks to %s', chunks.length, client.player.name)
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
