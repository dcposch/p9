var env = require('./env')
var shaders = require('./shaders')

var CROSSHAIR_RADIUS = 10 // Pixels
var CROSSHAIR_WIDTH = 1

// Draws a crosshair in the middle of the screen.
module.exports = env.regl({
  vert: shaders.vert.colorClip,
  frag: shaders.frag.color,
  attributes: {
    aVertexPosition: function (context, props) {
      var w = CROSSHAIR_RADIUS / context.viewportWidth * 2
      var h = CROSSHAIR_RADIUS / context.viewportHeight * 2
      // Bump it a half pixel to prevent blur
      var hw = 1 / context.viewportWidth
      var hh = 1 / context.viewportHeight
      return [[w + hw, hh], [-w + hw, hh], [hw, h + hh], [hw, -h + hh]]
    },
    aVertexColor: function (context, props) {
      return [props.color, props.color, props.color, props.color]
    }
  },
  blend: {
    enable: true,
    func: {
      src: 'src alpha',
      dst: 'one minus src alpha'
    }
  },
  count: 4,
  primitive: 'lines',
  lineWidth: CROSSHAIR_WIDTH
})
