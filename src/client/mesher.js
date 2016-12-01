var env = require('./env')
var config = require('../config')
var vox = require('../vox')

// Meshes and renders voxels chunks
module.exports = {
  meshWorld: meshWorld,
  meshChunk: meshChunk
}

// Working memory for meshChunk. Allocate once.
var CS = config.CHUNK_SIZE
var CS3 = CS * CS * CS
var verts = new Float32Array(CS3 * 3)
var normals = new Float32Array(CS3 * 3)
var uvs = new Float32Array(CS3 * 2)

// Variables for meshWorld
var MAX_REMESH_CHUNKS = 6
var mapToMesh = {}

// Meshes all dirty chunks in the visible world, and lazily remeshes adjacent chunks
function meshWorld (world) {
  var startMs = new Date().getTime()

  // Mesh
  var dirtyChunks = world.chunks.filter(function (chunk) {
    return (chunk.data && !chunk.mesh) || chunk.dirty
  })
  dirtyChunks.forEach(function (c) {
    // Mesh chunk now
    meshChunk(c, world)
    // Remesh adjacent chunks soon
    mapToMesh[[c.x + CS, c.y, c.z].join(',')] = true
    mapToMesh[[c.x - CS, c.y, c.z].join(',')] = true
    mapToMesh[[c.x, c.y + CS, c.z].join(',')] = true
    mapToMesh[[c.x, c.y - CS, c.z].join(',')] = true
    mapToMesh[[c.x, c.y, c.z + CS].join(',')] = true
    mapToMesh[[c.x, c.y, c.z - CS].join(',')] = true
  })
  // Don't remesh the dirty chunks themselves, those are already done
  dirtyChunks.forEach(function (c) {
    delete mapToMesh[[c.x, c.y, c.z].join(',')]
  })

  // Quit if there's nothing new to do
  var keysToMesh = Object.keys(mapToMesh)
  if (dirtyChunks.length === 0 && keysToMesh.length === 0) return

  // Remesh chunks
  var numRemeshed = 0
  for (var i = 0; i < keysToMesh.length; i++) {
    var key = keysToMesh[i]
    var coords = key.split(',').map(Number)
    var chunk = world.getChunk(coords[0], coords[1], coords[2])
    if (chunk) {
      meshChunk(chunk, world)
      numRemeshed++
    }
    delete mapToMesh[key]
    if (numRemeshed >= MAX_REMESH_CHUNKS) break
  }

  var elapsedMs = new Date().getTime() - startMs
  console.log('Meshed %d chunks, remeshed %d in %dms', dirtyChunks.length, numRemeshed, elapsedMs)
}

// Meshes a chunk, exposed surfaces only, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
function meshChunk (chunk, world) {
  if (!chunk.data) return
  if (!chunk.packed) throw new Error('must pack chunk before meshing')

  chunk.dirty = false
  if (chunk.mesh) chunk.mesh.destroy()

  // Fills 'verts', 'normals', and 'uvs'
  var count = meshBuffers(chunk, world)

  chunk.mesh = {
    verts: env.regl.buffer(verts, count * 3),
    normals: env.regl.buffer(normals, count * 3),
    uvs: env.regl.buffer(uvs, count * 2),
    count: count,
    destroy: destroy
  }
}

function meshBuffers (chunk, world) {
  var data = chunk.data
  var ivert = 0
  var inormal = 0
  var iuv = 0
  var i

  // Loop thru the packed representation (list of quads)
  for (var index = 0; index < chunk.length; index += 8) {
    var x0 = chunk.x + data[index]
    var y0 = chunk.y + data[index + 1]
    var z0 = chunk.z + data[index + 2]
    var x1 = chunk.x + data[index + 3]
    var y1 = chunk.y + data[index + 4]
    var z1 = chunk.z + data[index + 5]
    var v = data[index + 6]

    // Get uvs, etc
    var voxType = vox.TYPES[v]
    if (!voxType) throw new Error('unsupported voxel type ' + v)
    var sideOffset = voxType.sideOffset || 0

    // Add the six faces (12 tris total) for the quad
    for (var fside = 0; fside <= 1; fside++) {
      // Figure out which faces we need to draw
      var dir = fside ? 1 : -1
      var xface = fside ? (x1 - sideOffset) : (x0 + sideOffset)
      var yface = fside ? (y1 - sideOffset) : (y0 + sideOffset)
      var zface = fside ? z1 : z0
      var drawX = check(world, v, fside ? x1 : (x0 - 1), y0, z0, fside ? (x1 + 1) : x0, y1, z1)
      var drawY = check(world, v, x0, fside ? y1 : (y0 - 1), z0, x1, fside ? (y1 + 1) : y0, z1)
      var drawZ = check(world, v, x0, y0, fside ? z1 : (z0 - 1), x1, y1, fside ? (z1 + 1) : z0)

      // add vertices
      if (drawX) {
        ivert += addXYZ(verts, ivert, xface, y0, z0)
        ivert += addXYZ(verts, ivert, xface, y1, z0)
        ivert += addXYZ(verts, ivert, xface, y0, z1)
        ivert += addXYZ(verts, ivert, xface, y0, z1)
        ivert += addXYZ(verts, ivert, xface, y1, z0)
        ivert += addXYZ(verts, ivert, xface, y1, z1)
      }

      if (drawY) {
        ivert += addXYZ(verts, ivert, x0, yface, z0)
        ivert += addXYZ(verts, ivert, x1, yface, z0)
        ivert += addXYZ(verts, ivert, x0, yface, z1)
        ivert += addXYZ(verts, ivert, x0, yface, z1)
        ivert += addXYZ(verts, ivert, x1, yface, z0)
        ivert += addXYZ(verts, ivert, x1, yface, z1)
      }

      if (drawZ) {
        ivert += addXYZ(verts, ivert, x0, y0, zface)
        ivert += addXYZ(verts, ivert, x1, y0, zface)
        ivert += addXYZ(verts, ivert, x0, y1, zface)
        ivert += addXYZ(verts, ivert, x0, y1, zface)
        ivert += addXYZ(verts, ivert, x1, y0, zface)
        ivert += addXYZ(verts, ivert, x1, y1, zface)
      }

      // Add normals
      if (drawX) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, dir, 0, 0)
      if (drawY) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, dir, 0)
      if (drawZ) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, 0, dir)

      // Add texture atlas UVs
      var uvxy = voxType.uv.side
      var uvz = fside === 1 ? voxType.uv.top : voxType.uv.bottom
      if (drawX) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvxy)
      if (drawY) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvxy)
      if (drawZ) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvz)
    }
  }

  // Returns the number of vertices created
  return ivert / 3
}

// Checks whether there are any seethru blocks in a given 3D quad *other than* vCompare
function check (world, vCompare, x0, y0, z0, x1, y1, z1) {
  for (var x = x0; x < x1; x++) {
    for (var y = y0; y < y1; y++) {
      for (var z = z0; z < z1; z++) {
        var v = world.getVox(x, y, z)
        if (v === vCompare) continue
        if (v === vox.INDEX.AIR || v === vox.INDEX.WATER || v < 0) return true
      }
    }
  }
  return false
}

function addXYZ (arr, i, a, b, c) {
  arr[i] = a
  arr[i + 1] = b
  arr[i + 2] = c
  return 3
}

function addUV (arr, i, uv) {
  arr[i] = uv[0]
  arr[i + 1] = uv[1]
  return 2
}

function destroy () {
  this.verts.destroy()
  this.normals.destroy()
  this.uvs.destroy()
}
