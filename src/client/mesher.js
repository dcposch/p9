var env = require('./env')
var config = require('../config')
var vox = require('../vox')
var vec3 = {
  create: require('gl-vec3/create'),
  set: require('gl-vec3/set'),
  add: require('gl-vec3/add'),
  multiply: require('gl-vec3/multiply'),
  scale: require('gl-vec3/scale'),
  scaleAndAdd: require('gl-vec3/scaleAndAdd')
}
var vec2 = {
  create: require('gl-vec2/create'),
  copy: require('gl-vec2/copy')
}

// Meshes and renders voxels chunks
module.exports = {
  meshWorld: meshWorld,
  meshChunk: meshChunk
}

var CB = config.CHUNK_BITS
var CS = config.CHUNK_SIZE
var CS3 = CS * CS * CS
var ZEROS = new Uint8Array(CS3)

// Variables for meshWorld
var MAX_QUADS_PER_RUN = 1000
// Maps chunk key to int. Dirty chunks: 3. Adjacent chunks to remesh lazily: 1
var chunkPriority = {}
// Maps chunk key to Uint8Array, unpacked flat voxel arrays.
var chunkCache = {}
// Keep track of which blocks in the chunk we've meshed
var meshed = new Uint8Array(CS3)
// Mesh opaque (or binary-transparent) quads and translucent quads separately
var builder = new MeshBuilder()
var builderTrans = new MeshBuilder()

function MeshBuilder () {
  this.verts = new Float32Array(CS3 * 3)
  this.normals = new Float32Array(CS3 * 3)
  this.uvs = new Float32Array(CS3 * 2)

  this.ivert = 0
  this.inormal = 0
  this.iuv = 0
}

MeshBuilder.prototype.addVert = function (x, y, z) {
  this.verts[this.ivert] = x
  this.verts[this.ivert + 1] = y
  this.verts[this.ivert + 2] = z
  this.ivert += 3
}

MeshBuilder.prototype.addNormal = function (x, y, z) {
  this.normals[this.inormal] = x
  this.normals[this.inormal + 1] = y
  this.normals[this.inormal + 2] = z
  this.inormal += 3
}

MeshBuilder.prototype.addUV = function (u, v) {
  this.uvs[this.iuv] = u
  this.uvs[this.iuv + 1] = v
  this.iuv += 2
}

MeshBuilder.prototype.createMesh = function () {
  var count = this.ivert / 3
  if (count === 0) return null
  return {
    count: count,
    verts: env.regl.buffer(new Float32Array(this.verts.buffer, 0, count * 3)),
    normals: env.regl.buffer(new Float32Array(this.normals.buffer, 0, count * 3)),
    uvs: env.regl.buffer(new Float32Array(this.uvs.buffer, 0, count * 2))
  }
}

MeshBuilder.prototype.reset = function () {
  this.ivert = 0
  this.inormal = 0
  this.iuv = 0
}

// Current quad corner, edges, normal, uv, and which voxel we're drawing
var v0 = vec3.create()
var v1 = vec3.create()
var v2 = vec3.create()
var vnorm = vec3.create()
var vuv = vec2.create()
var vvox = 0

