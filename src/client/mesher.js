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
var MAX_QUADS_PER_RUN = 1000
var chunkPriority = {}
var chunkCache = {}
var numChecks = 0
var numQuadsVisited = 0
var numPreproc = 0

// Meshes dirty chunks. Schedules chunks for meshing based on a priority algorithm.
function meshWorld (world, loc) {
  var startMs = new Date().getTime()

  // Find chunks that need to be meshed
  world.chunks.forEach(function (c) {
    // If a chunk is too far away to draw, don't mesh it
    // If it's even further than that, unload from GPU
    var maxDraw = config.GRAPHICS.CHUNK_DRAW_RADIUS * CS
    var d2 = getDistSquared(c, loc)
    if (d2 > maxDraw * maxDraw * 2 && c.mesh) {
      c.mesh.destroy()
      c.mesh = null
      c.dirty = true
    }
    if (d2 > maxDraw * maxDraw) return

    if (!c.dirty) return
    c.dirty = false

    // Remesh the dirty chunks ASAP
    var key = c.getKey()
    chunkCache[key] = null
    chunkPriority[key] = 3

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

  // Preprocess for performance
  chunksToMesh.forEach(function (obj) {
    if (obj.priority === 3) unpack(obj.chunk)
  })
  var preprocessMs = new Date().getTime()

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
  console.log('Meshed %d + %d in %dms, preproc %d in %dms, %d checks %dm quads visited',
    counts[3], counts[1], meshMs - startMs, numPreproc, preprocessMs - startMs,
    numChecks, Math.round(numQuadsVisited / 1e6))
  numPreproc = 0
  numChecks = 0
  numQuadsVisited = 0
}

// Convert list of quads to flat array of voxels
// Cache unpacked chunk contents
function unpack (chunk) {
  if (!chunk.packed) throw new Error('chunk must be packed')
  var data = chunk.data
  var n = chunk.length
  if (n === 0) return

  numPreproc++
  var key = chunk.getKey()
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
  if (!chunk.data) return
  if (!chunk.packed) throw new Error('must pack chunk before meshing')

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
    var sideOffset = voxType.sideOffset

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

  // Fast path
  var voxels = chunkCache[chunk.getKey()]
  if (voxels) {
    for (var ix = x0; ix < x1; ix++) {
      for (var iy = y0; iy < y1; iy++) {
        for (var iz = z0; iz < z1; iz++) {
          var v = voxels[(ix << CB << CB) + (iy << CB) + iz]
          if (v !== vCompare && v <= 1) return true
        }
      }
    }
    return false
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
    v = d[index + 6]

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
      for (ix = ox0; ix < ox1; ix++) {
        for (iy = oy0; iy < oy1; iy++) {
          for (iz = oz0; iz < oz1; iz++) {
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

function getDistSquared (chunk, loc) {
  var dx = loc.x - chunk.x
  var dy = loc.y - chunk.y
  var dz = loc.z - chunk.z
  return dx * dx + dy * dy + dz * dz
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
