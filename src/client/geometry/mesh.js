var validate = require('./validate')
var vec3 = require('gl-vec3')
var vec2 = require('gl-vec2')

module.exports = Mesh

// Represents an mesh: vertices, normals and texture UVs
// Format:
// - verts is an array of vec3s, which are just Float32Arrays of length 3
// - norms is an array of vec3s
// - uvs is an array of vec2s
function Mesh (verts, norms, uvs) {
  if (verts) validate(verts, 3)
  if (norms) validate(norms, 3)
  if (uvs) validate(uvs, 2)

  this.verts = verts || []
  this.norms = norms || []
  this.uvs = uvs || []

  var n = this.verts.length
  if (n % 3 !== 0) throw new Error('triangle mesh, n must be a multiple of 3')
  if (n !== this.norms.length) throw new Error('mesh must have same # of verts and norms')
  if (n !== this.uvs.length) throw new Error('mesh must have same # of verts and uvs')
}

Mesh.prototype.copy = function () {
  var verts = this.verts.map(vec3.clone)
  var norms = this.norms.map(vec3.clone)
  var uvs = this.uvs.map(vec2.clone)
  return new Mesh(verts, norms, uvs)
}

Mesh.combine = function (meshes) {
  var ret = new Mesh()
  meshes.forEach(function (mesh) {
    ret.verts.push(...mesh.verts)
    ret.norms.push(...mesh.norms)
    ret.uvs.push(...mesh.uvs)
  })
  return ret
}

// Transform (translate, rotate, scale) a mesh according to a matrix
Mesh.transform = function (output, input, mat, matNorm) {
  if (output.verts.length !== input.verts.length) {
    throw new Error('transform input and output meshes must be the same size')
  }
  var n = input.verts.length
  for (var i = 0; i < n; i++) {
    var vertIn = input.verts[i]
    var vertOut = output.verts[i]
    vec3.transformMat4(vertOut, vertIn, mat)

    // Rotate, but don't translate or scale the norms
    var normIn = input.norms[i]
    var normOut = output.norms[i]
    vec3.transformMat3(normOut, normIn, matNorm)
  }
}
