var env = require('./env')
var shaders = require('./shaders')
var version = require('../../package.json').version
var vox = require('../vox')

var canvas = createHiddenCanvas()
var context2D = createContext2D(canvas)
var texture = env.regl.texture(canvas)

// Show a debugging heads-up display.
// Overlays white text onto the top left corner of the screen.
module.exports = env.regl({
  vert: shaders.vert.uvClip,
  frag: shaders.frag.texture,
  attributes: {
    aPosition: function (context) {
      var w = canvas.width / context.viewportWidth * 2
      var h = canvas.height / context.viewportHeight * 2
      return [[-1, 1], [-1 + w, 1], [-1 + w, 1 - h], [-1 + w, 1 - h], [-1, 1 - h], [-1, 1]]
    },
    aUV: [[0, 0], [1, 0], [1, 1], [1, 1], [0, 1], [0, 0]]
  },
  uniforms: {
    uTexture: function (context, props) {
      var text = createDebugText(props)
      context2D.clearRect(0, 0, canvas.width, canvas.height)
      context2D.fillStyle = 'rgba(0, 0, 0, 0.6)'
      context2D.fillRect(0, 0, canvas.width, canvas.height)
      context2D.fillStyle = '#fff'
      for (var i = 0; i < text.length; i++) context2D.fillText(text[i], 10.5, 25.5 + 20 * i)
      texture(canvas)
      return texture
    }
  },
  blend: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 'src alpha',
      dstRGB: 'one minus src alpha',
      dst: 'one'
    }
  },
  count: 6
})

function createHiddenCanvas () {
  var canvas = document.createElement('canvas')
  canvas.width = 450
  canvas.height = 170
  return canvas
}

function createContext2D (canvas) {
  var context2D = canvas.getContext('2d')
  context2D.font = '16px monospace'
  context2D.fillStyle = '#fff'
  return context2D
}

function createDebugText (state) {
  var ret = []
  ret.push('P9 ' + version)

  var loc = state.player.location
  var vel = state.player.velocity
  var dir = state.player.direction
  ret.push('Location: ' + pointToString(loc, 1) + ', d/dt ' + pointToString(vel, 1) +
    ', ' + state.player.situation)
  ret.push('Azith: ' + toDeg(dir.azimuth) + '°, alt: ' + toDeg(dir.altitude) + '°, ' +
    'dzdt: ' + state.player.dzdt.toFixed(1))

  var mem = window.performance.memory
  if (mem) {
    ret.push('JS Heap: ' + (mem.usedJSHeapSize >> 20) + ' / ' + (mem.totalJSHeapSize >> 20) +
      ' MB, FPS: ' + Math.round(state.perf.fps))
  }

  var totalVerts = 0
  var chunks = state.world.chunks
  for (var i = 0; i < chunks.length; i++) {
    var chunk = chunks[i]
    totalVerts += chunk.mesh ? chunk.mesh.count : 0
  }
  ret.push('Chunks: ' + state.world.chunks.length + ', verts: ' + k(totalVerts) +
    ', draw ' + state.perf.draw.chunks + ' / ' + k(state.perf.draw.verts))

  if (state.player.lookAtBlock) {
    var b = state.player.lookAtBlock
    ret.push('Looking at: ' + pointToString(b.location, 0) + ' ' + vox.TYPES[b.voxel].name)
  } else {
    ret.push('Looking at: sky')
  }

  ret.push('Placing ' + vox.TYPES[state.controls.placing].name)

  return ret
}

// Returns eg "25k" for 25181
function k (v) {
  return Math.round(v / 1000) + 'k'
}

// Returns "x,y,z". Displays d decimal points
function pointToString (loc, d) {
  return loc.x.toFixed(d) + ', ' + loc.y.toFixed(d) + ', ' + loc.z.toFixed(d)
}

// Radians to degrees, rounded to the nearest integer
function toDeg (radians) {
  return Math.round(radians * 180 / Math.PI)
}
