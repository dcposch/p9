var sound = require('./sound')
var playerControls = require('./player-controls')
var picker = require('./picker')
var mesher = require('./mesher')
var Socket = require('./socket')
var World = require('../world')
var Chunk = require('../chunk')
var config = require('../config')

// Find the canvas, initialize regl and game-shell
var env = require('./env')

// Precompile regl commands, start loading resources
var drawDebug = require('./draw-debug')
var drawHitMarker = require('./draw-hit-marker')
var drawWorld = require('./draw-world')

// All game state lives here
var state = window.state = {
  started: false,
  player: {
    // Block coordinates of the player's head (the camera). +Z is up. When facing +X, +Y is left.
    location: { x: 0, y: 0, z: 20 },
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
  perf: {
    lastFrameTime: new Date().getTime(),
    fps: 0
  },
  world: new World(),
  socket: new Socket()
}

// Handle server messages
state.socket.on('binary', function (msg) {
  var ints = new Int32Array(msg)
  var numChunks = ints[0]
  var offset = 1
  for (var i = 0; i < numChunks; i++) {
    var x = ints[offset]
    var y = ints[offset + 1]
    var z = ints[offset + 2]
    var numQuads = ints[offset + 3]
    offset += 4
    var data = new Uint8Array(msg.slice(offset * 4, offset * 4 + numQuads * 8))
    offset += numQuads * 2
    var chunk = new Chunk(x, y, z, data, true)
    state.world.addChunk(chunk)
  }
  console.log('Read %d chunks', numChunks)
})

// Runs once: initialization
env.shell.on('init', function () {
  console.log('WELCOME ~ VOXEL WORLD')
})

// Click to start
env.canvas.addEventListener('click', function () {
  env.shell.fullscreen = true
  env.shell.pointerLock = true
  if (state.started) return
  sound.play('win95.mp3')
  state.started = true
})

// Runs regularly, independent of frame rate
env.shell.on('tick', function () {
  var startMs = new Date().getTime()
  env.resizeCanvasIfNeeded()

  // Client / server
  // TODO: enqueue actions to send to the server
  // TODO: create or modify any chunks we got from the server since the last tick
  // TODO: update player state if there's data from the server
  // TODO: update objects, other players, NPCs, etc if there's data from the server
  state.socket.send({type: 'player', player: state.player})

  // Block interactions
  picker.pick(state)
  playerControls.interact(state)

  // Physics
  // TODO: block physics, update all active chunks
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
  var dt = (now - state.perf.lastFrameTime) / 1000
  state.perf.fps = 0.99 * state.perf.fps + 0.01 / dt // Exponential moving average
  state.perf.lastFrameTime = now

  // Handle player input, physics, update player position, direction, and velocity
  // The game is paused when not in fullscreen
  if (env.shell.fullscreen) playerControls.tick(state, dt)

  mesher.meshWorld(state.world)

  // Redraw the frame
  env.regl.clear({ color: [1, 1, 1, 1], depth: 1 })
  drawWorld(state)
  drawDebug(state)
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})