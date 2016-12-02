var EventEmitter = require('events')
var config = require('../config')

module.exports = Socket

// Maintains a websocket to a server
// Emits four events: open, close, json, and binary
// TODO: reconnects automatically
function Socket () {
  var self = this

  var wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  var ws = new window.WebSocket(wsProto + '/' + window.location.host)
  ws.binaryType = 'arraybuffer'
  this.ws = ws

  ws.onopen = function () {
    self.emit('open')
    ws.send(JSON.stringify({type: 'handshake', clientVersion: config.CLIENT.VERSION}))
  }

  ws.onmessage = function (e) {
    if (typeof e.data === 'string') self.emit('json', JSON.parse(e.data))
    else self.emit('binary', e.data)
  }

  ws.onclose = function (e) {
    self.emit('close')
  }
}

Socket.prototype = Object.create(EventEmitter.prototype)

Socket.prototype.send = function (msg) {
  if (!this.ws) throw new Error('not connected') // TODO: queue? ignore?
  if (msg instanceof Uint8Array) this.ws.send(msg)
  else this.ws.send(JSON.stringify(msg))
}