// Meshes dirty chunks. Schedules chunks for meshing based on a priority algorithm.
function meshWorld (world, loc) {
  var startMs = new Date().getTime()

  // Find chunks that need to be meshed
  world.chunks.forEach(function (c) {
    // If a chunk is too far away to draw, don't mesh it
    // If it's even further than that, unload from GPU
    var maxDraw = config.GRAPHICS.CHUNK_DRAW_RADIUS * CS
    var d2 = getDistSquared(c, loc)
    if (d2 > maxDraw * maxDraw * 2 && !c.dirty) {
      c.dirty = true
      c.destroyMesh()
      delete chunkCache[c.getKey()]
    }
    if (d2 > maxDraw * maxDraw) return

    if (!c.dirty) return
    c.dirty = false

    // Remesh the dirty chunks ASAP
    var key = c.getKey()
    chunkPriority[key] = 3
    delete chunkCache[key]

    // Remesh adjacent chunks soon
    chunkPriority[[c.x + CS, c.y, c.z].join(',')] |= 1
    chunkPriority[[c.x - CS, c.y, c.z].join(',')] |= 1
    chunkPriority[[c.x, c.y + CS, c.z].join(',')] |= 1
    chunkPriority[[c.x, c.y - CS, c.z].join(',')] |= 1
    chunkPriority[[c.x, c.y, c.z + CS].join(',')] |= 1
    chunkPriority[[c.x, c.y, c.z - CS].join(',')] |= 1
  })

  // Find the ones highest priority and closest to the player
  var chunksToMesh = []
  Object.keys(chunkPriority)
    .forEach(function (key) {
      var chunk = world.chunkTable[key]
      if (!chunk) {
        delete chunkPriority[key]
        return
      }
      var d2 = getDistSquared(chunk, loc)
      chunksToMesh.push({priority: chunkPriority[key], chunk: chunk, d2: d2})
    })
  if (chunksToMesh.length === 0) return // Nothing to do

  chunksToMesh.sort(function (a, b) {
    var dPriority = b.priority - a.priority // Largest priority first
    if (dPriority !== 0) return dPriority
    return a.d2 - b.d2 // Smallest distance first
  })

  // Limit how many chunks we'll remesh per frame so we can keep our fps solid
  var numQuads = 0
  for (var i = 0; i < chunksToMesh.length; i++) {
    numQuads += chunksToMesh[i].chunk.length >> 3
    if (numQuads > MAX_QUADS_PER_RUN) chunksToMesh.length = i + 1
  }

  // Mesh
  var counts = [0, 0, 0, 0]
  chunksToMesh.forEach(function (obj) {
    counts[obj.priority]++
    meshChunk(obj.chunk, world)
    delete chunkPriority[obj.chunk.getKey()]
  })
  var meshMs = new Date().getTime()

  // Initial load. Tested on a 2016 12" Macbook running on half battery:
  // Baseline: Meshed 895 chunks, remeshed 0 in 591ms <always ~600>, 152517 checks 40m quads visited
  // Planes: Meshed 895 chunks, remeshed 0 in 397ms <always ~400>, 152517 checks 7m quads visited
  // SAT: Meshed 895 + 0 in 412ms, preproc 144 in 223ms, 110 checks 0m quads visited
  // SAT >100: Meshed 895 + 0 in 371ms, preproc 117 in 207ms, 9594 checks 1m quads visited
  console.log('Meshed %d + %d in %dms', counts[3], counts[1], meshMs - startMs)
}

// Convert list of quads to flat array of voxels
// Cache unpacked chunk contents
// Postcondition: chunkCache[chunk.getKey()] will be there
function unpack (chunk) {
  if (!chunk.packed) throw new Error('chunk must be packed')
  var data = chunk.data
  var n = chunk.length

  var key = chunk.getKey()
  if (n === 0) {
    chunkCache[key] = ZEROS
    return
  }

  var voxels = chunkCache[key]
  if (!voxels) {
    voxels = chunkCache[key] = new Uint8Array(CS * CS * CS) // 64KB per block... fail
  } else {
    voxels.fill(0)
  }

  // Mark each quad
  for (var ci = 0; ci < n; ci++) {
    var index = ci * 8
    var x0 = data[index]
    var y0 = data[index + 1]
    var z0 = data[index + 2]
    var x1 = data[index + 3]
    var y1 = data[index + 4]
    var z1 = data[index + 5]
    var v = data[index + 6]
    for (var x = x0; x < x1; x++) {
      for (var y = y0; y < y1; y++) {
        for (var z = z0; z < z1; z++) {
          voxels[(x << CB << CB) + (y << CB) + z] = v
        }
      }
    }
  }
}

// Meshes a chunk, exposed surfaces only, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
function meshChunk (chunk, world) {
  chunk.destroyMesh()
  if (!chunk.data) return
  if (!chunk.packed) throw new Error('must pack chunk before meshing')
  if (!chunk.length) return

  // Fills 'verts', 'normals', and 'uvs'
  builder.reset()
  builderTrans.reset()
  meshBuffers(chunk, world)

  chunk.mesh = {
    opaque: builder.createMesh(),
    trans: builderTrans.createMesh()
  }
}

function getVoxels (chunk) {
  if (!chunk) return null
  var key = chunk.getKey()
  if (!chunkCache[key]) unpack(chunk)
  return chunkCache[key]
}

