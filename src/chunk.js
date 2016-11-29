// A chunk is a cubic region of space that fits CHUNK_SIZE^3 voxels
// Coordinates (x, y, z) are aligned to CHUNK_SIZE
module.exports = Chunk

function Chunk (x, y, z, data) {
  this.x = x
  this.y = y
  this.z = z
  this.data = data || null
  this.length = data ? data.length : 0
  this.mesh = null
  this.dirty = !!data
}

// Takes integer coordinates relative to this chunk--in other words, in the range [0, CHUNK_SIZE)
// Returns an integer representing voxel data
Chunk.prototype.getVox = function (ix, iy, iz) {
  var data = this.data
  if (!data) return 0
  for (var i = 0; i < data.length; i += 8) {
    var x0 = data[i]
    var y0 = data[i + 1]
    var z0 = data[i + 2]
    if (ix < x0 || iy < y0 || iz < z0) continue
    var x1 = data[i + 3]
    var y1 = data[i + 4]
    var z1 = data[i + 5]
    if (ix >= x1 || iy >= y1 || iz >= z1) continue
    return data[i + 6]
  }
  return 0
}

// Takes integer coordinates relative to this chunk and a voxel int
// If this changes the value of that voxel, makes the chunk dirty
Chunk.prototype.setVox = function (ix, iy, iz, v) {
  var data = this.data
  if (!data && v === 0) return // Nothing to do (setting air at a voxel that was already air)

  // Find the quad that this point belongs to
  var q = findQuad(this, ix, iy, iz)
  if (!q && v === 0) return // Nothing to do (setting air at a voxel that was already air)
  if (q && v === q.v) return // Nothing to do (voxel is already v)

  // We will do some combination of adding and coalescing quads
  this.dirty = true

  // First, create a 1x1x1 quad for the voxel we're setting
  var add = []
  if (v !== 0) add.push({x0: ix, y0: iy, z0: iz, x1: ix + 1, y1: iy + 1, z1: iz + 1, v: v})

  // If we found an existing quad that covers (ix, iy, iz), split it as needed
  if (q) {
    if (ix > q.x0) add.push({x0: q.x0, y0: q.y0, z0: q.z0, x1: ix, y1: q.y1, z1: q.z1, v: q.v})
    if (ix + 1 < q.x1) add.push({x0: ix + 1, y0: q.y0, z0: q.z0, x1: q.x1, y1: q.y1, z1: q.z1, v: q.v})
    if (iy > q.y0) add.push({x0: ix, y0: q.y0, z0: q.z0, x1: ix + 1, y1: iy, z1: q.z1, v: q.v})
    if (iy + 1 < q.y1) add.push({x0: ix, y0: iy + 1, z0: q.z0, x1: ix + 1, y1: q.y1, z1: q.z1, v: q.v})
    if (iz > q.z0) add.push({x0: ix, y0: iy, z0: q.z0, x1: ix + 1, y1: iy + 1, z1: iz, v: q.v})
    if (iz + 1 < q.z1) add.push({x0: ix, y0: iy, z0: iz + 1, x1: ix + 1, y1: iy + 1, z1: q.z1, v: q.v})

    // Modify that existing quad to be air, so we'll delete it soon.
    data[q.i + 6] = 0
  }

  // Coalesce quads where possible
  while (true) {
    var coalescedAny = false
    for (var i = 0; i < this.length; i += 8) {
      var x0 = data[i]
      var y0 = data[i + 1]
      var z0 = data[i + 2]
      var x1 = data[i + 3]
      var y1 = data[i + 4]
      var z1 = data[i + 5]
      var vq = data[i + 6]
      for (var j = 0; j < add.length; j++) {
        var a = add[j]
        if (a.v !== vq) continue // Different vox, can't coalesce

        // Try to coalesce this new quad `a` north, south, east, west, upward, and downward
        var coalesced = true
        if (a.x0 === x1 && a.y0 === y0 && a.y1 === y1 && a.z0 === z0 && a.z1 === z1) a.x0 = x0
        else if (a.x1 === x0 && a.y0 === y0 && a.y1 === y1 && a.z0 === z0 && a.z1 === z1) a.x1 = x1
        else if (a.y0 === y1 && a.x0 === x0 && a.x1 === x1 && a.z0 === z0 && a.z1 === z1) a.y0 = y0
        else if (a.y1 === y0 && a.x0 === x0 && a.x1 === x1 && a.z0 === z0 && a.z1 === z1) a.y1 = y1
        else if (a.z0 === z1 && a.x0 === x0 && a.x1 === x1 && a.y0 === y0 && a.y1 === y1) a.z0 = z0
        else if (a.z1 === z0 && a.x0 === x0 && a.x1 === x1 && a.y0 === y0 && a.y1 === y1) a.z1 = z1
        else coalesced = false

        if (coalesced) {
          coalescedAny = true
          data[i + 6] = 0
          break
        }
      }
    }
    if (!coalescedAny) break
  }

  // Delete all air quads
  var offset = 0
  for (i = 0; i < this.length; i += 8) {
    if (data[i + 6] === 0) {
      offset += 8
      continue
    }
    if (offset === 0) continue
    for (j = 0; j < 8; j++) {
      data[i - offset + j] = data[i + j]
    }
  }

  // Resize the data array, reallocating if necessary
  this.length += add.length * 8 - offset
  if (!data || this.length > data.length) {
    var newData = new Uint8Array(nextPow2(this.length + 32))
    if (data) newData.set(data)
    this.data = data = newData
  }

  // Finally, copy in any newly added quads
  for (i = 0; i < add.length; i++) {
    var quad = add[i]
    var index = this.length - add.length * 8 + i * 8
    data[index + 0] = quad.x0
    data[index + 1] = quad.y0
    data[index + 2] = quad.z0
    data[index + 3] = quad.x1
    data[index + 4] = quad.y1
    data[index + 5] = quad.z1
    data[index + 6] = quad.v
  }
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

function findQuad (chunk, ix, iy, iz) {
  var data = chunk.data
  if (!data) return null
  for (var i = 0; i < chunk.length; i += 8) {
    var x0 = data[i]
    var y0 = data[i + 1]
    var z0 = data[i + 2]
    if (ix < x0 || iy < y0 || iz < z0) continue
    var x1 = data[i + 3]
    var y1 = data[i + 4]
    var z1 = data[i + 5]
    if (ix >= x1 || iy >= y1 || iz >= z1) continue
    var v = data[i + 6]
    return {
      x0: x0,
      y0: y0,
      z0: z0,
      x1: x1,
      y1: y1,
      z1: z1,
      v: v,
      i: i
    }
  }
  return null
}
