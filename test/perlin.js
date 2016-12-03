var test = require('tape')
var perlin = require('../src/math/perlin')
var PNG = require('pngjs').PNG
var fs = require('fs-extra')
var path = require('path')

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
    compareOrWritePNG(t, ret, 1.0, width, width, 'img/perlin-' + i + '.png')
  }
  amplitudes = [1, 2, 4, 8, 16, 32, 64]
  perlin.generate2D(ret, x, y, width, amplitudes)
  compareOrWritePNG(t, ret, 127.0, width, width, 'img/perlin-all.png')
  t.end()
})

// Sample perlin noise across the plane, check for continuity
test('perlin-plane', function (t) {
  // amplitudes sum to 1.0
  var amplitudes = [1 / 128, 2 / 128, 4 / 128, 8 / 128, 16 / 128, 32 / 128, 64 / 128]
  testPerlinPlane(t, amplitudes, 'img/perlin-plane.png')
})

// Sample perlin noise where the amplitudes vary across the plane
test('perlin-function', function (t) {
  // mountainFn produces an amplitude in [0, 0.75) over our domain (0, 0) to (1000, 1000)
  var mountainFn = function (rand, x, y, scale) {
    return rand * Math.sin((x + y) * Math.PI / 2000.0) * 0.75
  }
  // amplitudes sum to 1.0
  var amplitudes = [1 / 128, 2 / 128, 4 / 128, 8 / 128, 16 / 128, 0, mountainFn]
  testPerlinPlane(t, amplitudes, 'img/perlin-function.png')
})

// Sample perlin noise over the plane from (x, y) = (0, 0) to (1000, 1000)
// Compare resulting image to reference PNG, or create reference PNG if new
function testPerlinPlane (t, amplitudes, filepath) {
  var width = 1000
  var height = 1000
  var stride = 40
  var noise = new Float32Array(stride * stride)
  var png = new PNG({width, height})
  for (var x = 0; x < width; x += stride) {
    for (var y = 0; y < height; y += stride) {
      perlin.generate2D(noise, x, y, stride, amplitudes)
      copyToPNG(png, x, y, noise, 1.0, stride, stride)
    }
  }
  var buffer = PNG.sync.write(png)
  compareOrWriteBuffer(t, buffer, filepath)
  t.end()
}

function compareOrWritePNG (t, data, max, width, height, filepath) {
  var png = new PNG({width, height})
  copyToPNG(png, 0, 0, data, max, width, height)
  var buffer = PNG.sync.write(png)
  compareOrWriteBuffer(t, buffer, filepath)
}

function compareOrWriteBuffer (t, buf, filepath) {
  var fullPath = path.join(__dirname, filepath)
  try {
    var expectedBuf = fs.readFileSync(fullPath)
    t.deepEqual(buf, expectedBuf, 'png buffers should match: ' + filepath)
  } catch (e) {
    if (e.code !== 'ENOENT') return t.fail(e)
    fs.mkdirpSync(path.dirname(fullPath))
    fs.writeFileSync(fullPath, buf)
    console.error('Created ' + filepath)
  }
}

function copyToPNG (png, offsetX, offsetY, data, max, width, height) {
  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var ix = (x + offsetX) + (y + offsetY) * png.height
      var grey = Math.min(255, Math.max(0, Math.floor(256 * data[x * width + y] / max)))
      png.data[ix * 4 + 0] = grey // red
      png.data[ix * 4 + 1] = grey // green
      png.data[ix * 4 + 2] = grey // blue
      png.data[ix * 4 + 3] = 255 // alpha
    }
  }
}
