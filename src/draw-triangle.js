var shaders = require('./shaders')
var env = require('./env')
var mat4 = require('gl-mat4')

// Model-view, projection, and combined matrices
// Do all allocations upfront. There should be no dynamic memory allocations during rendering.
var mvmat = mat4.create()
var pmat = mat4.create()
var mat = mat4.create()

// Hello world.
// Draws pure R, G, and B triangles on the +X, +Y, and +Z axes
// Draws lighter red, green, and blue triangles on -X, -Y, and -Z
module.exports = env.regl({
  vert: shaders.vert.simple,
  frag: shaders.frag.color,
  attributes: {
    aVertexPosition: [
      [10, 0, 0], [10, 1, 0], [10, 0, 1], // +X
      [-10, 0, 0], [-10, 1, 0], [-10, 0, 1],
      [0, 10, 0], [1, 10, 0], [0, 10, 1], // +Y
      [0, -10, 0], [1, -10, 0], [0, -10, 1],
      [0, 0, 10], [1, 0, 10], [0, 1, 10], // +Z
      [0, 0, -10], [1, 0, -10], [0, 1, -10]
    ],
    aVertexColor: [
      [1, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 1], // Red
      [1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1], [1, 0.5, 0.5, 1],
      [0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1], // Green
      [0.5, 1, 0.5, 1], [0.5, 1, 0.5, 1], [0.5, 1, 0.5, 1],
      [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], // Blue
      [0.5, 0.5, 1, 1], [0.5, 0.5, 1, 1], [0.5, 0.5, 1, 1]
    ]
  },
  uniforms: {
    uMatrix: computeMatrix
  },
  count: 18
})

// Calculates the combined projection and model-view matrix
function computeMatrix (context, props) {
  // First, make the model-view matrix.
  // Model is already in world coordinates, so just do the view:
  var dir = props.player.direction
  var loc = props.player.location
  mat4.identity(mvmat)
  mat4.rotate(mvmat, mvmat, dir.altitude, [0, 1, 0])
  mat4.rotate(mvmat, mvmat, -dir.azimuth, [0, 0, 1])
  mat4.translate(mvmat, mvmat, [-loc.x, -loc.y, -loc.z])

  // Then, make the projection matrix
  var width = context.viewportWidth
  var height = context.viewportHeight
  mat4.perspective(pmat, 1, width / height, 0.2, 4000.0)
  // Rotate the coordinates. +Z is up here, id style
  for (var i = 0; i < 4; i++) {
    var tmp = pmat[8 + i]
    pmat[8 + i] = pmat[4 + i]
    pmat[4 + i] = -pmat[i]
    pmat[i] = -tmp
  }

  // Multiply them together
  mat4.multiply(mat, pmat, mvmat)

  return mat
}
