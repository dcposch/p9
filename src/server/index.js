var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var config = require('../config')
var World = require('../world')
var Client = require('./client')
var gen = require('../gen')
var Scratch = require('../protocol/scratch')

var httpServer = http.createServer()
var wsServer = new WebSocketServer({server: httpServer})

var state = {
  clients: [],
  world: new World()
}

var scratch = new Scratch()

// TODO: generate the world on the fly around players
console.time('world gen')
gen.generateWorldAt(state.world, {x: 0, y: 0, z: 0})
console.timeEnd('world gen')

// Serve the Voxelwave Server API
wsServer.on('connection', function (ws) {
  var client = new Client(ws)
  state.clients.push(client)

  // TODO: move this somewhere
  var world = state.world

  scratch.reset()
  scratch.writeInt32LE(world.chunks.length)
  world.chunks.forEach(function (chunk) {
    if (!chunk.packed) throw new Error('expected all chunks to be packed list-of-quads')
    scratch.writeInt32LE(chunk.x)
    scratch.writeInt32LE(chunk.y)
    scratch.writeInt32LE(chunk.z)
    scratch.writeInt32LE(chunk.length / 8) // num quads
    if (chunk.length === 0) return
    scratch.writeUint8Array(chunk.data, 0, chunk.length)
  })
  client.send(scratch.slice())
})

// Serve the client files
var app = express()
app.use(express.static('build'))
httpServer.on('request', app)

httpServer.listen(config.SERVER.PORT, function () {
  console.log('Listening on ' + JSON.stringify(httpServer.address()))
})