// Profiling shows that this is the most critical path.
// May run hundreds of times in a single frame, allocating 1000+ WebGL buffers
function meshBuffers (chunk, world) {
  meshed.fill(0)

  // Get unpacked (flat) arrays for both this chunk and neighbors in +X, +Y, and +Z
  var voxels = getVoxels(chunk)
  var neighbors = new Array(3)
  for (var side = 0; side < 3; side++) {
    var nx = (side === 0) ? (chunk.x + CS) : chunk.x
    var ny = (side === 1) ? (chunk.y + CS) : chunk.y
    var nz = (side === 2) ? (chunk.z + CS) : chunk.z
    neighbors[side] = getVoxels(world.getChunk(nx, ny, nz))
  }

  // Loop thru this chunk, create quads everywhere one voxel type meets another that's seethru
  var data = chunk.data
  var n = chunk.length
  for (var index = 0; index <= n; index += 8) {
    var x0, y0, z0, x1, y1, z1
    if (index === n) {
      x0 = 0
      y0 = 0
      z0 = 0
      x1 = CS
      y1 = CS
      z1 = CS
    } else {
      x0 = data[index]
      y0 = data[index + 1]
      z0 = data[index + 2]
      x1 = data[index + 3]
      y1 = data[index + 4]
      z1 = data[index + 5]
    }

    for (var x = x0; x < x1; x++) {
      for (var y = y0; y < y1; y++) {
        if (z0 > 0 && meshQuad(chunk, x, y, z0 - 1, 2, voxels, neighbors)) addQuad()
        if (meshQuad(chunk, x, y, z1 - 1, 2, voxels, neighbors)) addQuad()
      }
    }
    for (x = x0; x < x1; x++) {
      for (var z = z0; z < z1; z++) {
        if (y0 > 0 && meshQuad(chunk, x, y0 - 1, z, 1, voxels, neighbors)) addQuad()
        if (meshQuad(chunk, x, y1 - 1, z, 1, voxels, neighbors)) addQuad()
      }
    }
    for (y = y0; y < y1; y++) {
      for (z = z0; z < z1; z++) {
        if (x0 > 0 && meshQuad(chunk, x0 - 1, y, z, 0, voxels, neighbors)) addQuad()
        if (meshQuad(chunk, x1 - 1, y, z, 0, voxels, neighbors)) addQuad()
      }
    }
  }
}

// Uses the parameters already set in v0, v1, v2, vnorm, anv vuv to add a single quad
// Appends the quad to vertex, normal, and UV buffers
function addQuad () {
  var b = vox.isTranslucent(vvox) ? builderTrans : builder
  b.addVert(v0[0], v0[1], v0[2])
  b.addVert(v0[0] + v1[0], v0[1] + v1[1], v0[2] + v1[2])
  b.addVert(v0[0] + v2[0], v0[1] + v2[1], v0[2] + v2[2])
  b.addVert(v0[0] + v2[0], v0[1] + v2[1], v0[2] + v2[2])
  b.addVert(v0[0] + v1[0], v0[1] + v1[1], v0[2] + v1[2])
  b.addVert(v0[0] + v1[0] + v2[0], v0[1] + v1[1] + v2[1], v0[2] + v1[2] + v2[2])
  for (var i = 0; i < 6; i++) {
    b.addNormal(vnorm[0], vnorm[1], vnorm[2])
    b.addUV(vuv[0], vuv[1])
  }
}

