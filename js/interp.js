// Interpolation
module.exports = {
  tween: tween,
  cosine2D: cosine2D
}

// Array linear interpolation
// If u===0, returns arr0, if u===1, returns arr1
function tween (arr0, arr1, u) {
  var n = arr0.length
  if (arr1.length !== n) throw new Error('tween() expects two equal length arrays')
  var ret = new Array(n)
  for (var i = 0; i < n; i++) {
    ret[i] = u * arr1[i] + (1 - u) * arr0[i]
  }
  return ret
}

// 2D Cosine interpolation
function cosine2D (v00, v01, v10, v11, u, v) {
  if (u < 0 || u >= 1 || v < 0 || v >= 1) throw new Error('Cosine interp out of bounds')
  var utween = 0.5 - 0.5 * Math.cos(u * Math.PI)
  var vtween = 0.5 - 0.5 * Math.cos(v * Math.PI)
  return (v00 * (1 - utween) * (1 - vtween) +
    v01 * (1 - utween) * (vtween) +
    v10 * (utween) * (1 - vtween) +
    v11 * (utween) * (vtween))
}
