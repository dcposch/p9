var env = require('../env')
var shaders = require('../shaders')
var textures = require('../textures')
var vox = require('../../vox')

var HUD_WIDTH = (8 * 16 + 2) * 4
var HUD_HEIGHT = 16 * 4
var HUD_BOTTOM_CLIP_Y = -0.9

// Draws a Heads-Up Display.
// Shows what kind of block the player is placing.
module.exports = {
  draw: draw,
  QUICKBAR_VOX: [
    vox.INDEX.STONE,
    vox.INDEX.STRIPE_WOOD,
    vox.INDEX.LIGHT_PURPLE,
    vox.INDEX.DARK_PURPLE,
    vox.INDEX.DARK_GREEN,
    vox.INDEX.PINK,
    vox.INDEX.RED,
    vox.INDEX.LIGHT_BLUE
  ]
}

function draw (props) {
  drawQuickbar(props)
}

var drawQuickbar = env.regl({
  vert: shaders.vert.uvClip,
  frag: shaders.frag.texture,
  attributes: {
    aPosition: function (context, props) {
      var b = calculateBounds(context, props)
      var verts = makeQuad(b.x0, b.y0, b.x1, b.y1)
      var xt0 = (props.selectedIndex * 16) / (8 * 16 + 1)
      var xt1 = (props.selectedIndex * 16 + 17) / (8 * 16 + 1)
      var x0 = b.x1 * xt0 + b.x0 * (1 - xt0)
      var x1 = b.x1 * xt1 + b.x0 * (1 - xt1)
      var y0 = b.y0
      var y1 = b.y1
      verts = verts.concat(makeQuad(x0, y0, x1, y1))
      return verts
    },
    aUV: function (context, props) {
      var b = -1 / 512
      var v0 = b
      var v1 = 0.5 + b
      var u0 = 0
      var u1 = (8 * 16 + 1) / 256
      var u0s = 192 / 256
      var u1s = 209 / 256
      return [].concat(makeQuad(u0, v0, u1, v1), makeQuad(u0s, v0, u1s, v1))
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
  count: 12,
  primitive: 'triangles'
})

function calculateBounds (context, props) {
  var w = HUD_WIDTH / context.viewportWidth
  var h = HUD_HEIGHT / context.viewportHeight
  // Bump it a half pixel to prevent blur
  var hw = 1 / context.viewportWidth
  var hh = 1 / context.viewportHeight
  var x0 = -w / 2 + hw
  var x1 = w / 2 + hw
  var y0 = HUD_BOTTOM_CLIP_Y + h + hh
  var y1 = HUD_BOTTOM_CLIP_Y + hh
  return {x0: x0, x1: x1, y0: y0, y1: y1}
}

function makeQuad (x0, y0, x1, y1) {
  return [[x0, y0], [x0, y1], [x1, y1], [x0, y0], [x1, y1], [x1, y0]]
}
