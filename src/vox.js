// Usage:
// VOX.TYPES[1] // { name: 'WATER', uv, sideOffset, ... }
// VOX.INDEX.WATER // equals 1
var VOX = {
  isSolid: isSolid
}

module.exports = VOX

// Checks whether a given block index is solid (on-world and not air or water)
function isSolid (v) {
  // -1 is off-world, 0 is air, 1 is water, all other blocks are solid
  return v > 1
}

function VoxType (name, uv, sideOffset) {
  this.name = name
  this.uv = Array.isArray(uv) ? {side: uv, top: uv, bottom: uv} : uv
  this.sideOffset = sideOffset || 0
}

// Voxel (block) types
// The index will be used for serialization over the network and to disk.
// Once that's supported, new block types may only be appended to the end.
VOX.TYPES = [
  new VoxType('AIR'),
  new VoxType('WATER', [0, 0]),
  new VoxType('GRASS', {side: [0, 0], top: [0, 0], bottom: [0, 0]}),
  new VoxType('STONE', [4, 0]),
  new VoxType('RED', [10, 0]),
  new VoxType('PINK', [9, 0]),
  new VoxType('DARK_GREEN', [12, 0]),
  new VoxType('LIGHT_GREEN', [11, 0]),
  new VoxType('BROWN', [1, 0]),
  new VoxType('YELLOW', [15, 0]),
  new VoxType('DARK_BLUE', [14, 0]),
  new VoxType('LIGHT_BLUE', [13, 0]),
  new VoxType('DARK_PURPLE', [8, 0]),
  new VoxType('LIGHT_PURPLE', [7, 0]),
  new VoxType('CACTUS', [0, 0], 1 / 16),
  new VoxType('LEAVES', [0, 0]),
  new VoxType('POPLAR', [0, 0]),
  new VoxType('STRIPE_WOOD', {side: [5, 0], top: [6, 0], bottom: [6, 0]}),
  new VoxType('PLANT_1', [1, 1]),
  new VoxType('PLANT_2', [1, 2]),
  new VoxType('PLANT_3', [1, 3])
]

// Get the index of each block type
// For example, VOX_INDEX.AIR equals 0
VOX.INDEX = {}
VOX.TYPES.forEach(function (type, i) {
  VOX.INDEX[type.name] = i
})
