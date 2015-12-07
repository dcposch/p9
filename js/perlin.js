var murmurhash = require('murmurhash')
var interp = require('./interp')

var RAND_SEED = 2892

// Generates deterministic 2D Perlin noise
module.exports = {
    generate: generatePerlinNoise
}

// Generates a nxn grid of deterministic perlin noise in [0,sum(amps))
//
// (x, z) - location of block in world coords
// lod - (1<<lod) is the size of a single cell in the output grid
// width - (width x width) are the dimensions of the output grid in cells
// amplitudes - perlin amplitudes. 0 thru lod-1 are ignored.
function generatePerlinNoise (x, z, lod, width, amplitudes) {
  var stride = 1 << lod
  var ret = new Float32Array(width * width)
  for (var i = lod; i < amplitudes.length; i++) {
    if (amplitudes[i] === 0.0) {
      continue
    }
    var istride = 1 << i
    var ix0 = Math.floor(x / istride) * istride
    var iz0 = Math.floor(z / istride) * istride
    var w = Math.max(width >> (i - lod), 1) + 1
    var perlin = new Float32Array(w * w)
    for (var iu = 0; iu < w; iu++)
    for (var iv = 0; iv < w; iv++) {
      var u = ix0 + iu * istride
      var v = iz0 + iv * istride
      var rand = hashcodeRand([RAND_SEED, i, u, v])
      perlin[w * iu + iv] = rand
    }

    for (var iu = 0; iu < width; iu++)
    for (var iv = 0; iv < width; iv++) {
      var u = x + iu * stride
      var v = z + iv * stride
      var u0 = Math.floor((u - ix0) / istride)
      var v0 = Math.floor((v - iz0) / istride)
      var u1 = u0 + 1
      var v1 = v0 + 1
      var rand00 = perlin[u0 * w + v0]
      var rand01 = perlin[u0 * w + v1]
      var rand10 = perlin[u1 * w + v0]
      var rand11 = perlin[u1 * w + v1]

      // Interpolate and sum
      var tweenX = u / istride - Math.floor(u / istride)
      var tweenZ = v / istride - Math.floor(v / istride)
      var rand = interp.cosine2D(rand00, rand01, rand10, rand11, tweenX, tweenZ)
      ret[iu * width + iv] += rand * amplitudes[i]
    }
  }
  return ret
}

// Returns a hash code random value in [0.0, 1.0)
function hashcodeRand (values) {
  var hc = hashcodeInts(values)
  return (hc & 0x7fffffff) / 0x7fffffff
}

// Returns a hash code in [0, 1<<30)
function hashcodeInts (values) {
  var str = values.join('')
  return murmurhash.v2(str)
}
