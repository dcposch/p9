var shaders = require('./shaders')
var env = require('./env')
var camera = require('./camera')

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
    uMatrix: camera.updateMatrix
  },
  count: 18
})
