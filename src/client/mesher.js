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
var checked = new Uint8Array(CS3)

// Variables for meshWorld
var MAX_QUADS_PER_RUN = 1000
var chunkPriority = {}
var chunkCache = {}
var numChecks = 0
var numQuadsVisited = 0

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
      delete chunkCache[c.getKey()]
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
  console.log('Meshed %d + %d in %dms, %d checks %dm quads visited',
    counts[3], counts[1], meshMs - startMs,
    numChecks, Math.round(numQuadsVisited / 1e6))
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
  if (!chunk.length) return

  if (chunk.mesh) chunk.mesh.destroy()

  // Fills 'verts', 'normals', and 'uvs'
  var count = meshBuffers(chunk, world)

  chunk.mesh = {
    count: count,
    verts: count && env.regl.buffer(new Float32Array(verts.buffer, 0, count * 3)),
    normals: count && env.regl.buffer(new Float32Array(normals.buffer, 0, count * 3)),
    uvs: count && env.regl.buffer(new Float32Array(uvs.buffer, 0, count * 2)),
    destroy: destroy
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
  checked.fill(0)
  var voxels = getVoxels(chunk)
  var ivert = 0
  var inormal = 0
  var iuv = 0
  var x, y, z, nx, ny, nz, side

  var neighbors = new Array(3)
  for (side = 0; side < 3; side++) {
    nx = (side === 0) ? (chunk.x + CS) : chunk.x
    ny = (side === 1) ? (chunk.y + CS) : chunk.y
    nz = (side === 2) ? (chunk.z + CS) : chunk.z
    neighbors[side] = getVoxels(world.getChunk(nx, ny, nz))
  }

  // Loop thru voxels, create quads
  var cs1 = CS - 1
  for (x = 0; x < CS; x++) {
    for (y = 0; y < CS; y++) {
      for (z = 0; z < CS; z++) {
        var v = voxels[(x << CB << CB) | (y << CB) | z]
        var check = checked[(x << CB << CB) | (y << CB) | z]
        for (side = 0; side < 3; side++) {
          if (check & (1 << side)) {
            continue // Already meshed
          }
          nx = (side === 0) ? (x + 1) : x
          ny = (side === 1) ? (y + 1) : y
          nz = (side === 2) ? (z + 1) : z
          var nvoxels = voxels
          if ((nx & ~cs1) || (ny & ~cs1) || (nz & ~cs1)) {
            nx &= cs1
            ny &= cs1
            nz &= cs1
            nvoxels = neighbors[side]
          }
          var n = nvoxels ? nvoxels[(nx << CB << CB) | (ny << CB) | nz] : 0
          if (n === v || (n > 1 && v > 1)) continue // Doesn't need to be meshed

          // Does need to be meshed. Greedily expand to largest possible quad.
          // TODO: expand to quad, not just to strip
          var np = n
          var vp = v
          var x1 = x
          var y1 = y
          var z1 = z
          if (side === 1) {
            while (true) {
              if (++x1 >= CS) break
              vp = voxels[(x1 << CB << CB) | (y << CB) | z]
              np = nvoxels ? nvoxels[(x1 << CB << CB) | (ny << CB) | nz] : 0
              if (np !== n || vp !== v) break
              checked[(x1 << CB << CB) | (y << CB) | z] |= (1 << side)
            }
            y1++
            z1++
          }
          if (side === 2) {
            while (true) {
              if (++y1 >= CS) break
              vp = voxels[(x << CB << CB) | (y1 << CB) | z]
              np = nvoxels ? nvoxels[(nx << CB << CB) | (y1 << CB) | nz] : 0
              if (np !== n || vp !== v) break
              checked[(x << CB << CB) | (y1 << CB) | z] |= (1 << side)
            }
            x1++
            z1++
          }
          if (side === 0) {
            while (true) {
              if (++z1 >= CS) break
              vp = voxels[(x << CB << CB) | (y << CB) | z1]
              np = nvoxels ? nvoxels[(nx << CB << CB) | (ny << CB) | z1] : 0
              if (np !== n || vp !== v) break
              checked[(x << CB << CB) | (y << CB) | z1] |= (1 << side)
            }
            x1++
            y1++
          }

          // Add verts, norms, uvs
          var voxType = v < n ? vox.TYPES[n] : vox.TYPES[v]
          var uv = voxType.uv.side
          var norm = v < n ? -1 : 1
          var vnorm, v0, v1, v2
          v0 = [chunk.x + x, chunk.y + y, chunk.z + z]
          if (side === 0) {
            vnorm = [norm, 0, 0]
            v0[0]++
            v1 = [0, y1 - y, 0]
            v2 = [0, 0, z1 - z]
          } else if (side === 1) {
            vnorm = [0, norm, 0]
            v0[1]++
            v1 = [x1 - x, 0, 0]
            v2 = [0, 0, z1 - z]
          } else if (side === 2) {
            vnorm = [0, 0, norm]
            v0[2]++
            v1 = [x1 - x, 0, 0]
            v2 = [0, y1 - y, 0]
          }
          ivert += addXYZ(verts, ivert, v0[0], v0[1], v0[2])
          ivert += addXYZ(verts, ivert, v0[0] + v1[0], v0[1] + v1[1], v0[2] + v1[2])
          ivert += addXYZ(verts, ivert, v0[0] + v2[0], v0[1] + v2[1], v0[2] + v2[2])
          ivert += addXYZ(verts, ivert, v0[0] + v2[0], v0[1] + v2[1], v0[2] + v2[2])
          ivert += addXYZ(verts, ivert, v0[0] + v1[0], v0[1] + v1[1], v0[2] + v1[2])
          ivert += addXYZ(verts, ivert,
            v0[0] + v1[0] + v2[0], v0[1] + v1[1] + v2[1], v0[2] + v1[2] + v2[2])
          for (var i = 0; i < 6; i++) {
            inormal += addXYZ(normals, inormal, vnorm[0], vnorm[1], vnorm[2])
            iuv += addUV(uvs, iuv, uv)
          }
        }
      }
    }
  }

  // Returns the number of vertices created
  return ivert / 3
}

function getDistSquared (a, b) {
  var dx = a.x - b.x
  var dy = a.y - b.y
  var dz = a.z - b.z
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
  if (this.count === 0) return
  this.verts.destroy()
  this.normals.destroy()
  this.uvs.destroy()
}
