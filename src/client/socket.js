var EventEmitter = require('events')
var config = require('../config')

module.exports = Socket

// Maintains a websocket to a server
// Emits four events: open, close, json, and binary
function Socket () {
  var self = this

  this.clientVersion = config.CLIENT.VERSION
  this.serverVersion = null

  var wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  var ws = new window.WebSocket(wsProto + '/' + window.location.host)
  ws.binaryType = 'arraybuffer'
  this.ws = ws

  ws.onopen = function () {
    self.emit('open')
    self.send({type: 'handshake', clientVersion: self.clientVersion})
  }

  ws.onmessage = function (e) {
    if (typeof e.data === 'string') handleJsonMessage(self, JSON.parse(e.data))
    else self.emit('binary', e.data)
  }

  ws.onclose = function (e) {
    self.emit('close')
  }
}

Socket.prototype = Object.create(EventEmitter.prototype)

Socket.prototype.isReady = function () {
  return this.ws && this.ws.readyState === this.ws.OPEN
}

Socket.prototype.send = function (msg) {
  if (!this.ws) throw new Error('not connected')
  if (this.ws.readyState !== this.ws.OPEN) throw new Error('websocket state: ' + this.ws.readyState)
  if (msg instanceof Uint8Array) this.ws.send(msg)
  else this.ws.send(JSON.stringify(msg))
}

function handleJsonMessage (socket, msg) {
  if (msg.type === 'handshake') this.serverVersion = msg.serverVersion
  else socket.emit('json', msg)
}
