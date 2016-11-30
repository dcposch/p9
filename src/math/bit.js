module.exports = {
  nextPow2: nextPow2
}

function nextPow2 (v) {
  v = (v | 0) - 1
  v |= v >> 1
  v |= v >> 2
  v |= v >> 4
  v |= v >> 8
  v |= v >> 16
  return v + 1
}
