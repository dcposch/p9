var env = require('./env')
var config = require('./config')
var vox = require('./vox')

// Meshes and renders voxels chunks
module.exports = {
  mesh: mesh
}

var CS = config.CHUNK_SIZE

// Meshes a chunk, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
//
// Meshes exposed surfaces only. Uses the greedy algorithm.
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
function mesh (chunk) {
  if (chunk.draw) return

  var verts = []
  var uvs = []
  var normals = []
  var meshed = new Uint8Array(chunk.data.length) // TODO: preallocate and clear
  var ix, iy, iz

  // Then, mesh using the greedy quad algorithm
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
          var px0 = [xface, y0, z0]
          var px1 = [xface, y0, z1]
          var px2 = [xface, y1, z0]
          var px3 = [xface, y1, z1]
          verts.push(px0, px2, px1, px1, px2, px3)
          var yface = fside ? y1 : y0
          var py0 = [x0, yface, z0]
          var py1 = [x0, yface, z1]
          var py2 = [x1, yface, z0]
          var py3 = [x1, yface, z1]
          verts.push(py0, py2, py1, py1, py2, py3)
          var zface = fside ? z1 : z0
          var pz0 = [x0, y0, zface]
          var pz1 = [x0, y1, zface]
          var pz2 = [x1, y0, zface]
          var pz3 = [x1, y1, zface]
          verts.push(pz0, pz2, pz1, pz1, pz2, pz3)

          // add normals
          var dir = fside ? 1 : -1
          var i
          for (i = 0; i < 6; i++) normals.push(dir, 0, 0)
          for (i = 0; i < 6; i++) normals.push(0, dir, 0)
          for (i = 0; i < 6; i++) normals.push(0, 0, dir)

          // add texture atlas UVs
          var uvxy = voxType.uv.side
          var uvz = fside === 1 ? voxType.uv.top : voxType.uv.bottom
          for (i = 0; i < 12; i++) uvs.push(uvxy)
          for (i = 0; i < 6; i++) uvs.push(uvz)
        }
      }
    }
  }

  chunk.mesh = {
    verts: env.regl.buffer(flatten(verts)),
    normals: env.regl.buffer(flatten(normals)),
    uvs: env.regl.buffer(flatten(uvs)),
    count: verts.length
  }
}

function flatten (arr) {
  var n = count(arr)
  var ret = new Float32Array(n)
  flattenInto(ret, arr, 0)
  return ret
}

function count (arr) {
  if (arr.length === 0) return 0
  if (typeof arr[0] === 'number') return arr.length
  var sum = 0
  for (var i = 0; i < arr.length; i++) sum += count(arr[i])
  return sum
}

function flattenInto (ret, arr, offset) {
  if (arr.length === 0) return 0
  var isNumbers = typeof arr[0] === 'number'
  var n = isNumbers ? arr.length : 0
  for (var i = 0; i < arr.length; i++) {
    if (isNumbers) ret[offset + i] = arr[i]
    else n += flattenInto(ret, arr[i], offset + n)
  }
  return n
}

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * CS * CS + iy * CS + iz]
}

// Helper method for writing up a value from a packed voxel array (XYZ layout)
function setVoxel (data, ix, iy, iz, val) {
  data[ix * CS * CS + iy * CS + iz] = val
}
