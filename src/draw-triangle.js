var shaders = require('./shaders')
var regl = require('./regl')

module.exports = regl({
  vert: shaders.vert.simple,
  frag: shaders.frag.color,
  attributes: {
    aVertexPosition: [[0, -1, 0], [-1, 0, 0], [1, 1, 0]],
    aVertexColor: [[0, 1, 0, 1], [0, 1, 1, 1], [0, 0, 1, 1]]
  },
  uniforms: {
    uMatrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
  },
  count: 3
})
