var EventEmitter = require('events')
var config = require('../config')

// Creates a new client handle from a new websocket connection
module.exports = Client

function Client (ws) {
  EventEmitter.call(this)

  // A new client just connected, here's the websocket
  this.ws = ws
  // Client version. Unknown at first, will be set during the handshake.
  this.clientVersion = null
  // See the client/index.js for details about player state
  // TODO: avoid code duplication, move this to protocol/
  this.player = {
    name: 'unknown',
    location: { x: 0, y: 0, z: 0 },
    direction: { azimuth: 0, altitude: 0 },
    dzdt: 0,
    situation: 'airborne',
    lookAtBlock: null
  }
  // Keep track of what chunks we've sent to whom. Maps chunkKey to timestamp.
  this.chunksSent = {}
  this.closed = false

  ws.on('message', handleMessage.bind(this))
  ws.on('close', handleClose.bind(this))
  ws.send(JSON.stringify({serverVersion: config.SERVER.VERSION}))
}

Client.prototype = Object.create(EventEmitter.prototype)

Client.prototype.send = function (message) {
  if (this.closed) return console.error('Ignoring message, socket closed')
  if (!(message instanceof Uint8Array)) message = JSON.stringify(message)
  this.ws.send(message)
}

function handleClose () {
  this.closed = true
  this.emit('close')
}

function handleMessage (data, flags) {
  if (flags.binary) handleBinaryMessage(this, data)
  else handleJsonMessage(this, JSON.parse(data))
}

function handleBinaryMessage (client, data) {
  console.error('Ignoring unimplemented binary message, length ' + data.length)
}

function handleJsonMessage (client, obj) {
  switch (obj.type) {
    case 'handshake':
      return handleHandshake(client, obj)
    case 'update':
      return handleUpdate(client, obj)
    default:
      console.error('Ignoring unknown message type ' + obj.type)
  }
}

function handleHandshake (client, obj) {
  client.clientVersion = obj.clientVersion
}

function handleUpdate (client, obj) {
  // TODO: doing this 10x per second per client is not ideal. use binary.
  // TODO: validation
  if (!client.player.name && obj.player.name) console.log('Player %s joined', obj.player.name)
  client.player = obj.player
  client.emit('update', obj)
}
