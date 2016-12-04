var env = require('./env')
var config = require('../config')
var vox = require('../vox')

// Meshes and renders voxels chunks
module.exports = {
  meshWorld: meshWorld,
  meshChunk: meshChunk
}

// Variables for meshChunk. Allocate once.
var CB = config.CHUNK_BITS
var CS = config.CHUNK_SIZE
var CS3 = CS * CS * CS
var verts = new Float32Array(CS3 * 3)
var normals = new Float32Array(CS3 * 3)
var uvs = new Float32Array(CS3 * 2)
var checked = new Uint8Array(CS * CS)

// Variables for meshWorld
var MAX_REMESH_CHUNKS = 6
var chunksToMesh = {}
var chunkTransparency = {}
var numChecks = 0
var numQuadsVisited = 0
var numPreproc = 0

// Meshes all dirty chunks in the visible world, and lazily remeshes adjacent chunks
function meshWorld (world) {
  var startMs = new Date().getTime()

  // Find chunks that need to be meshed
  var dirtyChunks = world.chunks.filter(function (chunk) {
    return (chunk.data && !chunk.mesh) || chunk.dirty
  })

  // Preprocess for performance
  dirtyChunks.forEach(markTransparency)
  var preprocessMs = new Date().getTime()

  // Mesh
  dirtyChunks.forEach(function (c) {
    // Mesh chunk now
    meshChunk(c, world)
    // Remesh adjacent chunks soon
    chunksToMesh[[c.x + CS, c.y, c.z].join(',')] = true
    chunksToMesh[[c.x - CS, c.y, c.z].join(',')] = true
    chunksToMesh[[c.x, c.y + CS, c.z].join(',')] = true
    chunksToMesh[[c.x, c.y - CS, c.z].join(',')] = true
    chunksToMesh[[c.x, c.y, c.z + CS].join(',')] = true
    chunksToMesh[[c.x, c.y, c.z - CS].join(',')] = true
  })
  // Don't remesh the dirty chunks themselves, those are already done
  dirtyChunks.forEach(function (c) {
    delete chunksToMesh[[c.x, c.y, c.z].join(',')]
  })

  // Quit if there's nothing new to do
  var keysToMesh = Object.keys(chunksToMesh)
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
    delete chunksToMesh[key]
    if (numRemeshed >= MAX_REMESH_CHUNKS) break
  }
  var meshMs = new Date().getTime()

  // Initial load. Tested on a 2016 12" Macbook running on half battery:
  // Baseline: Meshed 895 chunks, remeshed 0 in 591ms <always ~600>, 152517 checks 40m quads visited
  // Planes: Meshed 895 chunks, remeshed 0 in 397ms <always ~400>, 152517 checks 7m quads visited
  // SAT: Meshed 895 + 0 in 412ms, preproc 144 in 223ms, 110 checks 0m quads visited
  // SAT >100: Meshed 895 + 0 in 371ms, preproc 117 in 207ms, 9594 checks 1m quads visited
  console.log('Meshed %d + %d in %dms, preproc %d in %dms, %d checks %dm quads visited',
    dirtyChunks.length, numRemeshed, meshMs - startMs, numPreproc, preprocessMs - startMs,
    numChecks, Math.round(numQuadsVisited / 1e6))
  numPreproc = 0
  numChecks = 0
  numQuadsVisited = 0
}

// Cache where a given chunk is transparent. Creates a 3D summed area table (SAT).
// Stores a CS^3 array of cumulative sums of num opaque blocks.
// This allows O(1) lookup of whether a region is opaque later.
function markTransparency (chunk) {
  if (!chunk.packed) throw new Error('chunk must be packed')
  var data = chunk.data
  var n = chunk.length
  if (n === 0) return

  numPreproc++
  var key = chunk.getKey()
  var trans = chunkTransparency[key]
  if (!trans) {
    trans = chunkTransparency[key] = new Uint16Array(CS * CS * CS) // 64KB per block... fail
  } else {
    trans.fill(0)
  }

  // First, mark quads
  for (var ci = 0; ci < n; ci++) {
    var index = ci * 8
    var x0 = data[index]
    var y0 = data[index + 1]
    var z0 = data[index + 2]
    var x1 = data[index + 3]
    var y1 = data[index + 4]
    var z1 = data[index + 5]
    var v = data[index + 6]
    if (v <= 1) continue // Only mark opaque quads
    for (var x = x0; x < x1; x++) {
      for (var y = y0; y < y1; y++) {
        for (var z = z0; z < z1; z++) {
          trans[(x << CB << CB) + (y << CB) + z] = 1
        }
      }
    }
  }

  // Then, compute cumulative sums
  var xstride = 1 << CB << CB
  var ystride = 1 << CB
  for (x = 0; x < CS; x++) {
    for (y = 0; y < CS; y++) {
      for (z = 0; z < CS; z++) {
        index = (x << CB << CB) + (y << CB) + z
        var aboveX = x === 0 ? 0 : trans[index - xstride]
        var aboveY = y === 0 ? 0 : trans[index - ystride]
        var aboveZ = z === 0 ? 0 : trans[index - 1]
        var aboveXY = (x === 0 || y === 0) ? 0 : trans[index - xstride - ystride]
        var aboveXZ = (x === 0 || z === 0) ? 0 : trans[index - xstride - 1]
        var aboveYZ = (y === 0 || z === 0) ? 0 : trans[index - ystride - 1]
        var aboveXYZ = (x === 0 || y === 0 || z === 0) ? 0 : trans[index - xstride - ystride - 1]
        trans[index] += aboveX + aboveY + aboveZ - aboveXY - aboveYZ - aboveXZ + aboveXYZ
      }
    }
  }
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
    verts: env.regl.buffer(new Float32Array(verts.buffer, 0, count * 3)),
    normals: env.regl.buffer(new Float32Array(normals.buffer, 0, count * 3)),
    uvs: env.regl.buffer(new Float32Array(uvs.buffer, 0, count * 2)),
    count: count,
    destroy: destroy
  }
}

