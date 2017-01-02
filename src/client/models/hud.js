var env = require('../env')
var shaders = require('../shaders')
var textures = require('../textures')

var HUD_WIDTH = 500
var HUD_HEIGHT = 100

// Draws a Heads-Up Display.
// Shows what kind of block the player is placing.
module.exports = HUD

function HUD () {
  this.selectedIndex = 0
  this.clipY = -1
}

HUD.prototype.draw = function () {
  drawBackground(this)
  drawSelection(this)
}

var drawBackground = env.regl({
  vert: shaders.vert.uvClip,
  frag: shaders.frag.texture,
  attributes: {
    aPosition: function (context, props) {
      var b = calculateBounds(context, props)
      var x0 = b.x0
      var x1 = b.x1
      var y0 = b.y0
      var y1 = b.y1
      return [[x0, y0], [x0, y1], [x1, y1], [x0, y1], [x1, y1], [x1, y0]]
    },
    aUV: function (context, props) {
      return [[0, 0], [0, 1], [1, 1], [0, 1], [1, 1], [1, 0]]
    }
  },
  uniforms: {
    uTexture: function (context, props) { return textures.loaded.hud }
  },
  depth: {
    enable: false
  },
  blend: {
    enable: false
  },
  count: 6,
  primitive: 'triangles'
})

var drawSelection = env.regl({
  vert: shaders.vert.colorClip,
  frag: shaders.frag.color,
  attributes: {
    aPosition: function (context, props) {
      var b = calculateBounds(context, props)
      var xt0 = (67 + 16 * props.selectedIndex) / 256
      var xt1 = (82 + 16 * props.selectedIndex) / 256
      var yt0 = 14 / 32
      var yt1 = 28 / 32
      var x0 = b.x1 * xt0 + b.x0 * (1 - xt0)
      var x1 = b.x1 * xt1 + b.x0 * (1 - xt1)
      var y0 = b.y1 * yt0 + b.y0 * (1 - yt0)
      var y1 = b.y1 * yt1 + b.y0 * (1 - yt1)
      return [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]
    },
    aColor: function (context, props) {
      var c = [1, 0.3, 0.3, 1]
      return [c, c, c, c]
    }
  },
  depth: {
    enable: false
  },
  blend: {
    enable: false
  },
  count: 4,
  primitive: 'line loop',
  lineWidth: 1
})

function calculateBounds (context, props) {
  var w = HUD_WIDTH / context.viewportWidth
  var h = HUD_HEIGHT / context.viewportHeight
  // Bump it a half pixel to prevent blur
  var hw = 1 / context.viewportWidth
  var hh = 1 / context.viewportHeight
  var x0 = -w + hw
  var x1 = w + hw
  var y0 = props.clipY + hh
  var y1 = props.clipY + h + hh
  return {x0: x0, x1: x1, y0: y0, y1: y1}
}
