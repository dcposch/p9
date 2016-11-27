var regl = require('regl')
var shell = require('game-shell')
var config = require('../config')

var canvas = document.querySelector('#gl')
var INITIAL_W = canvas.width
var INITIAL_H = canvas.height

module.exports = {
  canvas: canvas,
  regl: regl({
    canvas: canvas,
    optionalExtensions: [
      'EXT_texture_filter_anisotropic',
      'EXT_disjoint_timer_query'
    ]
  }),
  shell: shell({
    element: canvas,
    bindings: config.KEYBINDINGS,
    tickRate: config.TICK_INTERVAL * 1000
  }),
  resizeCanvasIfNeeded: resizeCanvasIfNeeded
}

// Don't intercept standard browser keyboard shortcuts
var env = module.exports
env.shell.preventDefaults = false

// For easier debugging
window.env = env

// Resize the canvas when going into or out of fullscreen
function resizeCanvasIfNeeded () {
  var w = env.shell.fullscreen ? window.innerWidth : INITIAL_W
  var h = env.shell.fullscreen ? window.innerHeight : INITIAL_H
  if (env.canvas.width !== w || env.canvas.height !== h) {
    env.canvas.width = w
    env.canvas.height = h
    console.log('Set canvas size %d x %d', w, h)
  }
}
