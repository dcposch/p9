var env = require('./env')
var shaders = require('./shaders')
var version = require('../package.json').version

var canvas = createHiddenCanvas()
var context2D = createContext2D(canvas)
var texture = env.regl.texture(canvas)

// Show a debugging heads-up display.
// Overlays white text onto the top left corner of the screen.
module.exports = env.regl({
  vert: shaders.vert.uvClip,
  frag: shaders.frag.sprite,
  attributes: {
    aVertexPosition: function (context) {
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
      context2D.fillStyle = 'rgba(0, 0, 0, 0.5)'
      context2D.fillRect(0, 0, canvas.width, 25.5 + 20 * text.length)
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
  canvas.width = 400
  canvas.height = 200
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
  ret.push('Version: ' + version)

  var loc = state.player.location
  var dir = state.player.direction
  ret.push('Location: ' + loc.x.toFixed(1) + ', ' + loc.y.toFixed(1) + ', ' + loc.z.toFixed(1))
  ret.push('Azimuth: ' + toDeg(dir.azimuth) + ' deg, altitude: ' + toDeg(dir.altitude) + ' deg')

  var mem = window.performance.memory
  if (mem) {
    ret.push('JS Heap: ' + (mem.usedJSHeapSize >> 20) + ' / ' + (mem.totalJSHeapSize >> 20) + ' MB')
  }

  var totalVerts = 0
  for (var i = 0; i < state.chunks.length; i++) {
    var chunk = state.chunks[i]
    totalVerts += chunk.draw ? chunk.draw.count : 0
  }
  ret.push('Chunks: ' + state.chunks.length + ', verts: ' + totalVerts)

  if (!state.started || !env.shell.fullscreen) {
    ret.push('Click to start')
  }

  return ret
}

// Radians to degrees, rounded to the nearest integer
function toDeg (radians) {
  return Math.round(radians * 180 / Math.PI)
}
