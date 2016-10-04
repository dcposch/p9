var shaders = require('./shaders')
var env = require('./env')
var mat4 = require('gl-mat4')

// Model-view, projection, and combined matrices
var mvmat = mat4.create()
var pmat = mat4.create()
var mat = mat4.create()

// Hello world. Draws a single colorful triangle.
module.exports = env.regl({
  vert: shaders.vert.simple,
  frag: shaders.frag.color,
  attributes: {
    aVertexPosition: [[0, -1, 0], [-1, 0, 0], [1, 1, 0]],
    aVertexColor: [[0, 1, 0, 1], [0, 1, 1, 1], [0, 0, 1, 1]]
  },
  uniforms: {
    uMatrix: function (context, props) {
      var dir = props.player.direction
      var loc = props.player.location
      mat4.identity(mvmat)
      mat4.rotate(mvmat, mvmat, dir.altitude, [1, 0, 0])
      mat4.rotate(mvmat, mvmat, dir.azimuth, [0, 0, 1])
      mat4.translate(mvmat, mvmat, [-loc.x, -loc.y, -loc.z])

      var width = context.viewportWidth
      var height = context.viewportHeight
      mat4.perspective(pmat, 1, width / height, 0.2, 4000.0)

      mat4.multiply(mat, pmat, mvmat)

      return mat
    }
  },
  count: 3
})
