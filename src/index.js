var sound = require('./sound')
var playerControls = require('./player-controls')
var gen = require('./gen')
var World = require('./world')
var config = require('./config')
var picker = require('./picker')

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
    // Which block we're looking at
    lookAtBlock: null
  },
  perf: {
    lastFrameTime: new Date().getTime(),
    fps: 0
  },
  world: new World()
}

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

  // Update the world
  // (This should be done by both the client and the server. If they disagree, the server wins.)
  // TODO: place and break blocks
  gen.generateWorld(state)

  // Block interactions
  // TODO: handle break block, place block, etc
  picker.pick(state)

  // Physics
  // TODO: update all active chunks
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

  // Redraw the frame
  env.regl.clear({ color: [1, 1, 1, 1], depth: 1 })
  drawWorld(state)
  drawDebug(state)
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})
