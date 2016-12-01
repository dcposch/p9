var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var config = require('../config')
var World = require('../world')
var Client = require('./client')
var gen = require('../gen')
var FlexBuffer = require('../protocol/flex-buffer')
var ChunkIO = require('../protocol/chunk-io')
var serveMonitor = require('./serve-monitor')

var httpServer = http.createServer()
var wsServer = new WebSocketServer({server: httpServer})

var state = {
  clients: [],
  world: new World()
}

// TODO: generate the world on the fly around players
console.time('world gen')
gen.generateWorldAt(state.world, {x: 0, y: 0, z: 0})
console.timeEnd('world gen')

// Serve the Voxelwave Server API
wsServer.on('connection', function (ws) {
  var client = new Client(ws)
  state.clients.push(client)

  // TODO: move this somewhere
  var buf = new FlexBuffer()
  buf.reset()
  ChunkIO.write(buf, state.world.chunks)
  client.send(buf.slice())
})

// Serve the client files
var app = express()
app.use(express.static('build'))
app.use('/monitor', serveMonitor(state))
httpServer.on('request', app)

httpServer.listen(config.SERVER.PORT, function () {
  console.log('Listening on ' + JSON.stringify(httpServer.address()))
})
