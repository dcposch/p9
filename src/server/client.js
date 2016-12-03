var EventEmitter = require('events')

// Creates a new client handle from a new websocket connection
module.exports = Client

function Client (ws) {
  EventEmitter.call(this)

  // A new client just connected, here's the websocket
  this.ws = ws
  this.closed = false
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
  // Track performance and bandwidth
  this.perf = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0
  }

  ws.on('message', handleMessage.bind(this))
  ws.on('close', handleClose.bind(this))
}

Client.prototype = Object.create(EventEmitter.prototype)

Client.prototype.send = function (message) {
  if (this.closed) return console.error('Ignoring message, socket closed')
  if (!(message instanceof Uint8Array)) message = JSON.stringify(message)
  this.perf.messagesSent++
  this.perf.bytesSent += message.length
  this.ws.send(message)
}

function handleClose () {
  this.closed = true
  this.emit('close')
}

function handleMessage (data, flags) {
  this.perf.messagesReceived++
  this.perf.bytesReceived += data.length // Approximate. Doesn't count overhead or non-ASCII chars
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
  Object.assign(client.player, obj.player)
  client.emit('update', obj)
}
