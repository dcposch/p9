module.exports = {
  PLAYER_HEIGHT: 1.5, // The player's head (the camera) is 1.5 blocks above the feet
  SPEED_SPRINT: 5, // Blocks per second
  SPEED_WALK: 20,
  MOUSE_SENSITIVITY: 0.01, // Radians per pixel
  TICK_INTERVAL: 0.01, // Seconds
  KEYBINDINGS: {
    'nav-forward': ['W', 'up'],
    'nav-left': ['A', 'left'],
    'nav-back': ['S', 'down'],
    'nav-right': ['D', 'right'],
    'nav-sprint': ['shift']
  }
}
