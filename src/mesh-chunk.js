var env = require('./env')
var config = require('./config')
var vox = require('./vox')
var shaders = require('./shaders')
var camera = require('./camera')

// Meshes a chunk, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
//
// Meshes exposed surfaces only. Uses the greedy algorithm.
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
module.exports = meshChunk

var cs = config.CHUNK_SIZE

function meshChunk (chunk) {
  if (chunk.draw) return

  var verts = []
  var uvs = []
  var normals = []
  var meshed = new Uint8Array(chunk.data.length) // TODO: preallocate and clear
  for (var ix = 0; ix < cs; ix++) {
    for (var iy = 0; iy < cs; iy++) {
      for (var iz = 0; iz < cs; iz++) {
        var v = getVoxel(chunk.data, ix, iy, iz)
        if (v === vox.INDEX.AIR) continue
        var isMeshed = getVoxel(meshed, ix, iy, iz)
        if (isMeshed > 0) continue

        // get uvs, etc
        var voxType = vox.TYPES[v]

        // expand to largest possible quad
        var jx = ix
        var jy = iy
        var jz = iz
        for (; jx < cs; jx++) {
          var jvox = getVoxel(chunk.data, jx, jy, jz)
          if (jvox !== v) break
        }
        for (; jy < cs; jy++) {
          var hasGaps = false
          for (var kx = iy; kx < jx; kx++) {
            hasGaps |= getVoxel(chunk.data, kx, jy, jz) !== v
          }
          if (hasGaps) break
        }
        for (; jz < cs; jz++) {
          hasGaps = false
          for (kx = ix; kx < jx; kx++) {
            for (var ky = iy; ky < jy; ky++) {
              hasGaps |= getVoxel(chunk.data, kx, ky, jz) !== v
            }
          }
          if (hasGaps) break
        }

        // mark quad as done
        for (kx = ix; kx < jx; kx++) {
          for (ky = iy; ky < jy; ky++) {
            for (var kz = iz; kz < jz; kz++) {
              setVoxel(meshed, kx, ky, kz, 1)
            }
          }
        }

        // add the six faces (12 tris total) for the quad
        var eps = 0.001
        var voxx = chunk.x + ix
        var voxy = chunk.y + iy
        var voxz = chunk.z + iz
        var voxx2 = chunk.x + jx - eps
        var voxy2 = chunk.y + jy - eps
        var voxz2 = chunk.z + jz - eps
        for (var fside = 0; fside < 2; fside++) {
          var xface = fside === 1 ? voxx2 : voxx
          verts.push(
            xface, voxy, voxz,
            xface, voxy2, voxz,
            xface, voxy, voxz2,
            xface, voxy, voxz2,
            xface, voxy2, voxz,
            xface, voxy2, voxz2
          )
          var yface = fside === 1 ? voxy2 : voxy
          verts.push(
            voxx, yface, voxz,
            voxx2, yface, voxz,
            voxx, yface, voxz2,
            voxx, yface, voxz2,
            voxx2, yface, voxz,
            voxx2, yface, voxz2
          )
          var zface = fside === 1 ? voxz2 : voxz
          verts.push(
            voxx, voxy, zface,
            voxx2, voxy, zface,
            voxx, voxy2, zface,
            voxx, voxy2, zface,
            voxx2, voxy, zface,
            voxx2, voxy2, zface
          )

          var dir = fside * 2 - 1 // -1 or 1
          normals.push(
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0
          )
          normals.push(
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0
          )
          normals.push(
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir
          )

          var uvVox = voxType.uv
          var uvVoxXY = uvVox.side
          var uvVoxZ = fside === 1 ? uvVox.top : uvVox.bottom
          var uvVoxXY0 = uvVoxXY[0] / 16
          var uvVoxXY1 = uvVoxXY[1] / 16
          var uvVoxZ0 = uvVoxZ[0] / 16
          var uvVoxZ1 = uvVoxZ[1] / 16
          var uvW = 0 // 1/16
          uvs.push(
            uvVoxXY0, uvVoxXY1,
            uvVoxXY0 + uvW, uvVoxXY1,
            uvVoxXY0, uvVoxXY1 + uvW,
            uvVoxXY0, uvVoxXY1 + uvW,
            uvVoxXY0 + uvW, uvVoxXY1,
            uvVoxXY0 + uvW, uvVoxXY1 + uvW,

            uvVoxXY0, uvVoxXY1,
            uvVoxXY0 + uvW, uvVoxXY1,
            uvVoxXY0, uvVoxXY1 + uvW,
            uvVoxXY0, uvVoxXY1 + uvW,
            uvVoxXY0 + uvW, uvVoxXY1,
            uvVoxXY0 + uvW, uvVoxXY1 + uvW,

            uvVoxZ0, uvVoxZ1,
            uvVoxZ0 + uvW, uvVoxZ1,
            uvVoxZ0, uvVoxZ1 + uvW,
            uvVoxZ0, uvVoxZ1 + uvW,
            uvVoxZ0 + uvW, uvVoxZ1,
            uvVoxZ0 + uvW, uvVoxZ1 + uvW
          )
        }
      }
    }
  }

  chunk.draw = env.regl({
    vert: shaders.vert.simple,
    frag: shaders.frag.voxel,
    uniforms: {
      uMatrix: camera.updateMatrix
    },
    attributes: {
      aVertexPosition: verts,
      aVertexNormal: normals,
      aVertexUV: uvs
    },
    count: verts.length
  })
}

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * cs * cs + iy * cs + iz]
}

// Helper method for writing up a value from a packed voxel array (XYZ layout)
function setVoxel (data, ix, iy, iz, val) {
  data[ix * cs * cs + iy * cs + iz] = val
}
