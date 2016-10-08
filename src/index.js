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
  if (env.shell.fullscreen) {
    playerControls.navigate(state.player)
    playerControls.look(state.player)
  }
  // Resize the canvas when going into or out of fullscreen
  var w = env.shell.fullscreen ? window.innerWidth : INITIAL_W
  var h = env.shell.fullscreen ? window.innerHeight : INITIAL_H
  if (env.canvas.width !== w) env.canvas.width = w
  if (env.canvas.height !== h) env.canvas.height = h
})

// Renders each frame. Should run at 60Hz.
// Stops running if the canvas is not visible, for example because the window is minimized.
env.regl.frame(function (context) {
  env.regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  drawTriangle(state)
  drawDebug(state)
  drawHitMarker({ color: [1, 1, 1, 0.5] })
})
