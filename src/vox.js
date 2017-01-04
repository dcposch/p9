// Usage:
// VOX.TYPES[1] // { name: 'WATER', uv, sideOffset, ... }
// VOX.INDEX.WATER // equals 1
var VOX = {
  isSolid: isSolid,
  isOpaque: isOpaque
}

module.exports = VOX

// Checks whether a given block index is solid (on-world and not air or water)
function isSolid (v) {
  // -1 is off-world, 0 is air, 1 is water, all other blocks are solid
  return v > 1
}

// Checks whether a block is completely opaque (not air or water, not leaves, etc)
function isOpaque (v) {
  return v >= 0 && VOX.TYPES[v].opaque
}

function VoxType (name, props) {
  this.name = name
  this.uv = Array.isArray(props) ? props : props.uv
  if (Array.isArray(this.uv)) this.uv = {side: this.uv, top: this.uv, bottom: this.uv}
  this.sideOffset = props.sideOffset | 0
  this.opaque = props.opaque == null ? true : !!props.opaque
}

// Voxel (block) types
// The index will be used for serialization over the network and to disk.
// Once that's supported, new block types may only be appended to the end.
VOX.TYPES = [
  new VoxType('AIR', {uv: null, opaque: false}),
  new VoxType('WATER', {uv: [0, 0], opaque: false}),
  new VoxType('GRASS', {uv: {side: [0, 0], top: [0, 0], bottom: [0, 0]}}),
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
  new VoxType('CACTUS', {uv: [0, 0], sideOffset: 1 / 16}),
  new VoxType('LEAVES', [0, 0]),
  new VoxType('POPLAR', [0, 0]),
  new VoxType('STRIPE_WOOD', {uv: {side: [5, 0], top: [6, 0], bottom: [6, 0]}}),
  new VoxType('PLANT_1', {uv: [1, 1], opaque: false}),
  new VoxType('PLANT_2', {uv: [2, 1], opaque: false}),
  new VoxType('PLANT_3', {uv: [3, 1], opaque: false})
]

// Get the index of each block type
// For example, VOX_INDEX.AIR equals 0
VOX.INDEX = {}
VOX.TYPES.forEach(function (type, i) {
  VOX.INDEX[type.name] = i
})
