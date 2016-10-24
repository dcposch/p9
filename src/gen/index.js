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
var MAX_NEW_CHUNKS = 10

// Generate chunks in a radius around the player
function generateWorld (state) {
  var loc = state.player.location
  var radius = config.GRAPHICS.CHUNK_DRAW_RADIUS
  var cx = loc.x >> CB
  var cy = loc.y >> CB
  var cz = loc.z >> CB

  // Fill in any missing chunks
  var chunksToGenerate = []
  for (var dx = -radius; dx < radius; dx++) {
    for (var dy = -radius; dy < radius; dy++) {
      for (var dz = -radius; dz < radius; dz++) {
        var d2 = dx * dx + dy * dy + dz * dz
        if (d2 > radius * radius) continue
        var ix = (cx + dx) << CB
        var iy = (cy + dy) << CB
        var iz = (cz + dz) << CB
        var chunk = state.world.getChunk(ix, iy, iz)
        if (chunk) continue
        chunksToGenerate.push({ix: ix, iy: iy, iz: iz, d2: d2})
      }
    }
  }

  // Only generate up to MAX_NEW_CHUNKS chunks, starting with the ones closest to the player
  chunksToGenerate.sort(function (a, b) { return a.d2 - b.d2 })
  var newChunks = []
  for (var i = 0; i < chunksToGenerate.length && newChunks.length < MAX_NEW_CHUNKS; i++) {
    var c = chunksToGenerate[i]
    chunk = generateChunk(c.ix, c.iy, c.iz)
    if (!chunk) continue
    state.world.addChunk(chunk)
    newChunks.push(chunk)
  }
  if (newChunks.length === 0) return
  console.log('Generated %d chunks', newChunks.length)

  // Mesh
  newChunks.forEach(function (chunk) {
    meshChunk.mesh(chunk, state.world)
  })

  // Delete any no longer needed chunks
  state.world.removeChunks(function (chunk) {
    var dx = (chunk.x >> CB) - cx
    var dy = (chunk.y >> CB) - cy
    var dz = (chunk.z >> CB) - cz
    return dx * dx + dy * dy + dz * dz > radius * radius
  })
}

// World generation. Generates one chunk of voxels.
// Returns a newly allocated Chunk: { x, y, z, data: UInt8Array }
// Skips {data} if the chunk would be completely empty
function generateChunk (x, y, z) {
  if (z >= 128 || z < 0) return { x: x, y: y, z: z }

  var data = new Uint8Array(CS * CS * CS)
  var mountainAmp = function (rand, sx, sy) {
    var splash = 0.5 - 0.5 * Math.cos(Math.sqrt(sx * sx + sy * sy) / 50)
    return 100 * splash * (rand + 0.5)
  }
  var perlinHeightmapAmplitudes = [0, 0, 0, 0, 5, 0, 10, 0, 0, mountainAmp]
  perlin.generate(heightmap, x, y, CS, perlinHeightmapAmplitudes)

  // Go from a Perlin heightmap to actual voxels
  var numAir = 0
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
          numAir++
        }
        data[ix * CS * CS + iy * CS + iz] = voxtype
      }
    }
  }

  // Don't store arrays full of zeros
  if (numAir === CS * CS * CS) data = undefined

  return {
    x: x,
    y: y,
    z: z,
    data: data
  }
}
