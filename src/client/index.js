var sound = require('./sound')
var playerControls = require('./player-controls')
var picker = require('./picker')
var mesher = require('./mesher')
var Socket = require('./socket')
var config = require('../config')
var World = require('../world')
var ChunkIO = require('../protocol/chunk-io')

// Find the canvas, initialize regl and game-shell
var env = require('./env')

// Precompile regl commands, start loading resources
var drawDebug = null
var drawHitMarker = require('./draw-hit-marker')
var drawWorld = require('./draw-world')

// All game state lives here
var state = window.state = {
  startTime: 0,
  player: {
    // Block coordinates of the player's head (the camera). +Z is up. When facing +X, +Y is left.
    location: { x: -68, y: 0, z: 30 },
    // Azimuth ranges from 0 (looking down the +X axis) to 2*pi. Azimuth pi/2 looks at +Y.
    // Altitude ranges from -pi/2 (looking straight down) to pi/2 (up). 0 looks straight ahead.
    direction: { azimuth: 0, altitude: 0 },
    // Physics
    dzdt: 0,
    // Situation can also be 'on-ground', 'suffocating'
    situation: 'airborne',
    // Which block we're looking at. {location: {x,y,z}, side: {nx,ny,nz}, voxel}
    lookAtBlock: null
  },
  pendingCommands: [],
  perf: {
    lastFrameTime: new Date().getTime(),
    fps: 0
  },
  debug: {
    // Player can toggle the debug display
    showHUD: false
  },
  world: new World(),
  socket: new Socket(),
  error: null
}

// Handle server messages
state.socket.on('binary', function (msg) {
  var chunks = ChunkIO.read(msg)
  chunks.forEach(function (chunk) {
    // TODO: state.world.replaceChunk
    var c = state.world.getChunk(chunk.x, chunk.y, chunk.z)
    if (!c) return state.world.addChunk(chunk)
    c.data = chunk.data
    c.length = chunk.length
    c.dirty = true
  })
  console.log('Read %d chunks', chunks.length)
  mesher.meshWorld(state.world)
})

state.socket.on('close', function () {
  handleError('connection lost')
})

// Runs once: initialization
env.shell.on('init', function () {
  console.log('WELCOME ~ VOXEL WORLD')
})

// Spash screen. Click to start
var label = document.querySelector('label')
var input = document.querySelector('input')
var button = document.querySelector('button')
var canvas = document.querySelector('canvas')
var controls = document.querySelector('.controls')
var error = document.querySelector('.error')
var splash = document.querySelector('.splash')

input.addEventListener('keyup', function () {
  var name = input.value.replace(/[^A-Za-z]/g, '')
  if (name !== input.value) label.innerHTML = 'letters only'
  name = name.toLowerCase()
  if (name !== input.value) input.value = name

  // TODO: auth, invites, signup
  var names = ['dc', 'feross', 'mikola', 'neal', 'lipi', 'noor', 'bcrypt', 'nobody']
  var ready = names.includes(input.value)
  button.classList.toggle('show', ready)
  controls.classList.toggle('show', ready)
})

button.addEventListener('click', function () {
  env.shell.fullscreen = true
  env.shell.pointerLock = true

  state.player.name = input.value
  state.startTime = new Date().getTime()
  sound.play('win95.mp3')
  splash.remove()

  canvas.addEventListener('click', function () {
    if (state.error) return
    env.shell.fullscreen = true
    env.shell.pointerLock = true
  })
})

function handleError (message) {
  console.log('Error: ' + message)
  state.error = {messsage: message}
  if (splash) splash.remove()
  error.classList.add('show')
  error.innerText = message
  env.shell.fullscreen = false
  env.shell.pointerLock = false
}

// Runs regularly, independent of frame rate
env.shell.on('tick', function () {
  var startMs = new Date().getTime()
  env.resizeCanvasIfNeeded()
  if (state.error) return

  // Block interactions
  picker.pick(state)
  var command = playerControls.interact(state)
  if (command) state.pendingCommands.push(command)

  // Physics
  // TODO: block physics, update all active chunks

  // Client / server
  // TODO: enqueue actions to send to the server
  // TODO: create or modify any chunks we got from the server since the last tick
  // TODO: update player state if there's data from the server
  // TODO: update objects, other players, NPCs, etc if there's data from the server
  state.socket.send({
    type: 'update',
    player: state.player,
    commands: state.pendingCommands
  })
  if (state.pendingCommands.length) console.log('Sent %d commands', state.pendingCommands.length)
  state.pendingCommands.length = 0

  var elapsedMs = Math.round(new Date().getTime() - startMs)
  if (elapsedMs > 1000 * config.TICK_INTERVAL) console.log('Slow tick: %d ms', elapsedMs)
})

// Renders each frame. Should run at 60Hz.
// Stops running if the canvas is not visible, for example because the window is minimized.
env.regl.frame(function (context) {
  // TODO: figure out which chunks are visible
  // TODO: remesh all dirty, visible chunks
  // TODO: draw all visible chunks
  // TODO: draw all objects
  // TODO: draw HUD (inventory, hotbar, health bar, etc)
  if (!state.startTime) return

  // Track FPS
  var now = new Date().getTime()
  var dt = (now - state.perf.lastFrameTime) / 1000
  state.perf.fps = 0.99 * state.perf.fps + 0.01 / dt // Exponential moving average
  state.perf.lastFrameTime = now

  // Handle player input, physics, update player position, direction, and velocity
  // While out of fullscreen, the game is paused
  if (env.shell.fullscreen) playerControls.tick(state, dt)

  mesher.meshWorld(state.world)

  // Redraw the frame
  env.regl.clear({ color: [1, 1, 1, 1], depth: 1 })
  drawWorld(state)
  if (state.debug.showHUD) {
    if (!drawDebug) drawDebug = require('./draw-debug')
    drawDebug(state)
  }
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})
