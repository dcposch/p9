var regl = require('./regl') // Create a regl context from the <canvas> element
var drawTriangle = require('./draw-triangle') // Precompile regl commands

console.log('WELCOME ~ VOXEL WORLD')

// Start the requestAnimationFrame render loop
regl.frame(function (context) {
  regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  drawTriangle()
})
