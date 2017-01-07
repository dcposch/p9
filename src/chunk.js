var config = require('./config')
var nextPow2 = require('./math/bit').nextPow2

// A chunk is a cubic region of space that fits CHUNK_SIZE^3 voxels
// Coordinates (x, y, z) are aligned to CHUNK_SIZE
module.exports = Chunk

var CS = config.CHUNK_SIZE
var CB = config.CHUNK_BITS

var packed = new Chunk()

function Chunk (x, y, z, data, packed) {
  this.x = x | 0
  this.y = y | 0
  this.z = z | 0
  this.packed = !!packed
  this.data = data || null
  this.length = packed ? data.length : 0
  this.mesh = { opaque: null, trans: null }
  this.dirty = !!data
}

Chunk.prototype.getKey = function () {
  return this.x + ',' + this.y + ',' + this.z
}

// Takes integer coordinates relative to this chunk--in other words, in the range [0, CHUNK_SIZE)
// Returns an integer representing voxel data
Chunk.prototype.getVox = function (ix, iy, iz) {
  if (!this.data) return 0
  if (this.packed) return getVoxPacked(this, ix, iy, iz)
  else return getVoxUnpacked(this, ix, iy, iz)
}

// Takes integer coordinates relative to this chunk and a voxel int
// If this changes the value of that voxel, makes the chunk dirty
Chunk.prototype.setVox = function (ix, iy, iz, v) {
  var data = this.data
  if (!data && v === 0) return // Nothing to do (setting air at a voxel that was already air)
  if (this.packed) setVoxPacked(this, ix, iy, iz, v)
  else setVoxUnpacked(this, ix, iy, iz, v)
  return this
}

// Changes the representation from a flat array to list-of-quads
// Flat array: one byte per voxel, so CHUNK_SIZE^3 = 32 KB space, O(1) getVox and setVox
// List of quads: 8 bytes per quad, typically ~2 KB, O(nQuads) getVox and setVox
// Average over 10x reduction in memory use, quads ready to mesh, but getVox/setVox ~10x slower
Chunk.prototype.pack = function () {
  if (this.packed) throw new Error('already packed')
  if (this.data) {
    var quads = packGreedyQuads(this)
    this.data = new Uint8Array(nextPow2(quads.length))
    this.data.set(quads)
    this.length = quads.length
  }
  this.packed = true
  return this
}

// Changes representation from list-of-quads to flat array
Chunk.prototype.unpack = function () {
  if (!this.packed) throw new Error('already unpacked')
  if (this.data) throw new Error('unpack nonempty chunk unimplemented')
  this.packed = false
  return this
}

Chunk.prototype.destroy = function () {
  this.destroyMesh()
  this.packed = false
  this.data = null
  this.length = 0
  this.dirty = false
}

Chunk.prototype.destroyMesh = function () {
  destroyMesh(this.mesh.opaque)
  destroyMesh(this.mesh.trans)
  this.mesh.opaque = null
  this.mesh.trans = null
}

function destroyMesh (mesh) {
  if (!mesh) return
  if (mesh.count === 0) return
  mesh.verts.destroy()
  mesh.normals.destroy()
  mesh.uvs.destroy()
}

