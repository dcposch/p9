var config = require('./config')
var env = require('./env')
var shell = env.shell

module.exports = {
  navigate: navigate,
  look: look
}

// Let the player move
function navigate (player) {
  var azimuth = player.direction.azimuth
  var altitude = player.direction.altitude
  var location = player.location
  var speed = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT : config.SPEED_WALK
  var distance = speed * config.TICK_INTERVAL
  if (shell.wasDown('nav-forward')) move(location, distance, azimuth, altitude)
  if (shell.wasDown('nav-back')) move(location, distance, azimuth + Math.PI, -altitude)
  if (shell.wasDown('nav-left')) move(location, distance, azimuth + Math.PI * 0.5, 0)
  if (shell.wasDown('nav-right')) move(location, distance, azimuth + Math.PI * 1.5, 0)
}

// Move location {x, y, z} by adding a vector in spherical coordinates
function move (location, r, azimuth, altitude) {
  location.x += Math.cos(azimuth) * Math.cos(altitude) * r
  location.y += Math.sin(azimuth) * Math.cos(altitude) * r
  location.z += Math.sin(altitude) * r
}

// Let the player look around
function look (player) {
  var dx = shell.mouseX - shell.prevMouseX
  var dy = shell.mouseY - shell.prevMouseY
  var dir = player.direction
  var pi = Math.PI
  dir.azimuth -= dx * config.MOUSE_SENSITIVITY
  dir.azimuth = (dir.azimuth + 2 * pi) % (2 * pi) // Wrap to [0, 2pi)
  dir.altitude -= dy * config.MOUSE_SENSITIVITY
  dir.altitude = Math.min(0.5 * pi, Math.max(-0.5 * pi, dir.altitude)) // Clamp to [-pi/2, pi/2]
}
