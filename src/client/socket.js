var config = require('../config')

module.exports = function Socket () {
  var ws = new window.WebSocket('ws:/' + window.location.host)
  ws.binaryType = 'arraybuffer'
  this.ws = ws

  ws.onopen = function () {
    console.log('DBG socket open')
    ws.send(JSON.stringify({clientVersion: config.CLIENT.VERSION}))
    ws.send(Uint8Array.from([1, 2, 3, 4]))
  }

  ws.onmessage = function (e) {
    var msg
    if (typeof e.data === 'string') msg = e.data
    else msg = new Uint8Array(e.data)
    console.log('DBG got message: ' + msg)
  }
}
