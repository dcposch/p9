var EventEmitter = require('events')
var config = require('../config')

// Creates a new client handle from a new websocket connection
module.exports = Client

function Client (ws) {
  this.clientVersion = null
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
}

Client.prototype = Object.create(EventEmitter.prototype)

Client.prototype.send = function (message) {
  if (!(message instanceof Uint8Array)) message = JSON.stringify(message)
  console.log('DBG sending, len ' + message.length)
  this.ws.send(message.length)
}

function handleBinaryMessage (client, data) {
  console.log('DBG binary message ' + data.length + ': ' + new Uint8Array(data))
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
