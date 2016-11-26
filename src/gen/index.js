var perlin = require('../math/perlin')
var vox = require('../vox')
var config = require('../config')
var Chunk = require('../chunk')

// Generate the world
module.exports = {
  generateWorld
}

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS
var PAD = 3
var PAD2 = 2 * PAD
var heightmap1 = new Float32Array((CS + PAD2) * (CS + PAD2))
var heightmap2 = new Float32Array((CS + PAD2) * (CS + PAD2))
var heightmap3 = new Float32Array(CS * CS)
var MAX_NEW_CHUNKS = 8

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
  var maxNew = state.world.chunks.length === 0 ? 1e6 : MAX_NEW_CHUNKS
  var numNew = 0
  for (var i = 0; i < chunksToGenerate.length && numNew < maxNew; i++) {
    var c = chunksToGenerate[i]
    chunk = generateChunk(c.ix, c.iy, c.iz)
    if (!chunk) continue
    state.world.addChunk(chunk)
    numNew++
  }

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
  var ret = new Chunk(x, y, z)
  if (z >= 128 || z < 0) return ret

  // Generate a Perlin heightmap
  // https://web.archive.org/web/20160421115558/http://freespace.virgin.net/hugo.elias/models/m_perlin.htm
  var mountainAmp = function (rand, sx, sy) {
    var splash = 0.5 - 0.5 * Math.cos(Math.sqrt(sx * sx + sy * sy) / 50)
    return 100 * splash * (rand + 0.5)
  }
  var perlinGroundAmplitudes = [0, 0, 0, 0, 5, 0, 10, 0, 0, mountainAmp]
  var perlinLayer2Amplitudes = [0, 5, 0, 0, 0, 10]
  var perlinLayer3Amplitudes = [0, 0, 0, 5, 0, 10]
  perlin.generate2D(heightmap1, x - PAD, y - PAD, CS + PAD2, perlinGroundAmplitudes)
  perlin.generate2D(heightmap2, x - PAD, y - PAD, CS + PAD2, perlinLayer2Amplitudes)
  perlin.generate2D(heightmap3, x, y, CS, perlinLayer3Amplitudes)

  // Go from a Perlin heightmap to actual voxels
  for (var ix = 0; ix < CS; ix++) {
    for (var iy = 0; iy < CS; iy++) {
      var height1 = heightmap1[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var height2 = heightmap2[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var height3 = heightmap3[ix * CS + iy]

      // Place earth and water
      for (var iz = 0; iz < CS; iz++) {
        var voxz = z + iz
        var voxtype
        if (voxz < height1 && voxz > 40.0 + height2) {
          voxtype = vox.INDEX.PINK
        } else if (voxz < height1 && voxz > 20.0 + height3) {
          voxtype = vox.INDEX.LIGHT_PURPLE
        } else if (voxz < height1) {
          voxtype = vox.INDEX.DARK_PURPLE
        } else if (voxz < 15) {
          voxtype = vox.INDEX.WATER
        } else {
          voxtype = vox.INDEX.AIR
        }
        ret.setVox(ix, iy, iz, voxtype)
      }
    }
  }

  // Place plants
  for (ix = -2; ix < CS + PAD; ix++) {
    for (iy = -2; iy < CS + PAD; iy++) {
      var h1 = heightmap1[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var h2 = heightmap2[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var i1 = Math.ceil(h1)
      var isShore = i1 >= 15 && i1 <= 18
      var palmJuice = (h2 > 14.0 || h2 < 10.0) ? 2.0 : (h2 % 1.0) * 50.0 // range [0, 50)
      if (!isShore || palmJuice > 1.0) continue
      if (i1 >= z + CS || i1 + palmHeight < z) continue
      // If we're here, we're placing a palm tree, and palmJuice is in [0, 1)
      var palmHeight = Math.floor(palmJuice * 10.0) + 4
      for (iz = i1 - z; iz < i1 + palmHeight - z; iz++) {
        // First, place the leaves
        var crown = i1 + palmHeight - z - iz - 1
        var setLeaf = false
        if (crown <= 2) {
          for (var jx = -3; jx <= 3; jx++) {
            for (var jy = -3; jy <= 3; jy++) {
              if (ix + jx < 0 || ix + jx >= CS || iy + jy < 0 || iy + jy >= CS) continue
              var h2J = heightmap2[(ix + jx + PAD) * (CS + PAD2) + iy + jy + PAD]
              var palmJuiceJ = h2J % 1.0
              var leafJuice = Math.abs(Math.abs(jx) + Math.abs(jy) - crown)
              if (leafJuice > palmJuiceJ + 0.5) continue
              var leafType = Math.max(0, Math.min(2, crown - leafJuice))
              voxtype = [vox.INDEX.PLANT_1, vox.INDEX.PLANT_2, vox.INDEX.PLANT_3][leafType]
              setLeaf = setLeaf || (jx === 0 && jy === 0)
              trySet(ret, ix + jx, iy + jy, iz, voxtype)
            }
          }
        }
        // Then, place the trunk
        if (!setLeaf) trySet(ret, ix, iy, iz, vox.INDEX.STRIPE_WOOD, true)
      }
    }
  }

  return ret
}

function trySet (chunk, ix, iy, iz, v, overwrite) {
  if (ix < 0 || iy < 0 || iz < 0 || ix >= CS || iy >= CS || iz >= CS) return
  if (!overwrite && chunk.getVox(ix, iy, iz) !== vox.INDEX.AIR) return
  chunk.setVox(ix, iy, iz, v)
}
