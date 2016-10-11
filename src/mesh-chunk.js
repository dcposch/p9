var env = require('./env')
var config = require('./config')
var vox = require('./vox')
var shaders = require('./shaders')
var camera = require('./camera')

// Meshes and renders voxels chunks
module.exports = {
  loadResources: loadResources,
  mesh: mesh
}

var CS = config.CHUNK_SIZE
var textureAtlas
var aniso = Math.min(env.regl.limits.maxAnisotropic, config.MAX_ANISOTROPIC)

// Loads textures. Calls back when done.
// This must finish before mesh() can be called
function loadResources (cb) {
  var image = new window.Image()
  image.src = 'textures/isabella.png'
  image.onload = function () {
    console.log('Loaded ' + image.src)
    textureAtlas = env.regl.texture({
      min: 'mipmap',
      aniso: aniso,
      mag: 'nearest',
      data: image
    })
    cb()
  }
  console.log('Voxel texture: %s, aniso: %d', image.src, aniso)
}

// Meshes a chunk, creating a regl object.
// (That means position, UV VBOs are sent to the GPU.)
//
// Meshes exposed surfaces only. Uses the greedy algorithm.
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
function mesh (chunk) {
  if (chunk.draw) return

  var vertsWire = []
  var colorsWire = []
  var verts = []
  var uvs = []
  var normals = []
  var meshed = new Uint8Array(chunk.data.length) // TODO: preallocate and clear
  for (var ix = 0; ix < CS; ix++) {
    for (var iy = 0; iy < CS; iy++) {
      for (var iz = 0; iz < CS; iz++) {
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
          match = getVoxel(chunk.data, jx, iy, iz) === v
        }
        match = true
        for (; match && jy < CS; match && jy++) {
          for (kx = ix; match && kx < jx; kx++) {
            match = getVoxel(chunk.data, kx, jy, iz) === v
          }
        }
        match = true
        for (; match && jz < CS; match && jz++) {
          for (kx = ix; match && kx < jx; kx++) {
            for (ky = iy; match && ky < jy; match && ky++) {
              match = getVoxel(chunk.data, kx, ky, jz) === v
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

          var dir = fside ? 1 : -1
          var i
          for (i = 0; i < 6; i++) normals.push(dir, 0, 0)
          for (i = 0; i < 6; i++) normals.push(0, dir, 0)
          for (i = 0; i < 6; i++) normals.push(0, 0, dir)

          var uvxy = voxType.uv.side
          var uvz = fside === 1 ? voxType.uv.top : voxType.uv.bottom
          for (i = 0; i < 12; i++) uvs.push(uvxy)
          for (i = 0; i < 6; i++) uvs.push(uvz)

          if (!config.DEBUG.WIREFRAME) continue

          var rand = Math.random
          var push = Array.prototype.push
          var leps = rand() * 0.05
          push.apply(vertsWire, bump([px0, px1, px1, px3, px3, px2, px2, px0], [dir * leps, 0, 0]))
          push.apply(vertsWire, bump([py0, py1, py1, py3, py3, py2, py2, py0], [0, dir * leps, 0]))
          push.apply(vertsWire, bump([pz0, pz1, pz1, pz3, pz3, pz2, pz2, pz0], [0, 0, dir * leps]))

          var lcolor = [0.5 * rand() + 0.5, 0.5 * rand() + 0.5, 0.5 * rand() + 0.5, 1]
          for (i = 0; i < 24; i++) colorsWire.push(lcolor)
        }
      }
    }
  }

  var drawChunk = createChunkCommand(verts, normals, uvs)
  var drawWireframe = config.DEBUG.WIREFRAME && createWireframeCommand(vertsWire, colorsWire)
  chunk.draw = function (props) {
    drawChunk(props)
    if (drawWireframe) drawWireframe(props)
  }
  chunk.draw.count = verts.length / 3
}

// Returns a new array that moves each of `points` by `vec`
function bump (points, vec) {
  return points.map(function (point) {
    return point.map(function (p, i) { return p + vec[i] })
  })
}

// Creates a regl command that draws a voxel chunk
function createChunkCommand (verts, normals, uvs) {
  return env.regl({
    vert: shaders.vert.uvWorld,
    frag: shaders.frag.voxel,
    uniforms: {
      uMatrix: camera.updateMatrix,
      uAtlas: textureAtlas,
      uLightDir: [0.6, 0.48, 0.64],
      uLightDiffuse: [1, 1, 0.9],
      uLightAmbient: [0.6, 0.6, 0.6]
    },
    attributes: {
      aVertexPosition: verts,
      aVertexNormal: normals,
      aVertexUV: uvs
    },
    count: verts.length
  })
}

// Creates a regl command that draws a yellow wireframe
function createWireframeCommand (verts, colors) {
  console.log('Drawing wireframe, %d verts, %d colors', verts.length, colors.length)
  return env.regl({
    vert: shaders.vert.colorWorld,
    frag: shaders.frag.color,
    uniforms: {
      uMatrix: camera.updateMatrix
    },
    attributes: {
      aVertexPosition: verts,
      aVertexColor: colors
    },
    primitive: 'lines',
    count: verts.length
  })
}

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * CS * CS + iy * CS + iz]
}

// Helper method for writing up a value from a packed voxel array (XYZ layout)
function setVoxel (data, ix, iy, iz, val) {
  data[ix * CS * CS + iy * CS + iz] = val
}
