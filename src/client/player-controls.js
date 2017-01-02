var config = require('../config')
var env = require('./env')
var vox = require('../vox')
var HUD = require('./models/hud')
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
function tick (state, dt, isPaused) {
  // If dt is too large, simulate in smaller increments
  // This prevents glitches like jumping through a block, getting stuck inside a block, etc
  for (var t = 0.0; t < dt; t += config.PHYSICS.MAX_DT) {
    var stepDt = Math.min(config.PHYSICS.MAX_DT, dt - t)
    if (!isPaused) navigate(state.player, stepDt)
    simulate(state, stepDt)
  }
  if (!isPaused) look(state.player)
}

// Lets the player place and break blocks
// TODO: let the player interact with items
function interact (state) {
  var p = state.player

  if (shell.wasDown('1')) p.placing = HUD.QUICKBAR_VOX[0]
  else if (shell.wasDown('2')) p.placing = HUD.QUICKBAR_VOX[1]
  else if (shell.wasDown('3')) p.placing = HUD.QUICKBAR_VOX[2]
  else if (shell.wasDown('4')) p.placing = HUD.QUICKBAR_VOX[3]
  else if (shell.wasDown('5')) p.placing = HUD.QUICKBAR_VOX[4]
  else if (shell.wasDown('6')) p.placing = HUD.QUICKBAR_VOX[5]
  else if (shell.wasDown('7')) p.placing = HUD.QUICKBAR_VOX[6]
  else if (shell.wasDown('8')) p.placing = HUD.QUICKBAR_VOX[7]

  if (shell.press('9')) p.camera = p.camera === 'first-person' ? 'third-person' : 'first-person'

  if (shell.press('0')) state.debug.showHUD = !state.debug.showHUD

  var left = shell.wasDown('mouse-left')
  var right = shell.wasDown('mouse-right')
  var shift = shell.wasDown('shift')
  if (right || (shift && left)) return breakBlock(state)
  else if (left) return placeBlock(state)
}

// Let the player move
function navigate (player, dt) {
  var loc = player.location
  var dir = player.direction
  var vel = player.velocity

  // Directional input (WASD) always works
  var speed = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT : config.SPEED_WALK
  vel.x = 0
  vel.y = 0
  if (shell.wasDown('nav-forward')) move(vel, speed, dir.azimuth, 0)
  if (shell.wasDown('nav-back')) move(vel, speed, dir.azimuth + Math.PI, 0)
  if (shell.wasDown('nav-left')) move(vel, speed, dir.azimuth + Math.PI * 0.5, 0)
  if (shell.wasDown('nav-right')) move(vel, speed, dir.azimuth + Math.PI * 1.5, 0)
  loc.x += vel.x * dt
  loc.y += vel.y * dt

  // Jumping (space) only works if we're on solid ground
  if (shell.wasDown('nav-jump') && player.situation === 'on-ground') {
    vel.z = shell.wasDown('nav-sprint') ? config.SPEED_SPRINT_JUMP : config.SPEED_JUMP
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
  var vel = player.velocity

  // Horizontal collision
  HORIZONTAL_COLLISION_DIRS.forEach(function (dir) {
    if (!collide(state, loc.x + dir[0], loc.y + dir[1], loc.z + dir[2])) return
    // Back off just enough to avoid collision. Don't bounce.
    if (dir[0] > 0) loc.x = Math.ceil(loc.x) - PW - EPS
    if (dir[0] < 0) loc.x = Math.floor(loc.x) + PW + EPS
    if (dir[1] > 0) loc.y = Math.ceil(loc.y) - PW - EPS
    if (dir[1] < 0) loc.y = Math.floor(loc.y) + PW + EPS
    if (dir[0] !== 0) vel.x = 0
    if (dir[1] !== 0) vel.y = 0
  })

  // Gravity
  vel.z -= config.PHYSICS.GRAVITY * dt

  // Vertical collision
  var underfoot = collide(state, loc.x, loc.y, loc.z - PH - EPS)
  var legs = collide(state, loc.x, loc.y, loc.z - PW - EPS)
  var head = collide(state, loc.x, loc.y, loc.z + PW - EPS)
  if (head && underfoot) {
    vel.z = 0
    player.situation = 'suffocating'
  } else if (head) {
    vel.z = 0
    player.situation = 'airborne'
    loc.z = Math.floor(loc.z - PH - EPS) + PH
  } else if (legs) {
    vel.z = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - PW - EPS) + PH
  } else if (underfoot && vel.z <= 0) {
    vel.z = 0
    player.situation = 'on-ground'
    loc.z = Math.ceil(loc.z - PH - EPS) + PH
  } else {
    player.situation = 'airborne'
  }

  loc.z += vel.z * dt
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

  return setBlock(state, bx, by, bz, state.player.placing)
}

// Break the block we're looking at
function breakBlock (state) {
  var block = state.player.lookAtBlock
  if (!block) return

  var loc = block.location
  var neighbors = [
    state.world.getVox(loc.x + 1, loc.y, loc.z),
    state.world.getVox(loc.x, loc.y + 1, loc.z),
    state.world.getVox(loc.x - 1, loc.y, loc.z),
    state.world.getVox(loc.x, loc.y - 1, loc.z),
    state.world.getVox(loc.x, loc.y, loc.z + 1)
  ]
  var v = neighbors.includes(vox.INDEX.WATER) ? vox.INDEX.WATER : vox.INDEX.AIR

  return setBlock(state, loc.x, loc.y, loc.z, v)
}

function setBlock (state, x, y, z, v) {
  // TODO: move prediction to its own file
  state.world.setVox(x, y, z, v)
  return {type: 'set', x: x, y: y, z: z, v: v}
}
