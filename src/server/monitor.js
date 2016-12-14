var express = require('express')
var util = require('util')
var os = require('os')

module.exports = {init: init}

// Singleton
var self = null

// Initializes the server resource monitor
// Returns an Express route that serves status and stats
function init (state) {
  if (!state) throw new Error('state required')
  if (self) throw new Error('monitor.init() may only be called once')

  self = {
    state: state,
    time: null,
    lastTime: null,
    cpuUsage: null,
    lastCpuUsage: null,
    cpus: os.cpus()
  }

  update()

  var router = express.Router()
  router.get('/', handleGetIndex)
  return router
}

// Runs every minute, on the minute
function update () {
  var now = new Date()
  var sleepMillis = 60000 - now.getSeconds() * 1000 - now.getMilliseconds()
  setTimeout(update, sleepMillis)

  self.lastTime = self.time
  self.time = now.getTime()
  self.lastCpuUsage = self.cpuUsage
  self.cpuUsage = process.cpuUsage()
}

// Shows an overview of how the server is doing
function handleGetIndex (req, res) {
  var lines = ['# VOXELWAVE SERVER STATUS', '']

  if (self.time) {
    lines.push('' + new Date(self.time))
    lines.push('')
  }

  if (self.lastTime) {
    var dt = (self.time - self.lastTime) * 1000 // in microseconds
    var cpuUser = self.cpuUsage.user - self.lastCpuUsage.user
    var cpuSys = self.cpuUsage.system - self.lastCpuUsage.system
    lines.push(util.format('CPU app %s sys %s cores %d',
      percent(cpuUser / dt), percent(cpuSys / dt), self.cpus.length))
  }

  var memTotal = os.totalmem()
  var memUsed = memTotal - os.freemem()
  var mem = process.memoryUsage()
  lines.push(util.format('App heap %s / %s rss %s, system %s / %s',
    mb(mem.heapUsed), mb(mem.heapTotal), mb(mem.rss), mb(memUsed), mb(memTotal)))

  var chunks = self.state.world.chunks
  var chunkTotal = 0
  for (var i = 0; i < chunks; i++) chunkTotal += chunks[i].length
  lines.push('Chunks ' + chunks.length + ' total ' + mb(chunkTotal))

  lines.push('TPS ' + self.state.perf.tps.toFixed(1))

  var clients = self.state.clients
  lines.push('')
  lines.push('## ' + clients.length + ' clients connected')
  clients.forEach(function (client) {
    lines.push(util.format('- %s at %s rx: %d msgs / %s tx: %d msgs / %s',
      client.player.name, coords(client.player.location),
      client.perf.messagesReceived, mb(client.perf.bytesReceived),
      client.perf.messagesSent, mb(client.perf.bytesSent)))
  })

  res.set('content-type', 'text/plain')
  res.send(lines.join('\n'))
}

function mb (v) {
  return Math.round(v / 1024 / 1024) + 'MB'
}

function percent (v) {
  return Math.round(v * 100) + '%'
}

function coords (v) {
  return Math.floor(v.x) + ', ' + Math.floor(v.y) + ', ' + Math.floor(v.z)
}
