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

// Compile regl command
var chunkCommand = env.regl({
  // To profile, use this property, then add the following line to the render loop:
  // if (context.tick % 100 === 0) console.log(JSON.stringify(drawChunk.stats))
  // profile: true,
  vert: shaders.vert.uvWorld,
  frag: shaders.frag.voxel,
  uniforms: {
    uAtlas: function () { return textures.loaded.atlas }
  },
  attributes: {
    aPosition: env.regl.prop('verts'),
    aNormal: env.regl.prop('normals'),
    aUV: env.regl.prop('uvs')
  },
  count: env.regl.prop('count')
})

// Draw voxel chunks, once resources are loaded.
function drawWorld (state) {
  cullChunks(state)
  chunkCommand(meshes)
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
    if (!chunk.mesh || chunk.mesh.count === 0) continue

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
