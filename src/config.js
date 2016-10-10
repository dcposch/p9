module.exports = {
  TICK_INTERVAL: 0.01, // Seconds
  CHUNK_WIDTH: 16, // The world is divided into 16x16x64-block chunks
  CHUNK_HEIGHT: 64,
  PLAYER_HEIGHT: 1.5, // The player's head (the camera) is 1.5 blocks above the feet
  SPEED_SPRINT: 15, // Blocks per second
  SPEED_WALK: 5,
  MOUSE_SENSITIVITY: 0.01, // Radians per pixel
  KEYBINDINGS: {
    'nav-forward': ['W', 'up'],
    'nav-left': ['A', 'left'],
    'nav-back': ['S', 'down'],
    'nav-right': ['D', 'right'],
    'nav-sprint': ['shift']
  }
}