// Checks whether we need to draw a quad for the given face of block (x, y, z)
// If so, sets the quad parameters v0, v1, v2, vnorm, vuv and returns true
// If not, returns false. Pass side = 0 for the +X face, 1 for +Y, 2 for +Z
function meshQuad (chunk, x, y, z, side, voxels, neighbors) {
  // Check if we've already meshed this face
  var m = meshed[(x << CB << CB) | (y << CB) | z]
  if (m & (1 << side)) return false

  // Get the two voxels on each side of this face: v at (x, y, z), n at neighboring block
  var cs1 = CS - 1
  var v = voxels[(x << CB << CB) | (y << CB) | z]
  var nx = (side === 0) ? (x + 1) : x
  var ny = (side === 1) ? (y + 1) : y
  var nz = (side === 2) ? (z + 1) : z
  var voxelsn = voxels
  if ((nx & ~cs1) || (ny & ~cs1) || (nz & ~cs1)) {
    nx &= cs1
    ny &= cs1
    nz &= cs1
    voxelsn = neighbors[side]
  }
  var n = voxelsn ? voxelsn[(nx << CB << CB) | (ny << CB) | nz] : -1

  // If this face is between two of the same voxel type, or between two opaque blocks, don't render
  if (n === v || n < 0 || (vox.isOpaque(v) && vox.isOpaque(n))) return false

  // Unit vectors normal to the face (u0) and parallel (u1 and u2)
  var u0 = new Int32Array([side === 0 ? 1 : 0, side === 1 ? 1 : 0, side === 2 ? 1 : 0])
  var u1 = new Int32Array([side === 0 ? 0 : 1, side === 0 ? 1 : 0, 0])
  var u2 = new Int32Array([0, side === 2 ? 1 : 0, side === 2 ? 0 : 1])

  // Current voxel, current neighbor, and their locations
  var voxc, voxn
  var locc = new Int32Array([x, y, z])
  var locn = new Int32Array([nx, ny, nz])
  meshed[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]] |= (1 << side)

  // Greedily expand to largest possible strip
  for (var stripLength = 1; ; stripLength++) {
    vec3.add(locc, locc, u1)
    vec3.add(locn, locn, u1)
    if ((locc[0] & ~cs1) || (locc[1] & ~cs1) || (locc[2] & ~cs1)) break
    voxc = voxels[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]]
    voxn = voxelsn ? voxelsn[(locn[0] << CB << CB) | (locn[1] << CB) | locn[2]] : -1
    m = meshed[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]]
    if (voxc !== v || voxn !== n || (m & (1 << side))) break
    meshed[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]] |= (1 << side)
  }

  // From there, greedily expand to largest possible quad
  for (var stripWidth = 1; ; stripWidth++) {
    vec3.scaleAndAdd(locc, [x, y, z], u2, stripWidth)
    vec3.scaleAndAdd(locn, [nx, ny, nz], u2, stripWidth)
    if ((locc[0] & ~cs1) || (locc[1] & ~cs1) || (locc[2] & ~cs1)) break
    var match = true
    for (var i = 0; i < stripLength; i++) {
      vec3.scaleAndAdd(locc, [x, y, z], u2, stripWidth)
      vec3.scaleAndAdd(locn, [nx, ny, nz], u2, stripWidth)
      vec3.scaleAndAdd(locc, locc, u1, i)
      vec3.scaleAndAdd(locn, locn, u1, i)
      voxc = voxels[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]]
      voxn = voxelsn ? voxelsn[(locn[0] << CB << CB) | (locn[1] << CB) | locn[2]] : -1
      m = [(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]]
      if (voxc !== v || voxn !== n || (m & (1 << side))) {
        match = false
        break
      }
    }
    if (!match) break
    for (i = 0; i < stripLength; i++) {
      vec3.scaleAndAdd(locc, [x, y, z], u2, stripWidth)
      vec3.scaleAndAdd(locc, locc, u1, i)
      meshed[(locc[0] << CB << CB) | (locc[1] << CB) | locc[2]] |= (1 << side)
    }
  }

  // Add verts, norms, uvs
  vec3.add(v0, [chunk.x + x, chunk.y + y, chunk.z + z], u0)
  vec3.scale(v1, u1, stripLength)
  vec3.scale(v2, u2, stripWidth)

  var showN
  if (vox.isOpaque(v) && !vox.isOpaque(n)) showN = false
  else if (!vox.isOpaque(v) && vox.isOpaque(n)) showN = true
  else showN = v < n
  vec3.scale(vnorm, u0, showN ? -1 : 1)

  var vtype = showN ? vox.TYPES[n] : vox.TYPES[v]
  if (side === 2) vec2.copy(vuv, showN ? vtype.uv.bottom : vtype.uv.top)
  else vec2.copy(vuv, vtype.uv.side)

  vvox = showN ? n : v

  return true
}

function getDistSquared (a, b) {
  var dx = a.x - b.x
  var dy = a.y - b.y
  var dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}
