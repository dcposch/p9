var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var config = require('../config')
var World = require('../world')
var Client = require('./client')

var httpServer = http.createServer()
var wsServer = new WebSocketServer({server: httpServer})

var state = {
  clients: [],
  world: new World()
}

// Serve the Voxelwave Server API
wsServer.on('connection', function (ws) {
  state.clients.push(new Client(ws))
})

// Serve the client files
var app = express()
app.use(express.static('build'))
httpServer.on('request', app)

httpServer.listen(config.SERVER.PORT, function () {
  console.log('Listening on ' + JSON.stringify(httpServer.address()))
})
