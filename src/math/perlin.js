var murmurhash = require('murmurhash')
var interp = require('./interp')

// Generates deterministic 2D Perlin noise
// TODO: publish this as its own NPM module
module.exports = {
  generate: generatePerlinNoise
}

// Zero run-time allocations, avoid GC pressure
var MAX_WIDTH = 128
var perlin = new Float32Array(MAX_WIDTH * MAX_WIDTH)
var RAND_SEED = 2892

// Generates a n-by-n grid of deterministic perlin noise in [0, sum(amplitudes))
// Cosine interpolated. Samples from a continuous, infinite plane.
//
// ret - the Float32Array to write to, indexed [ix * width + iy]
// (x, y) - location on the plane, corresponds to (ix, iy) = 0, 0
// width - (width x width) are the dimensions of `ret`
// amplitudes - perlin amplitudes
function generatePerlinNoise (ret, x, y, width, amplitudes) {
  if (width > MAX_WIDTH) {
    throw new Error('generatePerlinNoise width ' + width + ' > max width ' + MAX_WIDTH)
  }
  if (width * width !== ret.length) {
    throw new Error('generatePerlinNoise wrong ret len. width: ' + width + ', len: ' + ret.length)
  }

  for (var i = 0; i < amplitudes.length; i++) {
    if (amplitudes[i] === 0.0) continue
    var istride = 1 << i
    var ix0 = Math.floor(x / istride) * istride
    var iy0 = Math.floor(y / istride) * istride
    var w = Math.max(width >> i, 1) + 1
    if (w > MAX_WIDTH) throw new Error('perlin max width exceeded: ' + w)
    console.log(JSON.stringify({x, y, ix0, iy0, istride, w}))

    for (var iu = 0; iu < w; iu++) {
      for (var iv = 0; iv < w; iv++) {
        var u = ix0 + iu * istride
        var v = iy0 + iv * istride
        var rand = hashRand([RAND_SEED, i, u, v])
        perlin[iu * w + iv] = rand
      }
    }

    for (iu = 0; iu < width; iu++) {
      for (iv = 0; iv < width; iv++) {
        u = x + iu
        v = y + iv
        var u0 = Math.floor((u - ix0) / istride)
        var v0 = Math.floor((v - iy0) / istride)
        var u1 = u0 + 1
        var v1 = v0 + 1
        var rand00 = perlin[u0 * w + v0]
        var rand01 = perlin[u0 * w + v1]
        var rand10 = perlin[u1 * w + v0]
        var rand11 = perlin[u1 * w + v1]

        // Interpolate and sum
        var tweenX = u / istride - Math.floor(u / istride)
        var tweenZ = v / istride - Math.floor(v / istride)
        rand = interp.cosine2D(rand00, rand01, rand10, rand11, tweenX, tweenZ)
        ret[iu * width + iv] += rand * amplitudes[i]
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
