var config = require('./config')

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS

module.exports = World

// Keeps track of the world and everything in it
// Keeps a compact representation, and provides lookup and iteration.
// Does NOT do:
// - Projection or picking
// - Rendering
// - Change tracking
// - Serialization
function World () {
  this.chunks = []
  this.chunkTable = {}
}

World.prototype = {
  addChunk: addChunk,
  removeChunk: removeChunk,
  removeChunks: removeChunks,
  getChunk: getChunk,
  getVox: getVox
}

// Adds a new chunk (cube of voxels) to the world
// Should contain {x, y, z, data, mesh}
function addChunk (chunk) {
  var key = chunk.x + ',' + chunk.y + ',' + chunk.z
  this.chunks.push(chunk)
  this.chunkTable[key] = chunk
}

// Removes a chunk from the world.
// Takes a chunk object or any object {x, y, z}
function removeChunk (chunk) {
  var key = chunk.x + ',' + chunk.y + ',' + chunk.z
  for (var i = 0; i < this.chunks.length; i++) {
    var c = this.chunks[i]
    if (c.x !== chunk.x || c.y !== chunk.y || c.z !== chunk.z) continue
    this.chunks.splice(i, 1)
    break
  }
  delete this.chunkTable[key]
}

// Efficiently removes multiple chunks from the world, O(n) where n is total # of chunks.
// Takes a predicate that returns whether a given chunk should be removed.
function removeChunks (predicate) {
  var offset = 0
  for (var i = 0; i < this.chunks.length; i++) {
    var chunk = this.chunks[i]
    if (offset > 0) this.chunks[i - offset] = chunk
    if (!predicate(chunk)) continue
    // Nuke `chunk`
    offset++
    var key = chunk.x + ',' + chunk.y + ',' + chunk.z
    delete this.chunkTable[key]
    // TODO: Chunk.prototype.destroy
  }
  console.log(this.chunks.length + ', removing ' + offset)
  if (offset > 0) this.chunks.length = this.chunks.length - offset
}

// Returns the voxel at (x, y, z), or -1 if that chunk doesn't exist
function getVox (x, y, z) {
  var cx = x >> CB << CB
  var cy = y >> CB << CB
  var cz = z >> CB << CB
  var key = cx + ',' + cy + ',' + cz
  var chunk = this.chunkTable[key]
  if (!chunk) return -1
  return chunk.data[(x - cx) * CS * CS + (y - cy) * CS + (z - cz)]
}

// Returns the chunk AT (x, y, z), not the chunk containing (x, y, z)
// Returns undefined if that chunk doesn't exist
function getChunk (x, y, z) {
  var key = x + ',' + y + ',' + z
  return this.chunkTable[key]
}
