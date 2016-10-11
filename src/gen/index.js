var perlin = require('../math/perlin')
var vox = require('../vox')
var config = require('../config')

// Generate the world
module.exports = {
  generateChunk
}

var cs = config.CHUNK_SIZE
var heightmap = new Float32Array(cs * cs)

// Generates one chunk
// Returns a newly allocated Chunk: { x, y, z, data: UInt8Array }
function generateChunk (x, y, z) {
  var data = new Uint8Array(cs * cs * cs)
  var splash = 0.5 - 0.5 * Math.cos(Math.sqrt(x * x + y * y) / 100)
  var perlinHeightmapAmplitudes = [0, 0, 0, 0, 5, 0, 10, 0, 0, 0, 40]
  perlin.generate(heightmap, x, y, cs, perlinHeightmapAmplitudes)

  // Go from a Perlin heightmap to actual voxels
  for (var ix = 0; ix < cs; ix++) {
    for (var iy = 0; iy < cs; iy++) {
      var height = heightmap[ix * cs + iy]
      for (var iz = 0; iz < cs; iz++) {
        var voxz = z + iz
        var voxtype
        if (voxz < height && voxz > 30) {
          voxtype = vox.INDEX.STONE
        } else if (voxz < height) {
          voxtype = vox.INDEX.GRASS
        } else if (voxz < 15) {
          voxtype = vox.INDEX.WATER
        } else {
          voxtype = vox.INDEX.AIR
        }
        data[ix * cs * cs + iy * cs + iz] = voxtype
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
