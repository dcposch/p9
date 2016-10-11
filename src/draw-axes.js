var shaders = require('./shaders')
var env = require('./env')
var camera = require('./camera')

var R = 10

// Hello world.
// Draws pure R, G, and B tetrahedrons on the +X, +Y, and +Z axes
// Draws lighter red, green, and blue tetrahedrons on -X, -Y, and -Z
var verts = []
var colors = []
for (var i = 0; i < 6; i++) {
  var sign = i % 2 ? 1 : -1
  var axis = i >> 1 % 3
  var x = axis === 0 ? sign : 0
  var y = axis === 1 ? sign : 0
  var z = axis === 2 ? sign : 0
  var p1 = [x * R, y * R, z * R]
  var p2 = [x * R + x, y * R + y, z * R + z]
  var p3 = [x * R + y, y * R + z, z * R + x]
  var p4 = [x * R + z, y * R + x, z * R + y]

  // Draw a tetrahedron
  verts.push(p1, p2, p3)
  verts.push(p2, p3, p4)
  verts.push(p3, p4, p1)
  verts.push(p4, p1, p2)

  // Give it a solid color. +X is red: [1, 0, 0] direction, [1, 0, 0] color
  // Negative directions get a lighter color
  var min = i % 2 ? 0 : 0.5
  var r = axis === 0 ? 1 : min
  var g = axis === 1 ? 1 : min
  var b = axis === 2 ? 1 : min
  var color = [r, g, b, 1]
  for (var j = 0; j < 12; j++) colors.push(color)
}

module.exports = env.regl({
  vert: shaders.vert.colorWorld,
  frag: shaders.frag.color,
  attributes: {
    aVertexPosition: verts,
    aVertexColor: colors
  },
  uniforms: {
    uMatrix: camera.updateMatrix
  },
  count: 6 * 4 * 3 // Six directions, four triangles per tetrahedron, three verts per triangle
})
