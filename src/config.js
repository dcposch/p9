var CHUNK_BITS = 5

// Configuration, game settings, physics constants
module.exports = {
  TICK_INTERVAL: 0.01, // Seconds
  CHUNK_SIZE: 1 << CHUNK_BITS, // The world is divided into 32x32x32-block chunks
  CHUNK_BITS: CHUNK_BITS,
  PLAYER_WIDTH: 0.5, // You can't get closer than 0.5 meters (blocks) from a block
  PLAYER_HEIGHT: 1.5, // The player's head (the camera) is 1.5 blocks above the feet
  SPEED_SPRINT: 15, // Blocks per second
  SPEED_WALK: 5,
  SPEED_JUMP: 10,
  SPEED_SPRINT_JUMP: 15,
  MOUSE_SENSITIVITY: 0.01, // Radians per pixel
  KEYBINDINGS: {
    'nav-forward': ['W', 'up'],
    'nav-left': ['A', 'left'],
    'nav-back': ['S', 'down'],
    'nav-right': ['D', 'right'],
    'nav-sprint': ['shift'],
    'nav-jump': ['space']
  },
  GRAPHICS: {
    CHUNK_DRAW_RADIUS: 10, // Draw this many chunks in every direction from the player
    MAX_ANISOTROPIC: 0 // Disable anisotropic filtering
  },
  PHYSICS: {
    GRAVITY: 30 // Twice Earth gravity, 20ms^-2, each voxel is 1 m^3
  }
}
