var env = require('./env')
var config = require('../config')
var shaders = require('./shaders')
var camera = require('./camera')
var textures = require('./textures')
var vec3 = {
  create: require('gl-vec3/create'),
  transformMat4: require('gl-vec3/transformMat4')
}

// Draws the voxels.
// Does not draw the player or UI overlays.
module.exports = drawWorld

var CS = config.CHUNK_SIZE

// Allocate once, update every frame in cullChunks()
var meshes = []
var meshesTrans = []

var chunkCommand, chunkCommandTranslucent

// Compile regl commands, if necessary. Returns true if regl commands are ready to go.
// Returns false if we're still waiting for resources to finish loading.
function compileCommands () {
  if (chunkCommand) return true
  if (!textures.loaded.atlas) return false

  var params = {
    // To profile, use this property, then add the following line to the render loop:
    // if (context.tick % 100 === 0) console.log(JSON.stringify(drawChunk.stats))
    // profile: true,
    vert: shaders.vert.uvWorld,
    frag: shaders.frag.voxel,
    uniforms: {
      uAtlas: textures.loaded.atlas
    },
    attributes: {
      aPosition: env.regl.prop('verts'),
      aNormal: env.regl.prop('normals'),
      aUV: env.regl.prop('uvs')
    },
    count: env.regl.prop('count')
  }

  chunkCommand = env.regl(params)
  chunkCommandTranslucent = env.regl(Object.assign({}, params, {
    blend: {
      enable: true,
      func: {
        src: 'src alpha',
        dst: 'one minus src alpha'
      }
    }
  }))
}

// Draw voxel chunks, once resources are loaded.
function drawWorld (state) {
  if (!compileCommands()) return
  cullChunks(state)
  // Draw opaque layer first, then translucent meshes, farthest to nearest
  chunkCommand(meshes)
  chunkCommandTranslucent(meshesTrans)
}

// Figure out which chunks we have to draw
// TODO: cave culling
function cullChunks (state) {
  var chunks = state.world.chunks
  var loc = state.player.location
  var maxDistance = config.GRAPHICS.CHUNK_DRAW_RADIUS * config.CHUNK_SIZE
  var matCombined = camera.getMatrix('combined')

  var numOpaque = 0
  var numTrans = 0
  var totalVerts = 0
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]

    // Don't draw chunks that are all air
    var opaqueVerts = chunk.mesh.opaque ? chunk.mesh.opaque.count : 0
    var transVerts = chunk.mesh.trans ? chunk.mesh.trans.count : 0
    if (opaqueVerts + transVerts === 0) continue

    // Don't draw chunks that are too far away
    var dx = loc.x - chunk.x
    var dy = loc.y - chunk.y
    var dz = loc.z - chunk.z
    var d2 = dx * dx + dy * dy + dz * dz
    if (d2 > maxDistance * maxDistance) continue

    // Frustum culling: don't draw chunks that are behind us
    var isClose = d2 < CS * CS * 4
    if (!isClose && chunkOutsideFrustum(matCombined, chunk)) continue

    // TODO: no mesh should have count === 0
    if (opaqueVerts > 0) meshes[numOpaque++] = chunk.mesh.opaque
    if (transVerts > 0) meshesTrans[numTrans++] = chunk.mesh.trans
    totalVerts += opaqueVerts + transVerts
  }
  meshes.length = numOpaque
  meshesTrans.length = numTrans

  state.perf.draw.chunks = numOpaque
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
