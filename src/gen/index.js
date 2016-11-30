var perlin = require('../math/perlin')
var vox = require('../vox')
var config = require('../config')
var Chunk = require('../chunk')

// Generate the world
module.exports = {
  generateWorld,
  generateWorldAt
}

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS

// Sample Perlin noise a few voxels around each chunk.
// That tells us if we need to eg. place leaves for a tree rooted in an adjacent chunk.
var PAD = 3
var PAD2 = 2 * PAD

// Allocate Perlin heightmaps once, re-use
var perlin1 = new Float32Array((CS + PAD2) * (CS + PAD2))
var perlin2 = new Float32Array((CS + PAD2) * (CS + PAD2))
var perlin3 = new Float32Array(CS * CS)

// Keep track of every chunk location that's had a player in it
var chunksTravelled = {}

// Generate chunks in a radius around each player
function generateWorld (state) {
  var n = 0
  for (var i = 0; i < state.clients.length; i++) {
    var client = state.clients[i]
    if (!client.player || !client.player.location) continue
    generateWorldAt(state.world, client.player.location)
  }
}

// Generate any missing chunks in a radius around a point
function generateWorldAt (world, loc)
  // First, check whether we've already generated the world around this chunk
  var cx = loc.x >> CB << CB
  var cy = loc.y >> CB << CB
  var cz = loc.z >> CB << CB
  var key = cx + ',' + cy + ',' + cz
  if (chunksTravelled[key]) return
  chunksTravelled[key] = true

  // If not, fill in any missing chunks
  var radius = config.WORLD_GEN.CHUNK_RADIUS
  for (var dx = -radius; dx < radius; dx++) {
    for (var dy = -radius; dy < radius; dy++) {
      for (var dz = -radius; dz < radius; dz++) {
        var d2 = dx * dx + dy * dy + dz * dz
        if (d2 > radius * radius) continue
        var ix = cx + (dx << CB)
        var iy = cy + (dy << CB)
        var iz = cz + (dz << CB)
        var chunk = world.getChunk(ix, iy, iz)
        if (chunk) continue
        chunk = generateChunk(ix, iy, iz)
        world.addChunk(chunk)
      }
    }
  }
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
  perlin.generate2D(perlin1, x - PAD, y - PAD, CS + PAD2, perlinGroundAmplitudes)
  perlin.generate2D(perlin2, x - PAD, y - PAD, CS + PAD2, perlinLayer2Amplitudes)
  perlin.generate2D(perlin3, x, y, CS, perlinLayer3Amplitudes)

  // Go from Perlin noise to voxels
  placeLand(ret)
  placeTrees(ret)

  // Go from flat array of voxels to list-of-quads, save 90+% space
  ret.pack()
  return ret
}

function placeLand (ret) {
  for (var ix = 0; ix < CS; ix++) {
    for (var iy = 0; iy < CS; iy++) {
      var height1 = perlin1[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var height2 = perlin2[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var height3 = perlin3[ix * CS + iy]

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
}

function placeTrees (ret) {
  for (ix = -2; ix < CS + PAD; ix++) {
    for (iy = -2; iy < CS + PAD; iy++) {
      var h1 = perlin1[(ix + PAD) * (CS + PAD2) + iy + PAD]
      var h2 = perlin2[(ix + PAD) * (CS + PAD2) + iy + PAD]
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
              var h2J = perlin2[(ix + jx + PAD) * (CS + PAD2) + iy + jy + PAD]
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
}

function trySet (chunk, ix, iy, iz, v, overwrite) {
  if (ix < 0 || iy < 0 || iz < 0 || ix >= CS || iy >= CS || iz >= CS) return
  if (!overwrite && chunk.getVox(ix, iy, iz) !== vox.INDEX.AIR) return
  chunk.setVox(ix, iy, iz, v)
}
