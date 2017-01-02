var regl = require('../env').regl
var shaders = require('../shaders')
var textures = require('../textures')
var Poly8 = require('../geometry/poly8')
var Mesh = require('../geometry/mesh')
var coordinates = require('../geometry/coordinates')
var config = require('../../config')
var mat4 = {
  create: require('gl-mat4/create'),
  identity: require('gl-mat4/identity'),
  translate: require('gl-mat4/translate'),
  rotateX: require('gl-mat4/rotateX'),
  rotateY: require('gl-mat4/rotateY'),
  rotateZ: require('gl-mat4/rotateZ'),
  scale: require('gl-mat4/scale')
}
var mat3 = {
  create: require('gl-mat3/create')
}

module.exports = Player

// Matrices to translate, rotate, and scale each model
var mat = mat4.create()
var matN = mat3.create()

// Scale factor from model to world coordinates
var SCALE = config.PLAYER_HEIGHT / 28

// Mesh templates. Every individual player mesh is a copy of the template
var meshParts = {
  head: axisAligned(-4, -4, -4, 8, 8, 8, 0, 0),
  body: axisAligned(-2, -4, -16, 4, 8, 12, 16, 16),
  armR: axisAligned(-2, -8, -16, 4, 4, 12, 40, 16),
  armL: axisAligned(-2, 4, -16, 4, 4, 12, 32, 48),
  legR: axisAligned(-2, -4, -28, 4, 4, 12, 0, 16),
  legL: axisAligned(-2, 0, -28, 4, 4, 12, 16, 48)
}

var meshTemplate = makeMesh()

// Vertex positions and normals vary from player to player, but UVs are shared
var bufferUVs = regl.buffer(meshTemplate.uvs)

function Player (name) {
  // Common to all objects
  this.type = 'player'
  this.key = null
  this.location = {x: 0, y: 0, z: 0}
  this.velocity = {x: 0, y: 0, z: 0}

  // Specific to Player
  this.props = {
    name: null,
    direction: {azimuth: 0, altitude: 0},
    situation: 'airborne',
    walk: 0
  }

  this.bones = {
    head: {rot: [0, 0, 0], center: [0, 0, 0]},
    armL: {rot: [0, 0, 0], center: [0, 4, -4]},
    armR: {rot: [0, 0, 0], center: [0, -4, -4]},
    legL: {rot: [0, 0, 0], center: [0, 2, -16]},
    legR: {rot: [0, 0, 0], center: [0, -2, -16]}
  }

  this.mesh = meshTemplate.clone()

  // Allocate buffers once, update the contents each frame
  // Usage stream lets WebGL know we'll be updating the buffers often.
  this.buffers = {
    verts: regl.buffer({usage: 'stream', data: this.mesh.verts}),
    norms: regl.buffer({usage: 'stream', data: this.mesh.norms})
  }
}

Player.prototype.intersect = function (aabb) {
  return false // TODO
}

Player.prototype.tick = function (dt) {
  var vel = this.velocity
  var props = this.props
  var cdir = coordinates.toCartesian(props.direction.azimuth, 0, 1)

  // Update bones
  var dStand = 0.15
  var forwardSpeed = cdir[0] * vel.x + cdir[1] * vel.y
  if (Math.abs(forwardSpeed) < 1) {
    // Stand
    if (props.walk < Math.PI && props.walk > dStand) props.walk -= dStand
    else if (props.walk > Math.PI && props.walk < 2 * Math.PI - dStand) props.walk += dStand
  } else {
    // Walk
    var dWalk = forwardSpeed * dt * 1.5
    props.walk = (props.walk + dWalk + 2 * Math.PI) % (2 * Math.PI)
  }

  var legAngle = Math.sin(props.walk)
  this.bones.legL.rot[1] = -legAngle
  this.bones.legR.rot[1] = legAngle
  this.bones.legL.center[0] = legAngle > 0 ? -2 : 2
  this.bones.legR.center[0] = legAngle < 0 ? -2 : 2

  this.bones.armL.rot[1] = Math.sin(props.walk)
  this.bones.armR.rot[1] = -Math.sin(props.walk)

  // Look
  this.bones.head.rot[1] = Math.min(1, Math.max(-1, -props.direction.altitude))
}

