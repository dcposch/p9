var config = require('./config')
var env = require('./env')
var shell = env.shell

module.exports = {
  tick: tick
}

var CS = config.CHUNK_SIZE

// Calculates player physics and takes player input
function tick (state) {
  simulate(state)
  navigate(state.player)
  look(state.player)
}

// Let the player move
function navigate (player) {
  var loc = player.location
  var dir = player.direction

  // Directional input (WASD) always works
  var speed = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT : config.SPEED_WALK
  var dist = speed * config.TICK_INTERVAL
  if (shell.wasDown('nav-forward')) move(loc, dist, dir.azimuth, 0)
  if (shell.wasDown('nav-back')) move(loc, dist, dir.azimuth + Math.PI, 0)
  if (shell.wasDown('nav-left')) move(loc, dist, dir.azimuth + Math.PI * 0.5, 0)
  if (shell.wasDown('nav-right')) move(loc, dist, dir.azimuth + Math.PI * 1.5, 0)

  // Jumping (space) only works if we're on solid ground
  if (shell.wasDown('nav-jump') && player.situation === 'on-ground') {
    player.dzdt = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT_JUMP : config.SPEED_JUMP
    player.situation = 'airborne'
  }
}

// Modify vector {x, y, z} by adding a vector in spherical coordinates
function move (v, r, azimuth, altitude) {
  v.x += Math.cos(azimuth) * Math.cos(altitude) * r
  v.y += Math.sin(azimuth) * Math.cos(altitude) * r
  v.z += Math.sin(altitude) * r
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

function simulate (state) {
  var player = state.player
  var loc = player.location

  // Horizontal collision
  var eps = 0.001
  var pw = config.PLAYER_WIDTH
  var ph = config.PLAYER_HEIGHT
  var dirs = [
    [pw, 0, -ph + pw],
    [-pw, 0, -ph + pw],
    [0, pw, -ph + pw],
    [0, -pw, -ph + pw],
    [pw, 0, -pw],
    [-pw, 0, -pw],
    [0, pw, -pw],
    [0, -pw, -pw]
  ]
  dirs.forEach(function (dir) {
    if (!collide(state, loc.x + dir[0], loc.y + dir[1], loc.z + dir[2])) return
    // Back off just enough to avoid collision. Don't bounce.
    if (dir[0] > 0) loc.x = Math.ceil(loc.x) - pw - eps
    if (dir[0] < 0) loc.x = Math.floor(loc.x) + pw + eps
    if (dir[1] > 0) loc.y = Math.ceil(loc.y) - pw - eps
    if (dir[1] < 0) loc.y = Math.floor(loc.y) + pw + eps
  })

  // Gravity
  player.dzdt -= config.PHYSICS.GRAVITY * config.TICK_INTERVAL

  // Vertical collision
  var underfoot = collide(state, loc.x, loc.y, loc.z - ph - eps)
  var legs = collide(state, loc.x, loc.y, loc.z - pw - eps)
  var head = collide(state, loc.x, loc.y, loc.z - eps)
  if (head && underfoot) {
    player.dzdt = 0
    player.situation = 'suffocating'
  } else if (head) {
    player.dzdt = 0
    player.situation = 'airborne'
    loc.z = Math.floor(loc.z - ph - eps) + ph
  } else if (legs) {
    player.dzdt = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - pw - eps) + ph
  } else if (underfoot && player.dzdt <= 0) {
    player.dzdt = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - ph - eps) + ph
  } else {
    player.situation = 'airborne'
  }

  loc.z += player.dzdt * config.TICK_INTERVAL
}

function collide (state, x, y, z) {
  var chunks = state.world.chunks
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]
    if (chunk.x > x || chunk.y > y || chunk.z > z) continue
    if (chunk.x + CS <= x || chunk.y + CS <= y || chunk.z + CS <= z) continue
    if (!chunk.data) return false // Empty chunk
    var ix = Math.floor(x - chunk.x)
    var iy = Math.floor(y - chunk.y)
    var iz = Math.floor(z - chunk.z)
    var v = getVoxel(chunk.data, ix, iy, iz)
    return !!v
  }
  // In an area where we have no chunks loaded? Always collide
  // Don't let the player walk off the edge of the world
  return true
}

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * CS * CS + iy * CS + iz]
}
