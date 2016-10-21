var perlin = require('../math/perlin')
var vox = require('../vox')
var config = require('../config')
var meshChunk = require('../mesh-chunk')

// Generate the world
module.exports = {
  generateWorld
}

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS
var heightmap = new Float32Array(CS * CS)

// Generate chunks in a radius around the player
function generateWorld (state) {
  var loc = state.player.location
  var radius = config.GRAPHICS.CHUNK_DRAW_RADIUS
  // Fill in any missing chunks
  forChunkInRadius(loc.x, loc.y, loc.z, radius, function (x, y, z) {
    var chunk = state.world.getChunk(x, y, z)
    if (chunk) return
    chunk = generateChunk(x, y, z)
    if (!chunk) return
    meshChunk.mesh(chunk)
    state.world.addChunk(chunk)
  })
  // Delete any no longer needed chunks
  state.world.removeChunks(function (chunk) {
    var dx = chunk.x >> CB - loc.x >> CB
    var dy = chunk.y >> CB - loc.y >> CB
    var dz = chunk.z >> CB - loc.z >> CB
    return dx * dx + dy * dy + dz * dz > radius * radius
  })
}

// World generation. Generates one chunk of voxels.
// Returns a newly allocated Chunk: { x, y, z, data: UInt8Array }
// or returns undefined if the chunk would be completely empty
function generateChunk (x, y, z) {
  if (z >= 128 || z < 0) return

  var data = new Uint8Array(CS * CS * CS)
  var mountainAmp = function (rand, sx, sy) {
    var splash = 0.5 - 0.5 * Math.cos(Math.sqrt(sx * sx + sy * sy) / 50)
    return 100 * splash * (rand + 0.5)
  }
  var perlinHeightmapAmplitudes = [0, 0, 0, 0, 5, 0, 10, 0, 0, mountainAmp]
  perlin.generate(heightmap, x, y, CS, perlinHeightmapAmplitudes)

  // Go from a Perlin heightmap to actual voxels
  for (var ix = 0; ix < CS; ix++) {
    for (var iy = 0; iy < CS; iy++) {
      var height = heightmap[ix * CS + iy]
      for (var iz = 0; iz < CS; iz++) {
        var voxz = z + iz
        var voxtype
        if (voxz < height && voxz > 20) {
          voxtype = vox.INDEX.STONE
        } else if (voxz < height) {
          voxtype = vox.INDEX.PURPLE
        } else if (voxz < 15) {
          voxtype = vox.INDEX.WATER
        } else {
          voxtype = vox.INDEX.AIR
        }
        data[ix * CS * CS + iy * CS + iz] = voxtype
      }
    }
  }

  return {
    x: x,
    y: y,
    z: z,
    data: data
  }
}

// Calls back with every chunk coordinate within a `radius` sphere of (x, y, z)
function forChunkInRadius (x, y, z, radius, callback) {
  var cx = x >> CB
  var cy = y >> CB
  var cz = z >> CB
  for (var dx = -radius; dx < radius; dx++) {
    for (var dy = -radius; dy < radius; dy++) {
      for (var dz = -radius; dz < radius; dz++) {
        var ix = (cx + dx) << CB
        var iy = (cy + dy) << CB
        var iz = (cz + dz) << CB
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue
        callback(ix, iy, iz)
      }
    }
  }
}
