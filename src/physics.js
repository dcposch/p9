var config = require('./config')
var CS = config.CHUNK_SIZE

module.exports = {
  simulatePlayer: simulatePlayer
}

function simulatePlayer (state) {
  var loc = state.player.location
  loc.z -= 0.5
  var dirs = [
    [1, 0, -0.5],
    [-1, 0, -0.5],
    [0, 1, -0.5],
    [0, -1, -0.5],
    [0, 0, 1]
  ]
  var dloc = [0, 0, 0]
  var eps = 0.1
  dirs.forEach(function (dir) {
    if (!collide(state, loc.x + dir[0], loc.y + dir[1], loc.x + dir[2])) return
    dloc[0] -= dir[0] * eps
    dloc[1] -= dir[1] * eps
    dloc[2] -= dir[2] * eps
  })
  state.player.location.x += dloc[0]
  state.player.location.y += dloc[1]
  state.player.location.z += dloc[2]
}

function collide (state, x, y, z) {
  for (var i = 0; i < state.chunks.length; i++) {
    var chunk = state.chunks[i]
    if (chunk.x > x || chunk.y > y || chunk.z > z) continue
    if (chunk.x + CS < x || chunk.y + CS < y || chunk.z + CS < z) continue
    var ix = Math.floor(x - chunk.x)
    var iy = Math.floor(y - chunk.y)
    var iz = Math.floor(z - chunk.z)
    return !!getVoxel(chunk.data, ix, iy, iz)
  }
  return false
}

// Helper method for looking up a value from a packed voxel array (XYZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[ix * CS * CS + iy * CS + iz]
}