function getVoxPacked (chunk, ix, iy, iz) {
  var data = chunk.data
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

function setVoxPacked (chunk, ix, iy, iz, v) {
  var data = chunk.data

  // Find the quad that this point belongs to
  var q = findQuad(chunk, ix, iy, iz)
  if (!q && v === 0) return // Nothing to do (setting air at a voxel that was already air)
  if (q && v === q.v) return // Nothing to do (voxel is already v)

  // We will do some combination of adding and coalescing quads
  chunk.dirty = true

  // First, create a 1x1x1 quad for the voxel we're setting
  var add = []
  if (v !== 0) add.push({x0: ix, y0: iy, z0: iz, x1: ix + 1, y1: iy + 1, z1: iz + 1, v: v})

  // If we found an existing quad that covers (ix, iy, iz), split it as needed
  if (q) {
    var ix1 = ix + 1
    var iy1 = iy + 1
    var iz1 = iz + 1
    if (ix > q.x0) add.push({x0: q.x0, y0: q.y0, z0: q.z0, x1: ix, y1: q.y1, z1: q.z1, v: q.v})
    if (ix1 < q.x1) add.push({x0: ix1, y0: q.y0, z0: q.z0, x1: q.x1, y1: q.y1, z1: q.z1, v: q.v})
    if (iy > q.y0) add.push({x0: ix, y0: q.y0, z0: q.z0, x1: ix1, y1: iy, z1: q.z1, v: q.v})
    if (iy1 < q.y1) add.push({x0: ix, y0: iy1, z0: q.z0, x1: ix1, y1: q.y1, z1: q.z1, v: q.v})
    if (iz > q.z0) add.push({x0: ix, y0: iy, z0: q.z0, x1: ix1, y1: iy1, z1: iz, v: q.v})
    if (iz1 < q.z1) add.push({x0: ix, y0: iy, z0: iz1, x1: ix1, y1: iy1, z1: q.z1, v: q.v})

    // Modify that existing quad to be air, so we'll delete it soon.
    data[q.i + 6] = 0
  }

  // Coalesce quads where possible
  while (true) {
    var coalescedAny = false
    for (var i = 0; i < chunk.length; i += 8) {
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
  for (i = 0; i < chunk.length; i += 8) {
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
  chunk.length += add.length * 8 - offset
  if (!data || chunk.length > data.length) {
    var newData = new Uint8Array(nextPow2(chunk.length + 32))
    if (data) newData.set(data)
    chunk.data = data = newData
  }

  // Finally, copy in any newly added quads
  for (i = 0; i < add.length; i++) {
    var quad = add[i]
    var index = chunk.length - add.length * 8 + i * 8
    data[index + 0] = quad.x0
    data[index + 1] = quad.y0
    data[index + 2] = quad.z0
    data[index + 3] = quad.x1
    data[index + 4] = quad.y1
    data[index + 5] = quad.z1
    data[index + 6] = quad.v
  }
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

// Implements the greedy quad algorithm
// http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
function packGreedyQuads (chunk) {
  if (packed.data) packed.data.fill(0)

  // Write quads into a flat array, minimize allocations
  var quads = []
  var ix, iy, iz
  for (ix = 0; ix < CS; ix++) {
    for (iy = 0; iy < CS; iy++) {
      for (iz = 0; iz < CS; iz++) {
        var isMeshed = packed.getVox(ix, iy, iz)
        if (isMeshed > 0) continue
        var v = chunk.getVox(ix, iy, iz)
        if (v === 0) continue

        // Expand to largest possible quad
        var jx = ix + 1
        var jy = iy + 1
        var jz = iz + 1
        var kx, ky, kz
        var match = true
        for (; match && jx < CS; match && jx++) {
          match = chunk.getVox(jx, iy, iz) === v && !packed.getVox(jx, iy, iz)
        }
        match = true
        for (; match && jy < CS; match && jy++) {
          for (kx = ix; match && kx < jx; kx++) {
            match = chunk.getVox(kx, jy, iz) === v && !packed.getVox(kx, jy, iz)
          }
        }
        match = true
        for (; match && jz < CS; match && jz++) {
          for (kx = ix; match && kx < jx; kx++) {
            for (ky = iy; match && ky < jy; match && ky++) {
              match = chunk.getVox(kx, ky, jz) === v && !packed.getVox(kx, ky, jz)
            }
          }
        }

        // Mark quad as done
        if (ix >= jx) throw new Error('invalid quad x')
        if (iy >= jy) throw new Error('invalid quad y')
        if (iz >= jz) throw new Error('invalid quad z')
        for (kx = ix; kx < jx; kx++) {
          for (ky = iy; ky < jy; ky++) {
            for (kz = iz; kz < jz; kz++) {
              if (chunk.getVox(kx, ky, kz) !== v) throw new Error('invalid quad')
              packed.setVox(kx, ky, kz, 1)
            }
          }
        }

        // 8 bytes per quad. see PROTOCOL.md
        quads.push(ix)
        quads.push(iy)
        quads.push(iz)
        quads.push(jx)
        quads.push(jy)
        quads.push(jz)
        quads.push(v)
        quads.push(0)
      }
    }
  }

  return quads
}

function getVoxUnpacked (chunk, ix, iy, iz) {
  return chunk.data[(ix << CB << CB) + (iy << CB) + iz]
}

function setVoxUnpacked (chunk, ix, iy, iz, v) {
  if (!chunk.data) chunk.data = new Uint8Array(CS * CS * CS)
  var index = (ix << CB << CB) + (iy << CB) + iz
  if (chunk.data[index] === v) return
  chunk.data[index] = v
  chunk.dirty = true
}
