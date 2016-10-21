var env = require('./env')
var config = require('./config')
var vox = require('./vox')

// Meshes and renders voxels chunks
module.exports = {
  mesh: mesh
}

var CS = config.CHUNK_SIZE
var CS3 = CS * CS * CS
var verts = new Float32Array(CS3 * 3)
var normals = new Float32Array(CS3 * 3)
var uvs = new Float32Array(CS3 * 2)
var meshed = new Uint8Array(CS3)

// Meshes a chunk, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
//
// Meshes exposed surfaces only. Uses the greedy algorithm.
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
function mesh (chunk) {
  if (!chunk.data) return
  if (chunk.mesh) return

  // Clear progress buffer
  for (var i = 0; i < CS3; i++) meshed[i] = 0

  // Then, mesh using the greedy quad algorithm
  var ivert = 0
  var inormal = 0
  var iuv = 0
  var ix, iy, iz
  for (ix = 0; ix < CS; ix++) {
    for (iy = 0; iy < CS; iy++) {
      for (iz = 0; iz < CS; iz++) {
        var isMeshed = getVoxel(meshed, ix, iy, iz)
        if (isMeshed > 0) continue
        var v = getVoxel(chunk.data, ix, iy, iz)
        if (v === vox.INDEX.AIR) continue

        // get uvs, etc
        var voxType = vox.TYPES[v]

        // expand to largest possible quad
        var jx = ix + 1
        var jy = iy + 1
        var jz = iz + 1
        var kx, ky, kz
        var match = true
        for (; match && jx < CS; match && jx++) {
          match = getVoxel(chunk.data, jx, iy, iz) === v && !getVoxel(meshed, jx, iy, iz)
        }
        match = true
        for (; match && jy < CS; match && jy++) {
          for (kx = ix; match && kx < jx; kx++) {
            match = getVoxel(chunk.data, kx, jy, iz) === v && !getVoxel(meshed, kx, jy, iz)
          }
        }
        match = true
        for (; match && jz < CS; match && jz++) {
          for (kx = ix; match && kx < jx; kx++) {
            for (ky = iy; match && ky < jy; match && ky++) {
              match = getVoxel(chunk.data, kx, ky, jz) === v && !getVoxel(meshed, kx, ky, jz)
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
              if (getVoxel(chunk.data, kx, ky, kz) !== v) console.log('invalid quad', kx, ky, kz)
              setVoxel(meshed, kx, ky, kz, 1)
            }
          }
        }

        // add the six faces (12 tris total) for the quad
        var eps = 0.001
        var x0 = chunk.x + ix
        var y0 = chunk.y + iy
        var z0 = chunk.z + iz
        var x1 = chunk.x + jx - eps
        var y1 = chunk.y + jy - eps
        var z1 = chunk.z + jz - eps

        for (var fside = 0; fside <= 1; fside++) {
          // add vertices
          var xface = fside ? x1 : x0
          ivert += addXYZ(verts, ivert, xface, y0, z0)
          ivert += addXYZ(verts, ivert, xface, y1, z0)
          ivert += addXYZ(verts, ivert, xface, y0, z1)
          ivert += addXYZ(verts, ivert, xface, y0, z1)
          ivert += addXYZ(verts, ivert, xface, y1, z0)
          ivert += addXYZ(verts, ivert, xface, y1, z1)
          var yface = fside ? y1 : y0
          ivert += addXYZ(verts, ivert, x0, yface, z0)
          ivert += addXYZ(verts, ivert, x1, yface, z0)
          ivert += addXYZ(verts, ivert, x0, yface, z1)
          ivert += addXYZ(verts, ivert, x0, yface, z1)
          ivert += addXYZ(verts, ivert, x1, yface, z0)
          ivert += addXYZ(verts, ivert, x1, yface, z1)
          var zface = fside ? z1 : z0
          ivert += addXYZ(verts, ivert, x0, y0, zface)
          ivert += addXYZ(verts, ivert, x1, y0, zface)
          ivert += addXYZ(verts, ivert, x0, y1, zface)
          ivert += addXYZ(verts, ivert, x0, y1, zface)
          ivert += addXYZ(verts, ivert, x1, y0, zface)
          ivert += addXYZ(verts, ivert, x1, y1, zface)

          // add normals
          var dir = fside ? 1 : -1
          for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, dir, 0, 0)
          for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, dir, 0)
          for (i = 0; i < 6; i++) inormal += addXYZ(normals, inormal, 0, 0, dir)

          // add texture atlas UVs
          var uvxy = voxType.uv.side
          var uvz = fside === 1 ? voxType.uv.top : voxType.uv.bottom
          for (i = 0; i < 12; i++) iuv += addUV(uvs, iuv, uvxy)
          for (i = 0; i < 6; i++) iuv += addUV(uvs, iuv, uvz)
        }
      }
    }
  }

  chunk.mesh = {
    verts: env.regl.buffer(verts, ivert),
    normals: env.regl.buffer(normals, inormal),
    uvs: env.regl.buffer(uvs, iuv),
    count: ivert / 3,
    destroy: destroy
  }
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

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * CS * CS + iy * CS + iz]
}

// Helper method for writing up a value from a packed voxel array (XYZ layout)
function setVoxel (data, ix, iy, iz, val) {
  data[ix * CS * CS + iy * CS + iz] = val
}
