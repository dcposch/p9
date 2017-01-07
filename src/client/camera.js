var mat4 = {
  create: require('gl-mat4/create'),
  identity: require('gl-mat4/identity'),
  rotate: require('gl-mat4/rotate'),
  translate: require('gl-mat4/translate'),
  perspective: require('gl-mat4/perspective'),
  multiply: require('gl-mat4/multiply')
}
var coordinates = require('./geometry/coordinates')

// Projects the world from 3D to 2D
// Calculates the view and projection matrices based on player location and orientation
// (The model matrix must be multiplied in separately. Voxel chunks are already in world
// coordinates, so they don't need one.)
module.exports = {
  updateMatrix: updateMatrix,
  getMatrix: getMatrix
}

// View, projection, and combined matrices
// Do all allocations upfront. There should be no dynamic memory allocations during rendering.
var vmat = mat4.create()
var pmat = mat4.create()
var mat = mat4.create()

// Calculates the combined projection and view matrix
function updateMatrix (context, props) {
  // First, figure out where the camera goes
  var dir = props.player.direction
  var loc = props.player.location
  var caltitude = Math.min(1, Math.max(-1, dir.altitude)) * 0.7
  var cdir = coordinates.toCartesian(dir.azimuth, caltitude, 1.0)
  var cloc
  switch (props.player.camera) {
    case 'first-person':
      cloc = [loc.x + 0.3 * cdir[0], loc.y + 0.3 * cdir[1], loc.z + 0.3 * cdir[2]]
      break
    case 'third-person':
      // TODO: add a collision check?
      // Currently, the camera can go inside nearby blocks in third-person view.
      var dist = Math.cos(caltitude) * 2 + 1
      cloc = [loc.x - dist * cdir[0], loc.y - dist * cdir[1], loc.z - cdir[2]]
      break
    default:
      throw new Error('unknown camera setting ' + props.player.camera)
  }

  // Then, make the view matrix
  mat4.identity(vmat)
  mat4.rotate(vmat, vmat, dir.altitude, [0, 1, 0])
  mat4.rotate(vmat, vmat, -dir.azimuth, [0, 0, 1])
  mat4.translate(vmat, vmat, [-cloc[0], -cloc[1], -cloc[2]])

  // Then, make the projection matrix
  var width = context.viewportWidth
  var height = context.viewportHeight
  mat4.perspective(pmat, 1, width / height, 0.1, 1000.0)

  // Rotate the coordinates. +Z is up here, id / Carmack style
  // Convert from a normal proj mat where +Y is up
  for (var i = 0; i < 4; i++) {
    var tmp = pmat[8 + i]
    pmat[8 + i] = pmat[4 + i]
    pmat[4 + i] = -pmat[i]
    pmat[i] = -tmp
  }

  // Multiply the projection and view matrices to get the camera matrix
  mat4.multiply(mat, pmat, vmat)

  return mat
}

// Gets the latest view matrix, projection matrix, or combined (multiplied)
function getMatrix (which) {
  if (which === 'view') return vmat
  else if (which === 'projection') return pmat
  else if (which === 'combined') return mat
  else throw new Error('unknown matrix ' + which)
}
