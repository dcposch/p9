var env = require('./env')
var config = require('../config')
var shaders = require('./shaders')
var camera = require('./camera')
var vec3 = require('gl-vec3')

// Draws the voxels.
// Does not draw the player or UI overlays.
module.exports = drawWorld

var CS = config.CHUNK_SIZE

// Start loading resources immediately
var chunkScopeCommand, chunkCommand
var textureAtlas
var meshes = []
loadResources(createCommands)

// Draw voxel chunks, once resources are loaded.
function drawWorld (state) {
  if (!chunkScopeCommand) return
  chunkScopeCommand(state, function () {
    cullChunks(state)
    chunkCommand(meshes)
  })
}

// Figure out which chunks we have to draw
// TODO: cave culling
function cullChunks (state) {
  var chunks = state.world.chunks
  var loc = state.player.location
  var maxDistance = config.GRAPHICS.CHUNK_DRAW_RADIUS * config.CHUNK_SIZE
  var matCombined = camera.getMatrix('combined')
  var totalVerts = 0

  var j = 0
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]

    // Don't draw chunks that are all air
    if (!chunk.mesh) continue

    // Don't draw chunks that are too far away
    var dx = loc.x - chunk.x
    var dy = loc.y - chunk.y
    var dz = loc.z - chunk.z
    var d2 = dx * dx + dy * dy + dz * dz
    if (d2 > maxDistance * maxDistance) continue

    // Frustum culling: don't draw chunks that are behind us
    var isClose = d2 < CS * CS * 4
    if (!isClose && chunkOutsideFrustum(matCombined, chunk)) continue

    totalVerts += chunk.mesh.count
    meshes[j++] = chunk.mesh
  }
  meshes.length = j

  state.perf.draw.chunks = j
  state.perf.draw.verts = totalVerts
}

function chunkOutsideFrustum (matCombined, chunk) {
  var world = new Float32Array([chunk.x, chunk.y, chunk.z]) // World coordinates
  var v = vec3.create() // Clip coordinates. (0, 0, 0) to (1, 1, 1) is in the frame

  for (var i = 0; i < 8; i++) {
    world[0] = chunk.x + (i & 1) * CS
    world[1] = chunk.y + ((i & 2) >> 1) * CS
    world[2] = chunk.z + ((i & 4) >> 2) * CS
    vec3.transformMat4(v, world, matCombined)
    if (v[0] > -1 && v[1] > -1 && v[2] > -1 && v[0] < 1 && v[1] < 1 && v[2] < 1) return false
  }
  return true
}

// Loads resources. Calls back when done
function loadResources (cb) {
  // Load voxel atlas texture
  var aniso = Math.min(env.regl.limits.maxAnisotropic, config.GRAPHICS.MAX_ANISOTROPIC)
  var image = new window.Image()
  image.src = 'textures/atlas-p9.png'
  image.onload = function () {
    console.log('Loaded ' + image.src)
    textureAtlas = env.regl.texture({
      min: 'nearest',
      aniso: aniso,
      mag: 'nearest',
      data: image
    })
    cb()
  }
  console.log('Voxel texture: %s, aniso: %d', image.src, aniso)
}

function createCommands () {
  chunkScopeCommand = drawChunksScope()
  chunkCommand = drawChunk()
}

// Draw all loaded chunks efficiently
function drawChunksScope () {
  return env.regl({
    uniforms: {
      uMatrix: camera.updateMatrix,
      uAtlas: textureAtlas,
      uLightDir: [0.6, 0.48, 0.64],
      uLightDiffuse: [1, 1, 0.9],
      uLightAmbient: [0.6, 0.6, 0.6],
      uAnimateT: function (context) {
        return context.time
      },
      uDepthFog: function (context, props) {
        var secs = (new Date().getTime() - props.startTime) * 0.001
        var t = 1.0 - Math.exp(-secs * 0.1)
        return [1.0, 1.0, 1.0, 400.0 * t]
      }
    },
    blend: {
      enable: false
    }
  })
}

// Creates a regl command that draws a voxel chunk
function drawChunk () {
  return env.regl({
    // To profile, use this property, then add the following line to the render loop:
    // if (context.tick % 100 === 0) console.log(JSON.stringify(drawChunk.stats))
    // profile: true,
    vert: shaders.vert.uvWorld,
    frag: shaders.frag.voxel,
    attributes: {
      aVertexPosition: env.regl.prop('verts'),
      aVertexNormal: env.regl.prop('normals'),
      aVertexUV: env.regl.prop('uvs')
    },
    count: env.regl.prop('count')
  })
}
