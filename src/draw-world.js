var env = require('./env')
var config = require('./config')
var shaders = require('./shaders')
var camera = require('./camera')

// Draws the voxels.
// Does not draw the player or UI overlays.
module.exports = drawWorld

// Start loading resources immediately
var chunkScopeCommand, chunkCommand
var textureAtlas
var meshes = []
loadResources(createCommands)

// Draw all voxel chunks, once resources are loaded.
function drawWorld (state) {
  if (!chunkScopeCommand) return
  var chunks = state.world.chunks
  var j = 0
  for (var i = 0; i < chunks.length; i++) {
    var mesh = chunks[i].mesh
    if (mesh) meshes[j++] = mesh
  }
  meshes.length = j
  chunkScopeCommand(state, function () {
    chunkCommand(meshes)
  })
}

// Loads resources. Calls back when done
function loadResources (cb) {
  // Load voxel atlas texture
  var aniso = Math.min(env.regl.limits.maxAnisotropic, config.GRAPHICS.MAX_ANISOTROPIC)
  var image = new window.Image()
  image.src = 'textures/isabella.png'
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
      uLightAmbient: [0.6, 0.6, 0.6]
    },
    blend: {
      enable: true,
      func: {
        src: 'src alpha',
        dst: 'one minus src alpha'
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
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
