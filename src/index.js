var config = require('./config')
var sound = require('./sound')
var playerControls = require('./player-controls')
var gen = require('./gen')

// Find the canvas, initialize regl and game-shell
var env = require('./env')
var INITIAL_W = env.canvas.width
var INITIAL_H = env.canvas.height

// Precompile regl commands
var drawAxes = require('./draw-axes')
var drawDebug = require('./draw-debug')
var drawHitMarker = require('./draw-hit-marker')
var meshChunk = require('./mesh-chunk')
var drawChunksScope
var drawChunk = meshChunk.drawChunk()

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
    situation: 'airborne' // Can also be 'on-ground', 'suffocating'
  },
  perf: {
    lastFrameTime: new Date().getTime(),
    fps: 0
  },
  chunks: []
}

// Runs once: initialization
env.shell.on('init', function () {
  console.log('WELCOME ~ VOXEL WORLD')
})

meshChunk.loadResources(function () {
  drawChunksScope = meshChunk.drawChunksScope()
})

// Generate a test world
// TODO: move this to the server
console.time('generate')
for (var x = -192; x < 192; x += config.CHUNK_SIZE) {
  for (var y = -192; y < 192; y += config.CHUNK_SIZE) {
    for (var z = 0; z < 128; z += config.CHUNK_SIZE) {
      state.chunks.push(gen.generateChunk(x, y, z))
    }
  }
}
console.timeEnd('generate')

// ...just mesh all the chunks immediately
console.time('mesh')
state.chunks.forEach(meshChunk.mesh)
console.timeEnd('mesh')

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
  resizeCanvasIfNeeded()
  if (!env.shell.fullscreen) return // The game is paused when not in fullscreen

  // Handle player input, physics, update player position, direction, and velocity
  playerControls.tick(state)
  // TODO: handle additional player actions (break block, place block, etc)

  // Client / server
  // TODO: enqueue actions to send to the server
  // TODO: create or modify any chunks we got from the server since the last tick
  // TODO: update player state if there's data from the server
  // TODO: update objects, other players, NPCs, etc if there's data from the server

  // Apply actions to world
  // (This should be done by both the client and the server. If they disagree, the server wins.)
  // TODO: place and break blocks

  // Physics
  // TODO: update all active chunks
})

// Renders each frame. Should run at 60Hz.
// Stops running if the canvas is not visible, for example because the window is minimized.
env.regl.frame(function (context) {
  // TODO: figure out which chunks are visible
  // TODO: remesh all dirty, visible chunks
  // TODO: draw all visible chunks
  // TODO: draw all objects
  // TODO: draw HUD (inventory, hotbar, health bar, etc)
  var now = new Date().getTime()
  state.perf.fps = 0.99 * state.perf.fps + 0.01 * 1000 / (now - state.perf.lastFrameTime) // EMA
  state.perf.lastFrameTime = now

  env.regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  if (config.DEBUG.AXES) {
    drawAxes(state)
  } else if (drawChunksScope) {
    for (var i = 0; i < state.chunks.length; i++) if (!state.chunks[i].mesh) return
    drawChunksScope(state, function () {
      drawChunk(state.chunks)
    })
  }
  drawDebug(state)
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})

// Resize the canvas when going into or out of fullscreen
function resizeCanvasIfNeeded () {
  var w = env.shell.fullscreen ? window.innerWidth : INITIAL_W
  var h = env.shell.fullscreen ? window.innerHeight : INITIAL_H
  if (env.canvas.width !== w || env.canvas.height !== h) {
    env.canvas.width = w
    env.canvas.height = h
    console.log('Set canvas size %d x %d', w, h)
  }
}
