var config = require('../config')

// Creates a new client handle from a new websocket connection
module.exports = function Client (ws) {
  this.ws = ws
  // See the client index.js for details about player state
  this.player = {
    location: { x: 0, y: 0, z: 20 },
    direction: { azimuth: 0, altitude: 0 },
    dzdt: 0,
    situation: 'airborne',
    lookAtBlock: null
  }

  var self = this
  ws.on('message', function (data, flags) {
    if (flags.binary) handleBinaryMessage(self, data)
    else handleJsonMessage(self, JSON.parse(data))
  })
  ws.send(JSON.stringify({serverVersion: config.SERVER.VERSION}))
  ws.send(Uint8Array.from([1, 2, 3, 4]))
}

function handleBinaryMessage (client, arr) {
  console.log('DBG binary message ' + typeof arr)
}

function handleJsonMessage (client, obj) {
  console.log('DBG JSON message ' + JSON.stringify(obj, null, 2))
}
