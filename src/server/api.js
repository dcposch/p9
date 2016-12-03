module.exports = {
  init: init,
  tick: tick
}

var state = null

function init (s) {
  state = s
}

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
