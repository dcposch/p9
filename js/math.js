// A few basic operations on plain array vectors
// actually, this module should just be nuked and replaced with glmatrix
module.exports = {
  scale: scale,
  sum: sum,
  cross: cross,
  clamp: clamp,
  normalize: normalize,
  norm: norm
}

// Scalar multiplication
function scale (a, vec) {
  return vec.map(function (x) { return a * x })
}

// Vector addition
function sum (vec0) {
  var ret = vec0.slice()
  for (var i = 0; i < arguments.length; i++) {
    var veci = arguments[i]
    if (veci.length !== ret.length) {
      throw new Error('Tried to sum vectors of unequal length')
    }
    for (var j = 0; j < ret.length; j++) {
      ret[j] += veci[j]
    }
  }
  return ret
}

// Cross product
function cross (a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]]
}

// Normalize to unit length
function normalize (v) {
  return scale(1 / norm(v), v)
}

// Returns the L2 norm (length) of the vector
function norm (v) {
  return Math.sqrt(v
    .map(function (x) {return x * x})
    .reduce(function (a, b) {return a + b}))
}

// Clamps value to a range [min, max]
function clamp (x, min, max) {
  if (x < min) return min
  if (x > max) return max
  return x
}
