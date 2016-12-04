var http = require('http')
var WebSocketServer = require('ws').Server
var express = require('express')
var minimist = require('minimist')
var fs = require('fs')
var config = require('../config')
var World = require('../world')
var Client = require('./client')
var gen = require('../gen')
var monitor = require('./monitor')
var api = require('./api')

var state = {
  clients: [],
  world: new World(),
  tick: 0,
  perf: {
    lastTickTime: new Date().getTime(),
    tps: 0
  },
  config: null
}

main()

function main () {
  var args = minimist(process.argv.slice(2))
  if (args.config) state.config = JSON.parse(fs.readFileSync(args.config, 'utf8'))

  // Serve the voxelwave API
  api.init(state)
  var httpServer = http.createServer()
  var wsServer = new WebSocketServer({server: httpServer})

  wsServer.on('connection', function (ws) {
    // TODO: auth
    var client = new Client(ws)
    api.addClient(client)
  })

  // Serve the client files
  var app = express()
  app.use(express.static('build'))
  app.use('/monitor', monitor.init(state))
  httpServer.on('request', app)

  httpServer.listen(config.SERVER.PORT, function () {
    console.log('Listening on ' + JSON.stringify(httpServer.address()))
  })

  tick()
}

// Update the world, handle client commands, send client updates
function tick () {
  // Track performance
  var now = new Date().getTime()
  var dt = (now - state.perf.lastTickTime) / 1000
  state.perf.tps = 0.99 * state.perf.tps + 0.01 / dt // Exponential moving average
  state.perf.lastTickTime = now

  // Generate new areas of the world on demand, as players explore them
  // if (state.tick % 10 === 0) gen.generateWorld(state)
  gen.generateWorld(state)

  // Talk to clients
  api.tick()

  // Run up to 10 ticks per second, depending on server load
  setTimeout(tick, 1000) // DBG one tick per second to debug client side prediction
  state.tick++
}
