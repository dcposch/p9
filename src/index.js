var config = require('./config')
var sound = require('./sound')
var playerControls = require('./player-controls')

// Find the canvas, initialize regl and game-shell
var env = require('./env')

// Precompile regl commands
var drawTriangle = require('./draw-triangle')

// All game state lives here
var state = window.state = {
  started: false,
  player: {
    // Block coordinates of the player's head (the camera). +Z is up.
    location: { x: 0, y: 0, z: config.PLAYER_HEIGHT },
    // Spherical coordinates
    // Azimuth ranges from 0 (looking down the +X axis) to 2*PI. Azimuth PI/2 looks at +Y.
    // Altitude ranges from PI/2 (looking straight up) to -PI/2 (looking down).
    // Altitude 0 looks straight ahead.
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
  var enableControls = env.shell.fullscreen
  if (enableControls) {
    playerControls.navigate(state.player)
    playerControls.look(state.player)
  }
})

// Renders each frame. Should run at 60Hz.
// Stops running if the canvas is not visible, for example because the window is minimized.
env.regl.frame(function (context) {
  env.regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  drawTriangle(state)
})
