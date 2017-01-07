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

// Precompile regl commands
var drawScope = require('./draw-scope')
var drawHitMarker = require('./draw-hit-marker')
var drawWorld = require('./draw-world')
var drawDebug = null // Created on-demand
var HUD = require('./models/hud')
var Player = require('./models/player')

// All game state lives here
var state = {
  startTime: 0,
  player: {
    // Block coordinates of the player's head. +Z is up. When facing +X, +Y is left.
    location: { x: -68, y: 0, z: 30 },
    // Azimuth ranges from 0 (looking at +X) to 2*pi. Azimuth pi/2 looks at +Y.
    // Altitude ranges from -pi/2 (looking straight down) to pi/2 (up, +Z). 0 looks straight ahead.
    direction: { azimuth: 0, altitude: 0 },
    // Physics
    velocity: { x: 0, y: 0, z: 0 },
    // Situation can also be 'on-ground', 'suffocating'
    situation: 'airborne',
    // Which block we're looking at: {location: {x,y,z}, side: {nx,ny,nz}, voxel}
    lookAtBlock: null,
    // Which kind of block we're placing
    placing: vox.INDEX.STONE,
    // Camera can also be 'third-person'
    camera: 'first-person'
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
  objects: {},
  world: new World(),
  socket: new Socket(),
  config: null,
  error: null
}

// Load resources
textures.loadAll(function (err) {
  if (err) {
    console.error('failed to load textures', err)
    handleError('failed to load textures')
  }
})

// Handle server messages
state.socket.on('binary', function (msg) {
  state.pendingChunkUpdates = ChunkIO.read(msg)
  console.log('Read %d chunks', state.pendingChunkUpdates.length)
})

state.socket.on('json', function (msg) {
  switch (msg.type) {
    case 'config':
      return handleConfig(msg)
    case 'objects':
      return handleObjects(msg)
    case 'error':
      return handleError(msg.error.message)
    default:
      console.error('Ignoring unknown message type ' + msg.type)
  }
})

state.socket.on('close', function () {
  handleError('connection lost')
})

function handleConfig (msg) {
  state.config = msg.config
}

function handleObjects (msg) {
  var now = new Date().getTime()
  var keys = {}

  // Create and update new objects
  msg.objects.forEach(function (info) {
    keys[info.key] = true
    var obj = state.objects[info.key]
    if (!obj) obj = state.objects[info.key] = createObject(info)
    obj.location = info.location
    obj.direction = info.direction
    obj.velocity = info.velocity
    obj.situation = info.situation
    Object.assign(obj.props, info.props)
    obj.lastUpdateMs = now
  })

  // Delete objects that no longer exist or are too far away
  Object.keys(state.objects).forEach(function (key) {
    if (keys[key]) return
    if (key === 'self') return
    state.objects[key].destroy()
    delete state.objects[key]
  })
}

function createObject (info) {
  switch (info.type) {
    case 'player':
      return new Player(info.name)
    default:
      throw new Error('unrecognized object type ' + info.type)
  }
}

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

  var ready = name.length >= 3 && name.length < 20
  button.classList.toggle('show', ready)
  controls.classList.toggle('show', ready)
})

// ...then, click to start
button.addEventListener('click', function () {
  env.shell.fullscreen = true
  env.shell.pointerLock = true

  state.player.name = input.value
  state.startTime = new Date().getTime()
  state.objects.self = new Player(state.player.name)

  splash.remove()
  canvas.addEventListener('click', function () {
    if (state.error) return
    env.shell.fullscreen = true
    env.shell.pointerLock = true
  })

  var music = state.config && state.config.music
  if (music) sound.play(music.url, music.time)
})

// Kill the game on error (eg 'connection lost'). Player has to refresh the page.
function handleError (message) {
  console.log('Error: ' + message)
  if (state.error) return
  state.error = {message: message}
  if (splash) splash.remove()
  error.classList.add('show')
  error.innerText = message
  env.shell.fullscreen = false
  env.shell.pointerLock = false
}

// Runs regularly, independent of frame rate
env.shell.on('tick', function () {
  env.resizeCanvasIfNeeded()
  if (state.error) return

  var startMs = new Date().getTime()

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
  // Track FPS
  var now = new Date().getTime()
  var dt = Math.max(now - state.perf.lastFrameTime, 1) / 1000
  state.perf.fps = 0.99 * state.perf.fps + 0.01 / dt // Exponential moving average
  state.perf.lastFrameTime = now

  applyChunkUpdates()
  mesher.meshWorld(state.world, state.player.location)

  if (state.startTime) {
    // Handle player input, physics, update player position, direction, and velocity
    playerControls.tick(state, dt, !env.shell.fullscreen)
    // Prediction: extrapolate object positions from latest server update
    predictObjects(dt, now)
    // Draw the frame
    render(dt)
  }
})

function predictObjects (dt, now) {
  // Our own player object gets special treatment
  var self = state.objects.self
  self.location = state.player.location
  self.velocity = state.player.velocity
  self.props.direction = state.player.direction

  // All other object positions are extrapolated from the latest server position + velocity
  Object.keys(state.objects).forEach(function (key) {
    if (key === 'self') return
    var obj = state.objects[key]
    // Don't extrapolate too far. If there's too much lag, it's better for objects to stop moving
    // than to teleport through blocks.
    if (obj.lastUpdateMs - now > config.MAX_EXTRAPOLATE_MS) return
    var loc = obj.location
    var vel = obj.velocity
    if (obj.situation === 'airborne') vel.z -= config.PHYSICS.GRAVITY * dt
    loc.x += vel.x * dt
    loc.y += vel.y * dt
    loc.z += vel.z * dt
  })
}

function render (dt) {
  env.regl.clear({ color: [1, 1, 1, 1], depth: 1 })
  if (!drawScope) return
  drawScope(state, function () {
    drawWorld(state)
    Object.keys(state.objects).forEach(function (key) {
      var obj = state.objects[key]
      obj.tick(dt)
      obj.draw()
    })
  })
  if (state.debug.showHUD) {
    if (!drawDebug) drawDebug = require('./draw-debug')
    drawDebug(state)
  }
  if (state.player.camera === 'first-person') {
    drawHitMarker({ color: [1, 1, 1, 0.5] })
  }
  HUD.draw({selectedIndex: HUD.QUICKBAR_VOX.indexOf(state.player.placing)})
}

function applyChunkUpdates () {
  var chunks = state.pendingChunkUpdates
  if (chunks.length > 0) {
    chunks.forEach(function (chunk) {
      state.world.replaceChunk(chunk)
    })
    chunks.length = 0
    // TODO: prediction, so that blocks don't pop into and out of existence
  }
}

// Power user tools
window.state = state
window.config = config
