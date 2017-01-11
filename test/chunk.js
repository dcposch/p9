var test = require('tape')
var Chunk = require('../src/chunk')
var vox = require('../src/vox')

test('create a chunk, unpacked', function (t) {
  var c = new Chunk()
  testCreate(c, t)
})

test('create a chunk, packed', function (t) {
  var c = new Chunk()
  c.pack()
  testCreate(c, t)
})

function testCreate (c, t) {
  t.equal(c.data, null, 'empty chunk')
  t.equal(c.getVox(1, 2, 3), 0)
  t.equal(c.getVox(1, 2, 3), vox.INDEX.AIR)

  c.setVox(1, 2, 3, 250)
  t.notEqual(c.data, null, 'chunk with at least one non-air')
  t.deepEqual(c.mesh, {opaque: null, trans: null})
  t.ok(c.dirty)
  t.equal(c.getVox(1, 2, 3), 250)
  t.end()
}

test('get vox, packed', function (t) {
  var data = new Uint8Array([0, 0, 0, 4, 4, 4, 1, 0, 6, 6, 6, 8, 8, 8, 2, 0])
  var c = new Chunk(0, 0, 0, data, true)
  t.equal(c.length, 16)
  t.equal(c.getVox(6, 6, 6), 2)
  c.length = 8
  t.equal(c.getVox(6, 6, 6), 0)
  t.end()
})

test('dirty, unpacked', function (t) {
  var c = new Chunk()
  testDirty(c, t)
})

test('dirty, packed', function (t) {
  var c = new Chunk()
  c.pack()
  testDirty(c, t)
})

function testDirty (c, t) {
  t.equal(c.dirty, false)
  c.setVox(0, 0, 0, 0)
  t.equal(c.dirty, false)
  c.setVox(0, 0, 0, 1)
  t.equal(c.dirty, true, 'air to vox')

  c.dirty = false
  c.setVox(0, 0, 0, 1)
  t.equal(c.dirty, false)
  c.setVox(0, 0, 0, 2)
  t.equal(c.dirty, true, 'vox to different vox')

  c.dirty = false
  c.setVox(0, 0, 0, 2)
  t.equal(c.dirty, false)
  c.setVox(0, 0, 0, 0)
  t.equal(c.dirty, true, 'vox to air')
  t.end()
}

test('create, then pack', function (t) {
  var c = new Chunk()
  c.setVox(10, 10, 10, 1)
  c.setVox(10, 11, 10, 1)
  c.setVox(11, 10, 10, 1)
  c.setVox(11, 11, 10, 1)
  c.setVox(11, 12, 10, 1)
  c.pack()

  t.equal(c.length / 8, 2)
  t.equal(print(c), 'vox 1 2x2x1 at 10,10,10; vox 1 1x1x1 at 11,12,10')
  t.end()
})

test('create a chunk, coalesce', function (t) {
  var c = new Chunk()
  c.pack()

  // Create 1x1x1
  c.setVox(10, 10, 10, 1)
  t.equal(c.length / 8, 1, '1x1x1')

  // Create 1x1x2
  c.setVox(10, 10, 11, 1)
  t.equal(c.length / 8, 1, '1x1x2')

  // Another block next to that
  c.setVox(10, 11, 11, 1)
  t.equal(c.length / 8, 2, '1x1x2 + 1')

  // Coalesce into a 1x2x2
  c.setVox(10, 11, 10, 1)
  t.equal(c.length / 8, 1, '1x2x2')

  // Coalesce into a 2x2x2
  c.setVox(11, 11, 10, 1)
  c.setVox(11, 10, 10, 1)
  c.setVox(11, 11, 11, 1)
  t.equal(c.length / 8, 3, '1x2x2 + 3')
  c.setVox(11, 10, 11, 1)
  t.equal(c.length / 8, 1, '2x2x2')

  // Coalesce into a 3x3x3
  c.setVox(10, 10, 12, 1)
  c.setVox(10, 11, 12, 1)
  c.setVox(10, 12, 10, 1)
  c.setVox(10, 12, 11, 1)
  c.setVox(10, 12, 12, 1)
  t.equal(c.length / 8, 3, '2x2x2 + some')
  t.equal(print(c), 'vox 1 2x2x2 at 10,10,10; vox 1 1x1x2 at 10,12,10; vox 1 1x3x1 at 10,10,12')

  c.setVox(11, 10, 12, 1)
  c.setVox(11, 11, 12, 1)
  c.setVox(11, 12, 10, 1)
  c.setVox(11, 12, 11, 1)
  c.setVox(11, 12, 12, 1)
  t.equal(c.length / 8, 1, '2x3x3')

  c.setVox(12, 10, 10, 1)
  c.setVox(12, 10, 11, 1)
  c.setVox(12, 10, 12, 1)
  c.setVox(12, 11, 10, 1)
  c.setVox(12, 11, 11, 1)
  c.setVox(12, 11, 12, 1)
  c.setVox(12, 12, 10, 1)
  c.setVox(12, 12, 11, 1)
  t.equal(c.length / 8, 3, 'almost 3x3x3')
  c.setVox(12, 12, 12, 1)
  t.equal(c.length / 8, 1, '3x3x3')

  // Finally, remove the middle vox in the 3x3x3, splitting it into 6 quads
  c.setVox(11, 11, 11, 0)
  t.equal(c.length / 8, 6, 'split')
  t.equal(print(c), [
    'vox 1 1x3x3 at 10,10,10',
    'vox 1 1x3x3 at 12,10,10',
    'vox 1 1x1x3 at 11,10,10',
    'vox 1 1x1x3 at 11,12,10',
    'vox 1 1x1x1 at 11,11,10',
    'vox 1 1x1x1 at 11,11,12'
  ].join('; '))

  t.end()
})

function print (c) {
  var data = c.data
  if (!data) return 'empty'
  var parts = []
  for (var i = 0; i < c.length; i += 8) {
    var x0 = data[i]
    var y0 = data[i + 1]
    var z0 = data[i + 2]
    var wx = data[i + 3] - x0
    var wy = data[i + 4] - y0
    var wz = data[i + 5] - z0
    var v = data[i + 6]
    parts.push('vox ' + v + ' ' + [wx, wy, wz].join('x') + ' at ' + [x0, y0, z0].join(','))
  }
  return parts.join('; ')
}
