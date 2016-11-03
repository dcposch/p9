var murmurhash = require('murmurhash')
var interp = require('./interp')

// Generates deterministic 2D Perlin noise
// TODO: publish this as its own NPM module
module.exports = {
  generate2D: generate2D
}

// Avoid run-time allocations, reduce GC pressure
var MAX_WIDTH = 128
var perlin = new Float32Array(MAX_WIDTH * MAX_WIDTH)
var RAND_SEED = 2892

// Generates a n-by-n grid of deterministic perlin noise in [0, sum(amplitudes))
// Cosine interpolated. Samples from a continuous, infinite plane.
//
// ret - the Float32Array to write to, indexed [ix * width + iy]
// (x, y) - location on the plane, world coordinates, corresponds to (ix, iy) = 0, 0
// width - (width x width) are the dimensions of `ret`
// amplitudes - perlin amplitudes
function generate2D (ret, x, y, width, amplitudes) {
  if (width > MAX_WIDTH) {
    throw new Error('generate2D width ' + width + ' > max width ' + MAX_WIDTH)
  }
  if (width * width !== ret.length) {
    throw new Error('generate2D wrong ret len. width: ' + width + ', len: ' + ret.length)
  }

  // First, clear the output
  for (var ou = 0; ou < width; ou++) {
    for (var ov = 0; ov < width; ov++) {
      ret[ou * width + ov] = 0
    }
  }

  for (var i = 0; i < amplitudes.length; i++) {
    var amp = amplitudes[i]
    if (amp === 0.0) continue

    // Stride is the `wavelength` of the noise we're generating on this interpolation
    // Perlin noise works by adding up noise of different frequencies
    var stride = 1 << i
    // (xs, ys) is (x, y) rounded down to the nearest stride. Both are in world coordinates
    var xs = Math.floor(x / stride) * stride
    var ys = Math.floor(y / stride) * stride

    // We'll take a w x w grid of noise samples at (xs, ys), (xs + stride, ys), ...
    var w = Math.max(
      Math.ceil((x + width) / stride) - Math.floor(x / stride),
      Math.ceil((y + width) / stride) - Math.floor(y / stride)) + 1
    if (w > MAX_WIDTH) throw new Error('perlin max width exceeded: ' + w)

    // (su, sv) is an index into the grid of noise samples
    for (var su = 0; su < w; su++) {
      for (var sv = 0; sv < w; sv++) {
        // (sx, sy) is the location of a sample, in world coordinates
        var sx = xs + su * stride
        var sy = ys + sv * stride
        var rand = hashRand([RAND_SEED, i, sx, sy])
        var sample
        if (typeof amp === 'function') sample = amp(rand, sx, sy, i)
        else sample = rand * amp
        perlin[su * w + sv] = sample
      }
    }

    // (ou, ov) is an index into the output 2D array
    for (ou = 0; ou < width; ou++) {
      for (ov = 0; ov < width; ov++) {
        // (px, py) are the world coordinates of this output
        var px = x + ou
        var py = y + ov

        // (u0, v0) and (u1, v1) are indices into the grid of noise samples
        var u0 = Math.floor(px / stride) - xs / stride
        var v0 = Math.floor(py / stride) - ys / stride
        var u1 = u0 + 1
        var v1 = v0 + 1
        var rand00 = perlin[u0 * w + v0]
        var rand01 = perlin[u0 * w + v1]
        var rand10 = perlin[u1 * w + v0]
        var rand11 = perlin[u1 * w + v1]

        // Interpolate between the four surrounding noise samples
        var tweenU = px / stride - Math.floor(px / stride)
        var tweenV = py / stride - Math.floor(py / stride)
        rand = interp.cosine2D(rand00, rand01, rand10, rand11, tweenU, tweenV)

        // Sum. Add the current noise on top the higher-frequency noise we already have
        ret[ou * width + ov] += rand
      }
    }
  }
}

// Returns a hash code random value in [0.0, 1.0)
function hashRand (values) {
  var hc = hashInts(values)
  return (hc & 0x7fffffff) / 0x7fffffff
}

// Returns a hash code in [0, 1<<30)
function hashInts (values) {
  var str = values.join('')
  return murmurhash.v2(str)
}
