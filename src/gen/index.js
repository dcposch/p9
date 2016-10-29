var perlin = require('../math/perlin')
var vox = require('../vox')
var config = require('../config')
var Chunk = require('../chunk')
var meshChunk = require('../mesh-chunk')

// Generate the world
module.exports = {
  generateWorld
}

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS
var heightmap1 = new Float32Array(CS * CS)
var heightmap2 = new Float32Array(CS * CS)
var heightmap3 = new Float32Array(CS * CS)
var MAX_NEW_CHUNKS = 8
var MAX_REMESH_CHUNKS = 6
var mapToMesh = {}

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
  var maxNew = state.world.chunks.length === 0 ? 1e6 : MAX_NEW_CHUNKS
  for (var i = 0; i < chunksToGenerate.length && newChunks.length < maxNew; i++) {
    var c = chunksToGenerate[i]
    chunk = generateChunk(c.ix, c.iy, c.iz)
    if (!chunk) continue
    state.world.addChunk(chunk)
    newChunks.push(chunk)
  }

  // Mesh
  newChunks.forEach(function (c) {
    // Mesh chunk now
    meshChunk.mesh(c, state.world)
    // Remesh adjacent chunks soon
    mapToMesh[[c.x + CS, c.y, c.z].join(',')] = true
    mapToMesh[[c.x - CS, c.y, c.z].join(',')] = true
    mapToMesh[[c.x, c.y + CS, c.z].join(',')] = true
    mapToMesh[[c.x, c.y - CS, c.z].join(',')] = true
    mapToMesh[[c.x, c.y, c.z + CS].join(',')] = true
    mapToMesh[[c.x, c.y, c.z - CS].join(',')] = true
  })
  // Don't remesh the new chunks themselves, those are already done
  newChunks.forEach(function (c) {
    delete mapToMesh[[c.x, c.y, c.z].join(',')]
  })

  // Quit if there's nothing new to do
  var keysToMesh = Object.keys(mapToMesh)
  if (newChunks.length === 0 && keysToMesh.length === 0) return

  // Delete any no longer needed chunks
  state.world.removeChunks(function (chunk) {
    var dx = (chunk.x >> CB) - cx
    var dy = (chunk.y >> CB) - cy
    var dz = (chunk.z >> CB) - cz
    return dx * dx + dy * dy + dz * dz > radius * radius
  })

  // Remesh chunks
  var numRemeshed = 0
  for (i = 0; i < keysToMesh.length; i++) {
    var key = keysToMesh[i]
    var coords = key.split(',').map(Number)
    chunk = state.world.getChunk(coords[0], coords[1], coords[2])
    if (chunk) {
      meshChunk.mesh(chunk, state.world)
      numRemeshed++
    }
    delete mapToMesh[key]
    if (numRemeshed >= MAX_REMESH_CHUNKS) break
  }
  console.log('Generated %d chunks, remeshed %d', newChunks.length, numRemeshed)
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
  perlin.generate(heightmap1, x, y, CS, perlinGroundAmplitudes)
  perlin.generate(heightmap2, x, y, CS, perlinLayer2Amplitudes)
  perlin.generate(heightmap3, x, y, CS, perlinLayer3Amplitudes)

  // Go from a Perlin heightmap to actual voxels
  for (var ix = 0; ix < CS; ix++) {
    for (var iy = 0; iy < CS; iy++) {
      var height1 = heightmap1[ix * CS + iy]
      var height2 = heightmap2[ix * CS + iy]
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

      // Place plants
      var h1 = Math.ceil(height1)
      var isShore = h1 >= 15 && h1 <= 18
      var cactusJuice = height2 > 4.0 ? 2.0 : (height2 % 1.0) * 20.0
      var palmJuice = (height2 > 14.0 || height2 < 10.0) ? 2.0 : (height2 % 1.0) * 50.0
      if (isShore && cactusJuice < 1.0) {
        var cactusHeight = Math.floor(cactusJuice * 3.0) + 1
        for (voxz = h1; voxz < h1 + cactusHeight; voxz++) {
          trySet(ret, ix, iy, voxz - z, vox.INDEX.CACTUS)
        }
      } else if (isShore && palmJuice < 1.0) {
        var palmHeight = Math.floor(palmJuice * 10) + 5
        for (voxz = h1; voxz < h1 + palmHeight; voxz++) {
          trySet(ret, ix, iy, voxz - z, vox.INDEX.BROWN)
          if (voxz !== h1 + palmHeight - 1) continue
          trySet(ret, ix, iy, voxz - z, vox.INDEX.LEAVES)
          trySet(ret, ix + 1, iy + 1, voxz - z, vox.INDEX.LEAVES)
          trySet(ret, ix + 1, iy - 1, voxz - z, vox.INDEX.LEAVES)
          trySet(ret, ix - 1, iy + 1, voxz - z, vox.INDEX.LEAVES)
          trySet(ret, ix - 1, iy - 1, voxz - z, vox.INDEX.LEAVES)
        }
      }
    }
  }

  return ret
}

function trySet (chunk, ix, iy, iz, v) {
  if (ix < 0 || iy < 0 || iz < 0 || ix >= CS || iy >= CS || iz >= CS) return
  chunk.setVox(ix, iy, iz, v)
}
