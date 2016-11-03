var test = require('tape')
var perlin = require('../src/math/perlin')
var PNG = require('pngjs').PNG
var fs = require('fs')

// Sample perlin noise with different amplitude settings at (0, 0)
test('perlin-amplitudes', function (t) {
  var ret, x, y, width, amplitudes
  width = 120
  ret = new Float32Array(width * width)
  x = 0
  y = 0
  amplitudes = [0, 0, 0, 0, 0, 0, 0]
  for (var i = 0; i < amplitudes.length; i++) {
    if (i > 0) amplitudes[i - 1] = 0
    amplitudes[i] = 1
    perlin.generate2D(ret, x, y, width, amplitudes)
    writePNG(ret, 1.0, width, width, '/tmp/perlin-' + i + '.png')
  }
  amplitudes = [1, 2, 4, 8, 16, 32, 64]
  perlin.generate2D(ret, x, y, width, amplitudes)
  writePNG(ret, 127.0, width, width, '/tmp/perlin-all.png')
  t.end()
})

// Sample perlin noise across the plane, check for continuity
test('perlin-plane', function (t) {
  var width = 1000
  var height = 1000
  var stride = 40
  var noise = new Float32Array(stride * stride)
  var png = new PNG({width, height})
  var amplitudes = [0, 0, 0, 0, 0, 0, 1]
  for (var x = 0; x < width; x += stride) {
    for (var y = 0; y < height; y += stride) {
      perlin.generate2D(noise, x, y, stride, amplitudes)
      copyToPNG(png, x, y, noise, 1.0, stride, stride)
    }
  }
  var buffer = PNG.sync.write(png)
  fs.writeFileSync('/tmp/perlin-plane.png', buffer)
  t.end()
})

function writePNG (data, max, width, height, filepath) {
  var png = new PNG({width, height})
  copyToPNG(png, 0, 0, data, max, width, height)
  var buffer = PNG.sync.write(png)
  fs.writeFileSync(filepath, buffer)
}

function copyToPNG (png, offsetX, offsetY, data, max, width, height) {
  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var ix = (x + offsetX) + (y + offsetY) * png.height
      var grey = Math.min(255, Math.max(0, Math.floor(256 * data[x * width + y] / max)))
      png.data[ix * 4 + 0] = grey
      png.data[ix * 4 + 1] = grey
      png.data[ix * 4 + 2] = grey
      png.data[ix * 4 + 3] = 255
    }
  }
}
