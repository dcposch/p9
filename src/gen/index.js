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
    // Mesh chunk
    meshChunk.mesh(c, state.world)
    // Remesh adjacent chunks
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

  // Remesh chunks, lazily
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
