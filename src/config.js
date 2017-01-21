var CHUNK_BITS = 5

// Configuration, game settings, physics constants
module.exports = {
  TICK_INTERVAL: 0.1, // Seconds
  CHUNK_SIZE: 1 << CHUNK_BITS, // The world is divided into 32x32x32-block chunks
  CHUNK_BITS: CHUNK_BITS,
  PLAYER_WIDTH: 0.5, // You can't get closer than 0.5 meters (blocks) from a block
  PLAYER_HEIGHT: 1.5, // The player's head (the camera) is 1.5 blocks above the feet
  SPEED_WALK: 4, // Blocks per second
  SPEED_SPRINT: 6,
  SPEED_JUMP: 6,
  SPEED_SPRINT_JUMP: 8,
  MOUSE_SENSITIVITY: 0.005, // Radians per pixel
  KEYBINDINGS: {
    'nav-forward': ['W', 'up'],
    'nav-left': ['A', 'left'],
    'nav-back': ['S', 'down'],
    'nav-right': ['D', 'right'],
    'nav-sprint': ['shift'],
    'nav-jump': ['space']
  },
  MAX_PICK_DISTANCE: 10, // Can place or break blocks up to 10 blocks away
  MAX_EXTRAPOLATE_MS: 100,
  GRAPHICS: {
    CHUNK_DRAW_RADIUS: 15, // Draw this many chunks in every direction from the player
    MAX_ANISOTROPIC: 0 // Disable anisotropic filtering
  },
  PHYSICS: {
    MAX_DT: 0.01, // Compute physics in increments of at most 10ms to avoid glitches
    GRAVITY: 20 // -Z acceleration in ms^-2, each block is 1 m^3
  },
  WORLD_GEN: {
    CHUNK_RADIUS: 20 // Generate this many chunk in every direction from every player
  },
  CLIENT: {
    VERSION: 0
  },
  SERVER: {
    CHUNK_SEND_RADIUS: 15,
    VERSION: 0,
    PORT: 8080
  }
}
