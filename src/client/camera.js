var mat4 = require('gl-mat4')

// Projects the world from 3D to 2D
// Calculates the view and projection matrices based on player location and orientation
// (The model matrix must be multiplied in separately. Voxel chunks are already in world
// coordinates, so they don't need one.)
module.exports = {
  updateMatrix: updateMatrix
}

// View, projection, and combined matrices
// Do all allocations upfront. There should be no dynamic memory allocations during rendering.
var vmat = mat4.create()
var pmat = mat4.create()
var mat = mat4.create()

// Calculates the combined projection and view matrix
function updateMatrix (context, props) {
  // First, make the view matrix
  var dir = props.player.direction
  var loc = props.player.location
  mat4.identity(vmat)
  mat4.rotate(vmat, vmat, dir.altitude, [0, 1, 0])
  mat4.rotate(vmat, vmat, -dir.azimuth, [0, 0, 1])
  mat4.translate(vmat, vmat, [-loc.x, -loc.y, -loc.z])

  // Then, make the projection matrix
  var width = context.viewportWidth
  var height = context.viewportHeight
  mat4.perspective(pmat, 1, width / height, 0.1, 1000.0)
  // Rotate the coordinates. +Z is up here, id style
  for (var i = 0; i < 4; i++) {
    var tmp = pmat[8 + i]
    pmat[8 + i] = pmat[4 + i]
    pmat[4 + i] = -pmat[i]
    pmat[i] = -tmp
  }

  // Multiply them together
  mat4.multiply(mat, pmat, vmat)

  return mat
}