// Profiling shows this is the most critical path.
// May run hundreds of times in a single frame, allocating 1000+ WebGL buffers
function meshBuffers (chunk, world) {
  var data = chunk.data
  var n = chunk.length
  var ivert = 0
  var inormal = 0
  var iuv = 0
  var i

  // Loop thru the packed representation (list of quads)
  for (var index = 0; index < n; index += 8) {
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
      var xface = fside ? (x1 - sideOffset) : (x0 + sideOffset)
      var yface = fside ? (y1 - sideOffset) : (y0 + sideOffset)
      var zface = fside ? z1 : z0
      var drawX = check(world, v, fside ? x1 : (x0 - 1), y0, z0, fside ? (x1 + 1) : x0, y1, z1)
      var drawY = check(world, v, x0, fside ? y1 : (y0 - 1), z0, x1, fside ? (y1 + 1) : y0, z1)
      var drawZ = check(world, v, x0, y0, fside ? z1 : (z0 - 1), x1, y1, fside ? (z1 + 1) : z0)

      // Add vertices
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
      var dir = fside ? 1 : -1
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

// Checks whether there are any seethru blocks in a given 3D quad other than vCompare
function check (world, vCompare, x0, y0, z0, x1, y1, z1) {
  var cx = x0 >> CB << CB
  var cy = y0 >> CB << CB
  var cz = z0 >> CB << CB
  var chunk = world.getChunk(cx, cy, cz)
  if (!chunk) return true

  // The region (x0, y0, z0) to (x1, y1, v1) is entirely in one plane
  // This means we can intersection test it against typically <10 quads instead of hundreds
  // It also means at least one of wx, wy, or wz below must be equal to 1
  x0 = (x0 - cx) | 0
  y0 = (y0 - cy) | 0
  z0 = (z0 - cz) | 0
  x1 = (x1 - cx) | 0
  y1 = (y1 - cy) | 0
  z1 = (z1 - cz) | 0
  var wx = x1 - x0
  var wy = y1 - y0
  var wz = z1 - z0

  // Fast path: O(1) transparency lookup from the precomputed array
  var trans = chunkTransparency[chunk.getKey()]
  if (trans) {
    // Summed area table lookup
    var numOpaque = lookupSAT(trans, x0, y0, z0, x1, y1, z1)
    if (numOpaque > (wx * wy * wz)) {
      throw new Error('precompute fail')
    }
    return numOpaque < (wx * wy * wz)
  }

  // Slow path:
  // Check the region, mark `checked` for each voxel, find out if the region contains air
  checked.fill(0, 0, wx * wy * wz)
  numChecks++
  numQuadsVisited += chunk.length / 8
  var d = chunk.data
  for (var index = 0; index < chunk.length; index += 8) {
    var qx0 = d[index]
    var qy0 = d[index + 1]
    var qz0 = d[index + 2]
    var qx1 = d[index + 3]
    var qy1 = d[index + 4]
    var qz1 = d[index + 5]
    var v = d[index + 6]

    var overlaps = x0 < qx1 && x1 > qx0 && y0 < qy1 && y1 > qy0 && z0 < qz1 && z1 > qz0

    // If v is opaque (> 1) or matches vCompare, mark opaque blocks
    if (v === vCompare || v > 1) {
      if (!overlaps) continue
      var ox0 = Math.max(x0, qx0) - x0
      var oy0 = Math.max(y0, qy0) - y0
      var oz0 = Math.max(z0, qz0) - z0
      var ox1 = Math.min(x1, qx1) - x0
      var oy1 = Math.min(y1, qy1) - y0
      var oz1 = Math.min(z1, qz1) - z0
      for (var ix = ox0; ix < ox1; ix++) {
        for (var iy = oy0; iy < oy1; iy++) {
          for (var iz = oz0; iz < oz1; iz++) {
            checked[ix * wy * wz + iy * wz + iz] = 1
          }
        }
      }
    } else {
      // See if v is transparent and overaps the check region
      if (overlaps) return true
    }
  }

  // See if there were any air blocks (not marked opaque)
  for (var i = 0; i < wx * wy * wz; i++) {
    if (!checked[i]) return true
  }
  return false
}

function lookupSAT (arr, x0, y0, z0, x1, y1, z1) {
  var t000 = lookupSatVal(arr, x0, y0, z0)
  var t001 = lookupSatVal(arr, x0, y0, z1)
  var t010 = lookupSatVal(arr, x0, y1, z0)
  var t011 = lookupSatVal(arr, x0, y1, z1)
  var t100 = lookupSatVal(arr, x1, y0, z0)
  var t101 = lookupSatVal(arr, x1, y0, z1)
  var t110 = lookupSatVal(arr, x1, y1, z0)
  var t111 = lookupSatVal(arr, x1, y1, z1)
  return t111 - t110 - t101 - t011 + t100 + t010 + t001 - t000
}

function lookupSatVal (arr, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x > CS || y > CS || z > CS) throw new Error('sat fail')
  if (x === 0 || y === 0 || z === 0) return 0
  return arr[((x - 1) << CB << CB) + ((y - 1) << CB) + z - 1]
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
