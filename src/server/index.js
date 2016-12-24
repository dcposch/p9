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
var persist = require('./persist')

var state = {
  clients: [],
  world: new World(),
  tick: 0,
  perf: {
    lastTickTime: new Date().getTime(),
    tps: 0
  },
  config: {}
}

main()

function main () {
  var args = minimist(process.argv.slice(2))
  if (args.config) state.config = JSON.parse(fs.readFileSync(args.config, 'utf8'))
  if (state.config.saveFile) persist.load(state.config.saveFile, state.world, onLoad)
  else process.nextTick(onLoad)

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
  app.use(express.static('static'))
  app.use('/monitor', monitor.init(state))
  httpServer.on('request', app)

  httpServer.listen(config.SERVER.PORT, function () {
    console.log('Listening on ' + JSON.stringify(httpServer.address()))
  })
}

// World is done loading from file
function onLoad (err) {
  if (err && err.code === 'ENOENT') console.log('No save file yet, will be created...')
  else if (err) console.error(err)

  tick()
}

// Update the world, handle client commands, send client updates
function tick () {
  // Track performance
  var now = new Date()
  var lastTick = new Date(state.perf.lastTickTime)
  var dt = (now.getTime() - state.perf.lastTickTime) / 1000
  state.perf.tps = 0.99 * state.perf.tps + 0.01 / dt // Exponential moving average
  state.perf.lastTickTime = now.getTime()

  // Save the world to a file, every hour on the hour
  var isQuarterHour = (now.getMinutes() !== lastTick.getMinutes()) && (now.getMinutes() % 15 === 0)
  var saveFile = state.config.saveFile
  if (isQuarterHour && saveFile) persist.save(saveFile, state.world)

  // Generate new areas of the world on demand, as players explore them
  if (state.tick % 10 === 0) gen.generateWorld(state)

  // Talk to clients
  // DBG only one chunk update per second to debug client side prediction
  if (state.tick % 10 === 0) api.updateChunks(now.getTime())
  api.updateObjects(now.getTime())

  // Run up to 10 ticks per second, depending on server load
  setTimeout(tick, 100)
  state.tick++
}
