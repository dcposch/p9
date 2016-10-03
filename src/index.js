var regl = require('./regl') // Create a regl context from the <canvas> element
var drawTriangle = require('./draw-triangle') // Precompile regl commands
var sound = require('./sound')

console.log('WELCOME ~ VOXEL WORLD')

// Click to enter full screen
document.querySelector('#gl').addEventListener('click', start)
function start () {
  sound.play('win95.mp3')
}

// Start the requestAnimationFrame render loop
regl.frame(function (context) {
  regl.clear({ color: [0, 0, 0, 1], depth: 1 })
  drawTriangle()
})
