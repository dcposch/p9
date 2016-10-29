var config = require('./config')
var vox = require('./vox')

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS

// A region of space that fits CHUNK_SIZE^3 voxels
// Coordinates (x, y, z) are aligned to CHUNK_SIZE
module.exports = Chunk

function Chunk (x, y, z) {
  this.x = x
  this.y = y
  this.z = z
  this.data = null
}

// Takes integer coordinates relative to this chunk--in other words, in the range [0, CHUNK_SIZE)
// Returns an integer representing voxel data
Chunk.prototype.getVox = function (ix, iy, iz) {
  if (!this.data) return vox.TYPES.AIR
  return this.data[(ix << CB << CB) + (iy << CB) + iz]
}

// Takes integer coordinates relative to this chunk and a voxel int
Chunk.prototype.setVox = function (ix, iy, iz, v) {
  if (!this.data && v === vox.TYPES.AIR) return
  if (!this.data) this.data = new Uint8Array(CS * CS * CS)
  this.data[(ix << CB << CB) + (iy << CB) + iz] = v
}