Player.prototype.draw = function () {
  var loc = this.location
  var azimuth = this.props.direction.azimuth
  var altitude = 0 // Player head moves, body stays level

  // Update the mesh
  // TODO: do this in a vert shader using ANGLE_instanced_array?
  Mesh.copyPart(this.mesh, meshParts.body)
  moveBone(this.mesh, meshParts.head, this.bones.head)
  moveBone(this.mesh, meshParts.armL, this.bones.armL)
  moveBone(this.mesh, meshParts.armR, this.bones.armR)
  moveBone(this.mesh, meshParts.legL, this.bones.legL)
  moveBone(this.mesh, meshParts.legR, this.bones.legR)

  mat4.identity(mat)
  mat4.translate(mat, mat, [loc.x, loc.y, loc.z])
  mat4.rotateZ(mat, mat, azimuth)
  mat4.rotateY(mat, mat, -altitude)
  mat4.scale(mat, mat, [SCALE, SCALE, SCALE])
  Mesh.transform(this.mesh, this.mesh, mat, matN)

  // Update buffers
  this.buffers.verts.subdata(this.mesh.verts)
  this.buffers.norms.subdata(this.mesh.norms)

  drawCommand({player: this})
}

Player.prototype.destroy = function () {
  this.buffers.verts.destroy()
  this.buffers.norms.destroy()
}

var drawCommand = regl({
  frag: shaders.frag.texture,
  vert: shaders.vert.uvWorld,
  attributes: {
    aPosition: function (context, props) { return props.player.buffers.verts },
    aNormal: function (context, props) { return props.player.buffers.norms },
    aUV: bufferUVs
  },
  uniforms: {
    uTexture: function () { return textures.loaded.player }
  },
  count: meshTemplate.verts.length
})

function moveBone (mesh, part, bone) {
  var c = bone.center
  mat4.identity(mat)
  mat4.translate(mat, mat, c)
  mat4.rotateX(mat, mat, bone.rot[0])
  mat4.rotateY(mat, mat, bone.rot[1])
  mat4.rotateZ(mat, mat, bone.rot[2])
  mat4.translate(mat, mat, [-c[0], -c[1], -c[2]])
  Mesh.transformPart(mesh, part, mat, matN, part.offset)
}

function makeMesh () {
  var meshes = [
    meshParts.head,
    meshParts.body,
    meshParts.armL,
    meshParts.armR,
    meshParts.legL,
    meshParts.legR
  ]
  return Mesh.combine(meshes)
}

// Add a cuboid by x, y, z, width, depth, and height, and integer UV
// Follows the Minecraft texture layout. See
// http://papercraft.robhack.com/various_finds/Mine/texture_templates/mob/spider.png
function axisAligned (x, y, z, w, d, h, u, v) {
  var uvs = getUVs(x, y, z, w, d, h, u, v, 64, 64)
  return Poly8.axisAligned(x, y, z, x + w, y + d, z + h, uvs).createMesh()
}

function getUVs (x, y, z, w, d, h, u, v, tw, th) {
  function makeUV (iu, iv, iw, ih, rot) {
    var u0 = iu / tw
    var v0 = iv / th
    var u1 = (iu + iw) / tw
    var v1 = (iv + ih) / th
    if (rot) return [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]
    else return [[u0, v0], [u0, v1], [u1, v0], [u1, v1]]
  }
  return [
    makeUV(u + 2 * w + 2 * d, v + w + h, -d, -h), // x0 face: back
    makeUV(u + w, v + w + h, d, -h), // x1 face: front
    makeUV(u, v + w + h, w, -h), // y0 face: right
    makeUV(u + 2 * w + d, v + w + h, -w, -h), // y1 face: left
    makeUV(u + w + d, v, d, w, true), // z0 face: bottom
    makeUV(u + w, v, d, w, true) // z1 face: top
  ]
}
