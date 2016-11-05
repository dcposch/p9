// Usage:
// VOX.TYPES[1] // { name: 'WATER', ... }
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

// Voxel (block) types
// The index will be used for serialization over the network and to disk.
// Once that's supported, new block types may only be appended to the end.
VOX.TYPES = [
  {
    name: 'AIR'
  },
  {
    name: 'WATER',
    uv: {side: [13, 12], top: [13, 12], bottom: [13, 12]}
  },
  {
    name: 'GRASS',
    uv: {side: [3, 0], top: [1, 9], bottom: [2, 0]}
  },
  {
    name: 'STONE',
    uv: {side: [1, 0], top: [1, 0], bottom: [1, 0]}
  },
  {
    name: 'RED',
    uv: {side: [1, 8], top: [1, 8], bottom: [1, 8]}
  },
  {
    name: 'PINK',
    uv: {side: [2, 8], top: [2, 8], bottom: [2, 8]}
  },
  {
    name: 'DARK_GREEN',
    uv: {side: [1, 9], top: [1, 9], bottom: [1, 9]}
  },
  {
    name: 'LIGHT_GREEN',
    uv: {side: [2, 9], top: [2, 9], bottom: [2, 9]}
  },
  {
    name: 'BROWN',
    uv: {side: [1, 10], top: [1, 10], bottom: [1, 10]}
  },
  {
    name: 'YELLOW',
    uv: {side: [2, 10], top: [2, 10], bottom: [2, 10]}
  },
  {
    name: 'DARK_BLUE',
    uv: {side: [1, 11], top: [1, 11], bottom: [1, 11]}
  },
  {
    name: 'LIGHT_BLUE',
    uv: {side: [2, 11], top: [2, 11], bottom: [2, 11]}
  },
  {
    name: 'DARK_PURPLE',
    uv: {side: [1, 12], top: [1, 12], bottom: [1, 12]}
  },
  {
    name: 'LIGHT_PURPLE',
    uv: {side: [2, 12], top: [2, 12], bottom: [2, 12]}
  },
  {
    name: 'CACTUS',
    uv: {side: [6, 4], top: [5, 4], bottom: [7, 4]},
    sideOffset: 1 / 16
  },
  {
    name: 'LEAVES',
    uv: {side: [4, 12], top: [4, 12], bottom: [4, 12]}
  },
  {
    name: 'POPLAR',
    uv: {side: [5, 7], top: [5, 1], bottom: [5, 1]}
  },
  {
    name: 'STRIPE_WOOD',
    uv: {side: [7, 12], top: [5, 1], bottom: [5, 1]}
  },
  {
    name: 'PLANT_1',
    uv: {side: [8, 10], top: [8, 10], bottom: [8, 10]}
  },
  {
    name: 'PLANT_2',
    uv: {side: [9, 10], top: [9, 10], bottom: [9, 10]}
  },
  {
    name: 'PLANT_3',
    uv: {side: [10, 10], top: [10, 10], bottom: [10, 10]}
  }
]

// Get the index of each block type
// For example, VOX_INDEX.AIR equals 0
VOX.INDEX = {}
VOX.TYPES.forEach(function (type, i) {
  VOX.INDEX[type.name] = i
})
