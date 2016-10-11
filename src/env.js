var regl = require('regl')
var shell = require('game-shell')
var config = require('./config')

var canvas = document.querySelector('#gl')

module.exports = {
  canvas: canvas,
  regl: regl({
    canvas: canvas,
    optionalExtensions: ['EXT_texture_filter_anisotropic']
  }),
  shell: shell({
    element: canvas,
    bindings: config.KEYBINDINGS,
    tickRate: config.TICK_INTERVAL * 1000
  })
}

// Don't intercept standard browser keyboard shortcuts
module.exports.shell.preventDefaults = false

// For easier debugging
window.env = module.exports
