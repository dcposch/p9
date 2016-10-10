var config = require('./config')
var sound = require('./sound')
var playerControls = require('./player-controls')

// Find the canvas, initialize regl and game-shell
var env = require('./env')
var INITIAL_W = env.canvas.width
var INITIAL_H = env.canvas.height

// Precompile regl commands
var drawTriangle = require('./draw-triangle')
var drawDebug = require('./draw-debug')
var drawHitMarker = require('./draw-hit-marker')

// All game state lives here
var state = window.state = {
  started: false,
  player: {
    // Block coordinates of the player's head (the camera). +Z is up. When facing +X, +Y is left.
    location: { x: 0, y: 0, z: config.PLAYER_HEIGHT },
    // Azimuth ranges from 0 (looking down the +X axis) to 2*pi. Azimuth pi/2 looks at +Y.
    // Altitude ranges from -pi/2 (looking straight down) to pi/2 (up). 0 looks straight ahead.
    direction: { azimuth: 0, altitude: 0 }
  }
}

// Runs once
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
  resizeCanvasIfNeeded()
  if (!env.shell.fullscreen) return // The game is paused when not in fullscreen

  // Handle player input, update player position and orientation
  playerControls.navigate(state.player)
  playerControls.look(state.player)
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
  env.regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  drawTriangle(state)
  drawDebug(state)
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})

// Resize the canvas when going into or out of fullscreen
function resizeCanvasIfNeeded () {
  var w = env.shell.fullscreen ? window.innerWidth : INITIAL_W
  var h = env.shell.fullscreen ? window.innerHeight : INITIAL_H
  if (env.canvas.width !== w) env.canvas.width = w
  if (env.canvas.height !== h) env.canvas.height = h
}
