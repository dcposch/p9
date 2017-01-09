var vox = require('../vox')
var config = require('../config')

module.exports = {
  pick: pick
}

var SIDE_0 = { nx: 0, ny: 0, nz: 0 }
var SIDE_X = [{ nx: 1, ny: 0, nz: 0 }, { nx: -1, ny: 0, nz: 0 }]
var SIDE_Y = [{ nx: 0, ny: 1, nz: 0 }, { nx: 0, ny: -1, nz: 0 }]
var SIDE_Z = [{ nx: 0, ny: 0, nz: 1 }, { nx: 0, ny: 0, nz: -1 }]
var EPS = 1e-6

// Picking algorithm
// Finds what the player is pointing at
function pick (state) {
  var loc = state.player.location
  var dir = state.player.direction
  var world = state.world
  state.player.lookAtBlock = raycastBlock(loc, dir, world, config.MAX_PICK_DISTANCE)
}

// Follows a ray until it intersects a block
// Returns { location: {x, y, z}, side: {nx, ny, nz} }
// ...where x, y, and z are integers and {nx, ny, nx} is an axis aligned unit normal.
// Returns null if the ray leaves the world (enters a missing chunk) before intersecting anything.
// Returns { location: floor(loc), side: (0, 0, 0) } if loc is inside a block.
function raycastBlock (loc, dir, world, maxDistance) {
  var distance = 0
  var lx = loc.x
  var ly = loc.y
  var lz = loc.z
  var dx = nonzero(Math.cos(dir.azimuth) * Math.cos(dir.altitude))
  var dy = nonzero(Math.sin(dir.azimuth) * Math.cos(dir.altitude))
  var dz = nonzero(Math.sin(dir.altitude))
  var sdx = dx > 0 ? 1 : 0
  var sdy = dy > 0 ? 1 : 0
  var sdz = dz > 0 ? 1 : 0
  var side = SIDE_0
  for (var i = 0; ; i++) {
    var ix = Math.floor(lx)
    var iy = Math.floor(ly)
    var iz = Math.floor(lz)
    var v = world.getVox(ix, iy, iz)
    if (v < 0) return null // off-world
    if (vox.isSolid(v)) return { location: { x: ix, y: iy, z: iz }, side: side, voxel: v }
    // If we're here, (lx, ly, lz) is in an air or water block
    // Intersect the nearest integer x, y, and z planes, then see which is closest
    var distx = (sdx - lx + ix) / dx
    var disty = (sdy - ly + iy) / dy
    var distz = (sdz - lz + iz) / dz
    var dist
    if (distx < disty && distx < distz) {
      dist = distx
      side = SIDE_X[sdx]
    } else if (disty < distz) {
      dist = disty
      side = SIDE_Y[sdy]
    } else {
      dist = distz
      side = SIDE_Z[sdz]
    }
    dist += EPS
    if (!(dist > 0)) throw new Error('raycasting error, dist ' + dist)
    lx += dist * dx
    ly += dist * dy
    lz += dist * dz

    distance += dist
    if (distance > maxDistance) return null // past max pick distance
  }
}

function nonzero (x) {
  return Math.abs(x) < EPS ? EPS : x
}
