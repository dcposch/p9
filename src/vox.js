// Usage:
// VOX.TYPES[1] // { name: 'WATER', ... }
// VOX.INDEX.WATER // equals 1
var VOX = {}
module.exports = VOX

// Voxel (block) types
// The index will be used for serialization over the network and to disk.
// Once that's supported, new block types may only be appended to the end.
VOX.TYPES = [
  {
    name: 'AIR'
  },
  {
    name: 'WATER',
    uvs: {side: [13, 12], top: [13, 12], bottom: [13, 12]}
  },
  {
    name: 'GRASS',
    uvs: {side: [3, 0], top: [1, 9], bottom: [2, 0]}
  },
  {
    name: 'STONE',
    uvs: {side: [1, 0], top: [1, 0], bottom: [1, 0]}
  }
]

// Get the index of each block type
// For example, VOX_INDEX.AIR equals 0
VOX.INDEX = {}
VOX.TYPES.foreach(function (type, i) {
  VOX.INDEX[type.name] = i
})
