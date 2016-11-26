var env = require('./env')
var config = require('./config')
var vox = require('./vox')
var Chunk = require('./chunk')

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
var meshed = new Chunk(0, 0, 0)

// Variables for meshWorld
var MAX_REMESH_CHUNKS = 6
var mapToMesh = {}

// Meshes all dirty chunks in the visible world, and lazily remeshes adjacent chunks
function meshWorld (world) {
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
  console.log('Meshed %d dirty chunks, remeshed %d adjacent', dirtyChunks.length, numRemeshed)
}

// Meshes a chunk, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
//
// Meshes exposed surfaces only. Uses the greedy algorithm.
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
function meshChunk (chunk, world) {
  chunk.dirty = false

  if (!chunk.data) return

  // Clear progress buffer
  if (meshed.data) meshed.data.fill(0)

  // Then, mesh using the greedy quad algorithm
  var count = meshGreedyQuad(chunk, world)

  if (chunk.mesh) chunk.mesh.destroy()
  chunk.mesh = {
    verts: env.regl.buffer(verts, count * 3),
    normals: env.regl.buffer(normals, count * 3),
    uvs: env.regl.buffer(uvs, count * 2),
    count: count,
    destroy: destroy
  }
}

function meshGreedyQuad (chunk, world) {
  var ivert = 0
  var inormal = 0
  var iuv = 0
  var i, ix, iy, iz
  for (ix = 0; ix < CS; ix++) {
    for (iy = 0; iy < CS; iy++) {
      for (iz = 0; iz < CS; iz++) {
        var isMeshed = meshed.getVox(ix, iy, iz) | 0
        if (isMeshed > 0) continue
        var v = chunk.getVox(ix, iy, iz) | 0
        if (v === vox.INDEX.AIR) continue

        // expand to largest possible quad
        var jx = ix + 1
        var jy = iy + 1
        var jz = iz + 1
        var kx, ky, kz
        var match = true
        for (; match && jx < CS; match && jx++) {
          match = chunk.getVox(jx, iy, iz) === v && !meshed.getVox(jx, iy, iz)
        }
        match = true
        for (; match && jy < CS; match && jy++) {
          for (kx = ix; match && kx < jx; kx++) {
            match = chunk.getVox(kx, jy, iz) === v && !meshed.getVox(kx, jy, iz)
          }
        }
        match = true
        for (; match && jz < CS; match && jz++) {
          for (kx = ix; match && kx < jx; kx++) {
            for (ky = iy; match && ky < jy; match && ky++) {
              match = chunk.getVox(kx, ky, jz) === v && !meshed.getVox(kx, ky, jz)
            }
          }
        }

        // mark quad as done
        if (ix >= jx) throw new Error('invalid quad x')
        if (iy >= jy) throw new Error('invalid quad y')
        if (iz >= jz) throw new Error('invalid quad z')
        for (kx = ix; kx < jx; kx++) {
          for (ky = iy; ky < jy; ky++) {
            for (kz = iz; kz < jz; kz++) {
              if (chunk.getVox(kx, ky, kz) !== v) console.log('invalid quad', kx, ky, kz)
              meshed.setVox(kx, ky, kz, 1)
            }
          }
        }

        // get uvs, etc
        var voxType = vox.TYPES[v]
        var sideOffset = voxType.sideOffset || 0

        // add the six faces (12 tris total) for the quad
        var x0 = chunk.x + ix
        var y0 = chunk.y + iy
        var z0 = chunk.z + iz
        var x1 = chunk.x + jx
        var y1 = chunk.y + jy
        var z1 = chunk.z + jz

        for (var fside = 0; fside <= 1; fside++) {
          // figure out which faces we need to draw
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

          // add normals
          if (drawX) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, dir, 0, 0)
          if (drawY) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, dir, 0)
          if (drawZ) for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, 0, dir)

          // add texture atlas UVs
          var uvxy = voxType.uv.side
          var uvz = fside === 1 ? voxType.uv.top : voxType.uv.bottom
          if (drawX) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvxy)
          if (drawY) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvxy)
          if (drawZ) for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvz)
        }
      }
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
