var config = require('./config')
var env = require('./env')
var vox = require('./vox')
var shell = env.shell

module.exports = {
  tick: tick,
  interact: interact
}

var EPS = 0.001
var PW = config.PLAYER_WIDTH
var PH = config.PLAYER_HEIGHT
var HORIZONTAL_COLLISION_DIRS = [
  [PW, 0, 0], [PW, 0, -1],
  [-PW, 0, 0], [-PW, 0, -1],
  [0, PW, 0], [0, PW, -1],
  [0, -PW, 0], [0, -PW, -1]
]

// Calculates player physics. Lets the player move and look around.
function tick (state, dt) {
  // If dt is too large, simulate in smaller increments
  // This prevents glitches like jumping through a block, getting stuck inside a block, etc
  for (var t = 0.0; t < dt; t += config.PHYSICS.MAX_DT) {
    var stepDt = Math.min(config.PHYSICS.MAX_DT, dt - t)
    navigate(state.player, stepDt)
    simulate(state, stepDt)
  }
  look(state.player)
}

// Lets the player place and break blocks
// TODO: let the player interact with items
function interact (state) {
  if (shell.wasDown('mouse-left')) placeBlock(state)
  else if (shell.wasDown('mouse-right')) breakBlock(state)
}

// Let the player move
function navigate (player, dt) {
  var loc = player.location
  var dir = player.direction

  // Directional input (WASD) always works
  var speed = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT : config.SPEED_WALK
  var dist = speed * dt
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

// Apply gravity to the player, don't let them pass through blocks, etc
function simulate (state, dt) {
  var player = state.player
  var loc = player.location

  // Horizontal collision
  HORIZONTAL_COLLISION_DIRS.forEach(function (dir) {
    if (!collide(state, loc.x + dir[0], loc.y + dir[1], loc.z + dir[2])) return
    // Back off just enough to avoid collision. Don't bounce.
    if (dir[0] > 0) loc.x = Math.ceil(loc.x) - PW - EPS
    if (dir[0] < 0) loc.x = Math.floor(loc.x) + PW + EPS
    if (dir[1] > 0) loc.y = Math.ceil(loc.y) - PW - EPS
    if (dir[1] < 0) loc.y = Math.floor(loc.y) + PW + EPS
  })

  // Gravity
  player.dzdt -= config.PHYSICS.GRAVITY * dt

  // Vertical collision
  var underfoot = collide(state, loc.x, loc.y, loc.z - PH - EPS)
  var legs = collide(state, loc.x, loc.y, loc.z - PW - EPS)
  var head = collide(state, loc.x, loc.y, loc.z + PW - EPS)
  if (head && underfoot) {
    player.dzdt = 0
    player.situation = 'suffocating'
  } else if (head) {
    player.dzdt = 0
    player.situation = 'airborne'
    loc.z = Math.floor(loc.z - PH - EPS) + PH
  } else if (legs) {
    player.dzdt = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - PW - EPS) + PH
  } else if (underfoot && player.dzdt <= 0) {
    player.dzdt = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - PH - EPS) + PH
  } else {
    player.situation = 'airborne'
  }

  loc.z += player.dzdt * dt
}

// Returns true if (x, y, z) is unpassable (either in a block or off the world)
function collide (state, x, y, z) {
  var v = state.world.getVox(Math.floor(x), Math.floor(y), Math.floor(z))
  return v > 1
}

// Place a block onto the block face we're looking at
// TODO: rate limit
function placeBlock (state) {
  var block = state.player.lookAtBlock
  if (!block) return
  var loc = block.location
  var side = block.side
  var bx = loc.x + side.nx
  var by = loc.y + side.ny
  var bz = loc.z + side.nz

  // Don't let the player place a block where they're standing
  var p = state.player.location
  var intersectsPlayer =
    bx === Math.floor(p.x) &&
    by === Math.floor(p.y) &&
    [0, -1].includes(bz - Math.floor(p.z))
  if (intersectsPlayer) return

  // TODO: select which type of block to place
  state.world.setVox(bx, by, bz, vox.INDEX.LIGHT_PURPLE)
}

// Break the block we're looking at
function breakBlock (state) {
  // TODO
}
