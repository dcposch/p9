var sound = require('./sound')
var playerControls = require('./player-controls')
var picker = require('./picker')
var mesher = require('./mesher')
var Socket = require('./socket')
var config = require('../config')
var World = require('../world')
var ChunkIO = require('../protocol/chunk-io')
var vox = require('../vox')
var textures = require('./textures')

// Find the canvas, initialize regl and game-shell
var env = require('./env')

// Precompile regl commands, start loading resources
var drawDebug, drawHitMarker, drawWorld

textures.loadAll(function (err) {
  if (err) return handleError('failed to load textures')
  drawHitMarker = require('./draw-hit-marker')
  drawWorld = require('./draw-world')
})

// All game state lives here
var state = {
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
  controls: {
    placing: vox.INDEX.STONE
  },
  pendingCommands: [],
  pendingChunkUpdates: [],
  perf: {
    lastFrameTime: new Date().getTime(),
    fps: 0,
    draw: {chunks: 0, verts: 0}
  },
  debug: {
    // Player can toggle the debug display
    showHUD: false
  },
  world: new World(),
  socket: new Socket(),
  config: null,
  error: null
}

// Handle server messages
state.socket.on('binary', function (msg) {
  state.pendingChunkUpdates = ChunkIO.read(msg)
  console.log('Read %d chunks', state.pendingChunkUpdates.length)
})

state.socket.on('json', function (msg) {
  switch (msg.type) {
    case 'config':
      state.config = msg.config
      break
    default:
      console.error('Ignoring unknown message type ' + msg.type)
  }
})

state.socket.on('close', function () {
  handleError('connection lost')
})

// Runs once: initialization
env.shell.on('init', function () {
  console.log('WELCOME ~ VOXEL WORLD')
})

// Spash screen
var label = document.querySelector('label')
var input = document.querySelector('input')
var button = document.querySelector('button')
var canvas = document.querySelector('canvas')
var controls = document.querySelector('.controls')
var error = document.querySelector('.error')
var splash = document.querySelector('.splash')

// First, the player has to type in their name...
input.addEventListener('keyup', function () {
  var name = input.value.replace(/[^A-Za-z ]/g, '')
  if (name !== input.value) label.innerHTML = 'letters only'
  name = name.toLowerCase()
  if (name !== input.value) input.value = name

  // TODO: auth, invites, signup
  var names = ['magic word', 'dc', 'feross', 'mikola', 'neal', 'lipi', 'noor',
    'bcrypt', 'satnam', 'pineapple express', 'won', 'cguo', 'kevin chan']
  var ready = names.includes(input.value)
  button.classList.toggle('show', ready)
  controls.classList.toggle('show', ready)
})

// ...then, click to start
button.addEventListener('click', function () {
  env.shell.fullscreen = true
  env.shell.pointerLock = true

  state.player.name = input.value
  state.startTime = new Date().getTime()

  splash.remove()
  canvas.addEventListener('click', function () {
    if (state.error) return
    env.shell.fullscreen = true
    env.shell.pointerLock = true
  })

  var music = state.config && state.config.music
  if (music) sound.play(music.url, music.time)
  else sound.play('win95.mp3')
})

// Kill the game on error (eg 'connection lost'). Player has to refresh the page.
function handleError (message) {
  console.log('Error: ' + message)
  state.error = {message: message}
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

  // Track FPS
  var now = new Date().getTime()
  var dt = Math.max(now - state.perf.lastFrameTime, 1) / 1000
  state.perf.fps = 0.99 * state.perf.fps + 0.01 / dt // Exponential moving average
  state.perf.lastFrameTime = now

  // Handle player input, physics, update player position, direction, and velocity
  // While out of fullscreen, the game is paused
  if (env.shell.fullscreen) playerControls.tick(state, dt)

  if (state.startTime) render()

  // Catch up on work immediately *after* the frame ships to keep consistent fps
  setTimeout(postFrame, 0)
})

function render () {
  env.regl.clear({ color: [1, 1, 1, 1], depth: 1 })
  drawWorld(state)
  if (state.debug.showHUD) {
    if (!drawDebug) drawDebug = require('./draw-debug')
    drawDebug(state)
  }
  if (env.shell.fullscreen) drawHitMarker({ color: [1, 1, 1, 0.5] })
}

function postFrame () {
  var chunks = state.pendingChunkUpdates

  if (chunks.length > 0) {
    chunks.forEach(function (chunk) {
      // TODO: state.world.replaceChunk
      var c = state.world.getChunk(chunk.x, chunk.y, chunk.z)
      if (!c) return state.world.addChunk(chunk)
      c.data = chunk.data
      c.length = chunk.length
      c.dirty = true
    })
    chunks.length = 0

    // TODO: prediction, so that blocks don't pop into and out of existence
  } else {
    mesher.meshWorld(state.world, state.player.location)
  }
}

// Power user tools
window.state = state
window.config = config
