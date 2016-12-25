var test = require('tape')
var mat4 = require('gl-mat4')
var mat3 = require('gl-mat3')
var Mesh = require('../src/client/geometry/mesh')

var verts = [[1, 2, 3], [1, 0, 0], [0, 0, 0]]
var norms = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
var uvs = [[0, 0], [0, 1], [1, 1]]

test('empty mesh', function (t) {
  var mesh = new Mesh()
  t.deepEqual(mesh.verts, [])
  t.deepEqual(mesh.norms, [])
  t.deepEqual(mesh.uvs, [])
  t.end()
})

test('create a mesh', function (t) {
  var mesh = new Mesh(verts, norms, uvs)
  t.equal(mesh.verts, verts)
  t.equal(mesh.norms, norms)
  t.equal(mesh.uvs, uvs)
  t.end()
})

test('clone a mesh', function (t) {
  var m1 = new Mesh(verts, norms, uvs)
  var m2 = m1.clone()
  t.notEqual(m2.verts, m1.verts)
  t.notEqual(m2.norms, m1.norms)
  t.notEqual(m2.uvs, m1.uvs)
  t.deepEqual(m2.verts, m1.verts)
  t.deepEqual(m2.norms, m1.norms)
  t.deepEqual(m2.uvs, m1.uvs)
  t.end()
})

test('invalid args', function (t) {
  t.throws(function () {
    t.notOk(new Mesh(verts, norms))
  })
  t.throws(function () {
    t.notOk(new Mesh(verts.slice(1), norms.slice(1), uvs.slice(1)))
  }, 'triangle mesh, n must be a multiple of three')
  t.throws(function () {
    t.notOk(new Mesh(verts, norms, [].concat(uvs, uvs)))
  }, 'number of verts, norms, and uvs must match')
  t.end()
})

test('transform', function (t) {
  var mesh = new Mesh(verts, norms, uvs)
  var mat = mat4.create()
  var matN = mat3.create()

  // Move and rotate the mesh
  mat4.translate(mat, mat, [10, 0, 0])
  mat4.rotateZ(mat, mat, Math.PI / 2)
  mat3.rotate(matN, matN, Math.PI / 2)

  Mesh.transform(mesh, mesh, mat, matN)

  approxEqual(t, mesh.verts, [[8, 1, 3], [10, 1, 0], [10, 0, 0]])
  approxEqual(t, mesh.norms, [[0, 1, 0], [-1, 0, 0], [0, 0, 1]])
  t.deepEqual(mesh.uvs, uvs)
  t.end()
})

function approxEqual (t, a, b) {
  var n = a.length
  t.equal(n, b.length)
  for (var i = 0; i < n; i++) {
    if (Array.isArray(a[i])) {
      approxEqual(t, a[i], b[i])
    } else if (Math.abs(a[i] - b[i]) > 1e-10) {
      return t.fail('values differ too much: ' + JSON.stringify(a) + ' and ' + JSON.stringify(b))
    }
  }
}
