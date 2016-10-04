var regl = require('regl')
var shell = require('game-shell')
var config = require('./config')

var canvas = document.querySelector('#gl')

module.exports = {
  canvas: canvas,
  regl: regl(canvas),
  shell: shell({
    element: canvas,
    bindings: config.KEYBINDINGS,
    tickRate: config.TICK_INTERVAL * 1000
  })
}

// For easier debugging
window.env = module.exports
