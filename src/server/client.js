var EventEmitter = require('events')
var config = require('../config')

// Creates a new client handle from a new websocket connection
module.exports = Client

function Client (ws) {
  // A new client just connected, here's the websocket
  this.ws = ws
  // Client version. Unknown at first, will be set during the handshake.
  this.clientVersion = null
  // See the client/index.js for details about player state
  // TODO: avoid code duplication, move this to protocol/
  this.player = {
    location: { x: 0, y: 0, z: 20 },
    direction: { azimuth: 0, altitude: 0 },
    dzdt: 0,
    situation: 'airborne',
    lookAtBlock: null
  }
  // Keep track of what chunks we've sent to whom. Maps chunkKey to timestamp.
  this.chunksSent = {}

  ws.on('message', handleMessage.bind(this))
  ws.send(JSON.stringify({serverVersion: config.SERVER.VERSION}))
}

Client.prototype = Object.create(EventEmitter.prototype)

Client.prototype.send = function (message) {
  if (!(message instanceof Uint8Array)) message = JSON.stringify(message)
  this.ws.send(message)
}

function handleMessage (data, flags) {
  if (flags.binary) handleBinaryMessage(this, data)
  else handleJsonMessage(this, JSON.parse(data))
}

function handleBinaryMessage (client, data) {
  console.log('DBG UNIMPLEMENTED binary message ' + data.length)
}

function handleJsonMessage (client, obj) {
  switch (obj.type) {
    case 'handshake':
      return handleHandshake(client, obj)
    case 'player':
      return handlePlayer(client, obj)
    default:
      console.error('ignoring unknown message type ' + obj)
  }
}

function handleHandshake (client, obj) {
  client.clientVersion = obj.clientVersion
}

function handlePlayer (client, obj) {
  // TODO: doing this 10x per second per client is not ideal. use binary.
  // TODO: validation
  this.player = obj.player
}
