/**
 * DC
 * March 2015
 * Trying out some voxel rendering
 */
var glMatrix = require('gl-matrix')
var mat4 = glMatrix.mat4
var DCInput = require('./dcinput')
var DCGL = require('./dcgl')
var perlin = require('./perlin')
var interp = require('./interp')

var math = require('./math')
var scale = math.scale
var sum = math.sum
var cross = math.cross
var clamp = math.clamp
var normalize = math.normalize

// Constants
// Each chunk is 16x16 voxels wide (X, Z) and 64 voxels high (Y)
var CHUNK_WIDTH = 16
var CHUNK_HEIGHT = 64

var LOD_MAX = 4 // biggest blocks are 2^4 = 16 units on a side
var LOD_CHUNK_RADIUS = 8 // 16x16 neighborhood around the viewer
var LOD_CHUNK_RADIUS2 = LOD_CHUNK_RADIUS * LOD_CHUNK_RADIUS
var LOD_SPIRAL = getCartesianSpiral(LOD_CHUNK_RADIUS2 * 8) // 4x + some extra

// Terrain gen
var BIOME_ISLANDS = {
  name: 'islands',
  perlinHeightmapAmplitudes: [0, 0.5, 0, 0, 10, 10, 5]
}
var BIOME_PLAINS = {
  name: 'plains',
  perlinHeightmapAmplitudes: [0, 0.5, 0, 0, 0, 0, 0, 0, 15, 15, 15, 15]
}
var BIOME_MOUNTAINS = {
  name: 'mountains',
  perlinHeightmapAmplitudes: [0, 0.5, 2, 2, 5, 0, 20, 40]
}
var BIOMES = [
  BIOME_ISLANDS,
  BIOME_PLAINS,
  BIOME_MOUNTAINS
]

// Skybox
var SKY_HORIZON_DISTANCE = 2000
var SUN_DISTANCE = 900
var SUN_DIAMETER = 200
var DAY = {
  SKY_COLOR_BOTTOM: [0.9, 0.9, 1.0, 1],
  SKY_COLOR_HORIZON: [0.9, 0.9, 1.0, 1],
  SKY_COLOR_TOP: [0.6, 0.7, 0.9, 1],
  DIFFUSE_COLOR: [1, 1, 0.9],
  AMBIENT_COLOR: [0.6, 0.6, 0.6]
}
var NIGHT = {
  SKY_COLOR_BOTTOM: [0.3, 0.4, 0.5, 1],
  SKY_COLOR_HORIZON: [0.3, 0.4, 0.5, 1],
  SKY_COLOR_TOP: [0.15, 0.2, 0.25, 1],
  DIFFUSE_COLOR: [0.6, 0.7, 0.7], // moon
  AMBIENT_COLOR: [0.2, 0.2, 0.2]
}
var SECONDS_PER_GAME_DAY = 1200 // one full day + night every 20 minutes
var CLOUD_COLOR = [1, 1, 1, 0.1]
var CLOUD_WIDTH = 18
var CLOUD_HEIGHT = 1
var CLOUD_GRID = 224
var CLOUD_SPEED = 1.8
var CLOUD_LEVEL = 125
var ENABLE_CLOUDS = false

// There are different kinds of blocks
var VOX_TYPE_AIR = 0
var VOX_TYPE_WATER = 1
var VOX_TYPE_GRASS = 2
var VOX_TYPE_STONE = 3

// How fast you can move and look around
var INPUT_SPEED = 25 // blocks per second
var INPUT_SENSITIVITY = 0.01 // radians per pixel

var MAX_CHUNK_LOADS_PER_FRAME = 20

// Keyboard and mouse input
var dcinput = null

// WebGL output
var dcgl = null
var gl = null

// Voxel world
var chunks = {}
var sky = {
  skybox: {gl: {}},
  sun: {gl: {}},
  clouds: {gl: {}}
}

// Textures for every kind of block, all on one image.
// See http://dcpos.ch/canvas/dcgl/textures/
var blockTexture
var blockTextureUVs = {}
blockTextureUVs[VOX_TYPE_WATER] = {side: [13, 12], top: [13, 12], bottom: [13, 12]}
blockTextureUVs[VOX_TYPE_GRASS] = {side: [3, 0], top: [1, 9], bottom: [2, 0]}
blockTextureUVs[VOX_TYPE_STONE] = {side: [1, 0], top: [1, 0], bottom: [1, 0]}

// Generates a biome using deterministic noise
// Takes the chunk x and z coord, and the chunk size
function generateChunkBiome (x, z, width) {
  var fnBiomeIx = function (x, z) {
    var u = (Math.cos(x * 0.015) + Math.cos(z * 0.023)) / 4.0000001 + 0.5
    return Math.floor(BIOMES.length * u)
  }
  var b00 = BIOMES[fnBiomeIx(x, z)]
  var b01 = BIOMES[fnBiomeIx(x, z + width)]
  var b10 = BIOMES[fnBiomeIx(x + width, z)]
  var b11 = BIOMES[fnBiomeIx(x + width, z + width)]
  return {
    name: b00.name,
    b00: b00,
    b01: b01,
    b10: b10,
    b11: b11
  }
}

// Generates a test chunk at the given coords and LOD
function createChunk (x, z, lod) {
  var voxsize = 1 << lod
  var data = new Uint8Array(CHUNK_WIDTH * CHUNK_WIDTH * CHUNK_HEIGHT)

  // Terrain generation
  // Compute the biome at each of the four corners of the current chucnk
  var biome = generateChunkBiome(x, z, CHUNK_WIDTH * voxsize)
  var cw = CHUNK_WIDTH
  var perlinHeightmap
  // If all four corners are the same biome, generate the terrain
  // Otherwise, generate the terrain four different ways and interpolate
  if (biome.b00 === biome.b01 && biome.b00 === biome.b10 && biome.b00 === biome.b11) {
    perlinHeightmap = perlin.generate(x, z, lod, cw, biome.b00.perlinHeightmapAmplitudes)
  } else {
    var p00 = perlin.generate(x, z, lod, cw, biome.b00.perlinHeightmapAmplitudes)
    var p01 = perlin.generate(x, z, lod, cw, biome.b01.perlinHeightmapAmplitudes)
    var p10 = perlin.generate(x, z, lod, cw, biome.b10.perlinHeightmapAmplitudes)
    var p11 = perlin.generate(x, z, lod, cw, biome.b11.perlinHeightmapAmplitudes)
    perlinHeightmap = new Float32Array(cw * CHUNK_WIDTH)
    for (var i = 0; i < cw; i++) {
      for (var j = 0; j < cw; j++) {
        var index = i * cw + j
        var u = i / cw
        var v = j / cw
        perlinHeightmap[index] = interp.cosine2D(
          p00[index], p01[index], p10[index], p11[index],
          u, v)
      }
    }
  }

  // Go from a Perlin heightmap to actual voxels
  for (var iy = 0; iy < CHUNK_HEIGHT; iy++) {
    for (var ix = 0; ix < CHUNK_WIDTH; ix++) {
      for (var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxy = iy * voxsize
        var voxPerlinHeight = perlinHeightmap[ix * CHUNK_WIDTH + iz]

        var voxtype
        if (voxy < voxPerlinHeight && voxy > 30) {
          voxtype = VOX_TYPE_STONE
        } else if (voxy < voxPerlinHeight) {
          voxtype = VOX_TYPE_GRASS
        } else if (voxy < 15) {
          voxtype = VOX_TYPE_WATER
        } else {
          voxtype = VOX_TYPE_AIR
        }

        data[iy * CHUNK_WIDTH * CHUNK_WIDTH + ix * CHUNK_WIDTH + iz] = voxtype
      }
    }
  }

  return {
    x: x,
    z: z,
    lod: lod,
    data: data
  }
}

// Helper method for looking up a value from a packed voxel array (YXZ layout)
function getVoxel (data, ix, iy, iz) {
  return data[iy * CHUNK_WIDTH * CHUNK_WIDTH + ix * CHUNK_WIDTH + iz]
}

// Helper method for writing up a value from a packed voxel array (YXZ layout)
function setVoxel (data, ix, iy, iz, val) {
  data[iy * CHUNK_WIDTH * CHUNK_WIDTH + ix * CHUNK_WIDTH + iz] = val
}

// Creates or updates the skybox
// Sets colors, sun, moon, day or night lighting depending on current time
function updateSky (t) {
  var sunAngle = new Date().getTime() / 1000 / SECONDS_PER_GAME_DAY * 2 * Math.PI
  var sunDirection = [
    Math.sin(sunAngle) * Math.sqrt(2),
    Math.cos(sunAngle),
    Math.sin(sunAngle) * Math.sqrt(2)
  ]
  // Value in [0, 1], 0 means fully night, 1 means fully day
  var twilight = 0.2
  var day = clamp(sunDirection[1], -twilight, twilight) / twilight / 2 + 0.5
  if (sunDirection[1] < 0.0) {
    sunDirection = scale(-1, sunDirection)
  }

  updateSkybox(day)
  updateSun(day, sunDirection)
  if (ENABLE_CLOUDS) updateClouds(t)
  sky.sunDirection = sunDirection
  sky.day = day
}

// Creates the sun or moon
// Just a bright square in the sky
// How it looks depends on the SUN_* constants
function updateSun (day, sunDir) {
  var up = [0, 1, 0]
  var u = normalize(cross(sunDir, up))
  var v = normalize(cross(u, sunDir))

  var center = scale(SUN_DISTANCE, normalize(sunDir))
  var r = SUN_DIAMETER / 2
  var c00 = sum(center, scale(-r, u), scale(-r, v))
  var c01 = sum(center, scale(-r, u), scale(+r, v))
  var c10 = sum(center, scale(+r, u), scale(-r, v))
  var c11 = sum(center, scale(+r, u), scale(+r, v))
  var verts = []
  var colors = []
  verts.push(
    c00[0], c00[1], c00[2],
    c01[0], c01[1], c01[2],
    c11[0], c11[1], c11[2],
    c00[0], c00[1], c00[2],
    c11[0], c11[1], c11[2],
    c10[0], c10[1], c10[2]
  )
  var col = [0.6 + 0.4 * day, 1, 1, 1]
  colors.push(
    col[0], col[1], col[2], col[3],
    col[0], col[1], col[2], col[3],
    col[0], col[1], col[2], col[3],
    col[0], col[1], col[2], col[3],
    col[0], col[1], col[2], col[3],
    col[0], col[1], col[2], col[3]
  )

  // send it to the GPU
  updateVertexColorBuffers(sky.sun.gl, verts, colors)
}

// Creates the skybox, returns GL buffers {vertexCount, vertexBuffer, colorBuffer}
// Takes a value between 0 and 1, 0 is fully night, 1 is fully day
function updateSkybox (day) {
  var verts = []
  var colors = []

  // constants
  var h = SKY_HORIZON_DISTANCE
  var colorBottom = interp.tween(NIGHT.SKY_COLOR_BOTTOM, DAY.SKY_COLOR_BOTTOM, day)
  var colorHorizon = interp.tween(NIGHT.SKY_COLOR_HORIZON, DAY.SKY_COLOR_HORIZON, day)
  var colorTop = interp.tween(NIGHT.SKY_COLOR_TOP, DAY.SKY_COLOR_TOP, day)

  // north, east, south, west
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 2; j++) {
      var z0 = (i === 0 || i === 1) ? h : -h
      var x0 = (i === 1 || i === 2) ? h : -h
      var z1 = (i === 1 || i === 2) ? h : -h
      var x1 = (i === 2 || i === 3) ? h : -h
      var h0 = (j === 0) ? -h : 0
      var h1 = (j === 0) ? 0 : h
      var c0 = (j === 0) ? colorBottom : colorHorizon
      var c1 = (j === 0) ? colorHorizon : colorTop
      verts.push(
      x0, h0, z0,
      x0, h1, z0,
      x1, h1, z1,
      x0, h0, z0,
      x1, h1, z1,
      x1, h0, z1)
      colors.push(
        c0[0], c0[1], c0[2], c0[3],
        c1[0], c1[1], c1[2], c1[3],
        c1[0], c1[1], c1[2], c1[3],
        c0[0], c0[1], c0[2], c0[3],
        c1[0], c1[1], c1[2], c1[3],
        c0[0], c0[1], c0[2], c0[3]
      )
    }
  }

  // top
  var c = colorTop
  verts.push(
    h, h, h,
    h, h, -h,
    -h, h, -h,
    h, h, h,
    -h, h, -h,
    -h, h, h)
  colors.push(
    c[0], c[1], c0[2], c[3],
    c[0], c[1], c1[2], c[3],
    c[0], c[1], c1[2], c[3],
    c[0], c[1], c0[2], c[3],
    c[0], c[1], c1[2], c[3],
    c[0], c[1], c0[2], c[3]
  )

  // send it to the GPU
  updateVertexColorBuffers(sky.skybox.gl, verts, colors)
}

// Translucent clouds float across the sky
function updateClouds (t) {
  var verts = []
  var colors = []

  var camera = dcgl.getCamera()
  var cg = CLOUD_GRID
  var px = Math.floor(camera.loc[0] / cg) * cg
  var pz = Math.floor(camera.loc[2] / cg) * cg
  var tmod = t / CLOUD_GRID * CLOUD_SPEED % 1.0

  for (var i = -3; i < 3; i++) {
    for (var j = -3; j < 3; j++) {
      var x0 = px + i * cg + tmod * cg
      var z0 = pz + j * cg
      var y0 = CLOUD_LEVEL
      var x1 = x0 + CLOUD_WIDTH
      var y1 = y0 + CLOUD_HEIGHT
      var z1 = z0 + CLOUD_WIDTH
      for (var fside = 0; fside < 2; fside++) {
        var xface = fside === 1 ? x1 : x0
        verts.push(
          xface, y0, z0,
          xface, y1, z0,
          xface, y0, z1,
          xface, y0, z1,
          xface, y1, z0,
          xface, y1, z1
        )
        var yface = fside === 1 ? y1 : y0
        verts.push(
          x0, yface, z0,
          x1, yface, z0,
          x0, yface, z1,
          x0, yface, z1,
          x1, yface, z0,
          x1, yface, z1
        )
        var zface = fside === 1 ? z1 : z0
        verts.push(
          x0, y0, zface,
          x1, y0, zface,
          x0, y1, zface,
          x0, y1, zface,
          x1, y0, zface,
          x1, y1, zface
        )
      }
    }
  }

  var c = CLOUD_COLOR
  for (i = 0; i < verts.length; i++) {
    colors.push(c[0], c[1], c[2], c[3])
  }

  // send it to the GPU
  updateVertexColorBuffers(sky.clouds.gl, verts, colors)
}

// Creates buffers, sends data to GPU
// Returns {vertexCount, vertexBuffer, colorBuffer}
function updateVertexColorBuffers (buffers, verts, colors) {
  buffers.vertexBuffer = buffers.vertexBuffer || gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW)
  buffers.colorBuffer = buffers.colorBuffer || gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW)
  buffers.vertexCount = verts.length / 3
}

// Meshes a chunk, and sends the mesh (as a vertex buffer + UV buffer)
// to the GPU.
//
// Meshes exposed surfaces only.
function loadChunkToGPU (chunk) {
  if (chunk.gl) return

  // greedy meshing algo
  // http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
  var verts = []
  var uvs = []
  var normals = []
  var meshed = new Uint8Array(chunk.data.length)
  for (var iy = 0; iy < CHUNK_HEIGHT; iy++) {
    for (var ix = 0; ix < CHUNK_WIDTH; ix++) {
      for (var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxtype = getVoxel(chunk.data, ix, iy, iz)
        if (voxtype === VOX_TYPE_AIR) continue
        var isMeshed = getVoxel(meshed, ix, iy, iz)
        if (isMeshed > 0) continue

        // expand to largest possible quad
        var jy = iy
        var jx = ix
        var jz = iz
        for (; jy < CHUNK_HEIGHT; jy++) {
          var jvoxtype = getVoxel(chunk.data, jx, jy, jz)
          if (jvoxtype !== voxtype) break
        }
        for (; jx < CHUNK_WIDTH; jx++) {
          var hasGaps = false
          for (var ky = iy; ky < jy; ky++) {
            hasGaps |= getVoxel(chunk.data, jx, ky, jz) !== voxtype
          }
          if (hasGaps) break
        }
        for (; jz < CHUNK_WIDTH; jz++) {
          hasGaps = false
          for (ky = iy; ky < jy; ky++) {
            for (var kx = ix; kx < jx; kx++) {
              hasGaps |= getVoxel(chunk.data, kx, ky, jz) !== voxtype
            }
          }
          if (hasGaps) break
        }

        // mark quad as done
        for (ky = iy; ky < jy; ky++) {
          for (kx = ix; kx < jx; kx++) {
            for (var kz = iz; kz < jz; kz++) {
              setVoxel(meshed, kx, ky, kz, 1)
            }
          }
        }

        // add the six faces (12 tris total) for the quad
        var eps = 0.001
        var voxsize = 1 << chunk.lod
        var voxx = chunk.x + ix * voxsize
        var voxy = iy * voxsize
        var voxz = chunk.z + iz * voxsize
        var voxx2 = chunk.x + jx * voxsize - eps
        var voxy2 = jy * voxsize - eps
        var voxz2 = chunk.z + jz * voxsize - eps
        for (var fside = 0; fside < 2; fside++) {
          var xface = fside === 1 ? voxx2 : voxx
          verts.push(
            xface, voxy, voxz,
            xface, voxy2, voxz,
            xface, voxy, voxz2,
            xface, voxy, voxz2,
            xface, voxy2, voxz,
            xface, voxy2, voxz2
          )
          var yface = fside === 1 ? voxy2 : voxy
          verts.push(
            voxx, yface, voxz,
            voxx2, yface, voxz,
            voxx, yface, voxz2,
            voxx, yface, voxz2,
            voxx2, yface, voxz,
            voxx2, yface, voxz2
          )
          var zface = fside === 1 ? voxz2 : voxz
          verts.push(
            voxx, voxy, zface,
            voxx2, voxy, zface,
            voxx, voxy2, zface,
            voxx, voxy2, zface,
            voxx2, voxy, zface,
            voxx2, voxy2, zface
          )

          var dir = fside * 2 - 1 // -1 or 1
          normals.push(
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0,
            dir, 0, 0
          )
          normals.push(
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0,
            0, dir, 0
          )
          normals.push(
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir,
            0, 0, dir
          )

          var uvVox = blockTextureUVs[voxtype]
          var uvVoxXZ = uvVox.side
          var uvVoxY = fside === 1 ? uvVox.top : uvVox.bottom
          var uvVoxXZ0 = uvVoxXZ[0] / 16
          var uvVoxXZ1 = uvVoxXZ[1] / 16
          var uvVoxY0 = uvVoxY[0] / 16
          var uvVoxY1 = uvVoxY[1] / 16
          var uvW = 0 // 1/16
          uvs.push(
            uvVoxXZ0, uvVoxXZ1,
            uvVoxXZ0 + uvW, uvVoxXZ1,
            uvVoxXZ0, uvVoxXZ1 + uvW,
            uvVoxXZ0, uvVoxXZ1 + uvW,
            uvVoxXZ0 + uvW, uvVoxXZ1,
            uvVoxXZ0 + uvW, uvVoxXZ1 + uvW,

            uvVoxY0, uvVoxY1,
            uvVoxY0 + uvW, uvVoxY1,
            uvVoxY0, uvVoxY1 + uvW,
            uvVoxY0, uvVoxY1 + uvW,
            uvVoxY0 + uvW, uvVoxY1,
            uvVoxY0 + uvW, uvVoxY1 + uvW,

            uvVoxXZ0, uvVoxXZ1,
            uvVoxXZ0 + uvW, uvVoxXZ1,
            uvVoxXZ0, uvVoxXZ1 + uvW,
            uvVoxXZ0, uvVoxXZ1 + uvW,
            uvVoxXZ0 + uvW, uvVoxXZ1,
            uvVoxXZ0 + uvW, uvVoxXZ1 + uvW
          )
        }
      }
    }
  }

  var vertexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
  var normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW)
  var uvBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW)
  var vertexCount = verts.length / 3

  chunk.gl = {
    vertexBuffer: vertexBuffer,
    vertexCount: vertexCount,
    normalBuffer: normalBuffer,
    uvBuffer: uvBuffer
  }
}

// Removes all resources a (loaded) chunk
// uses on the GPU. Sets chunk.gl to null
function unloadChunkFromGPU (chunk) {
  if (!chunk.gl) return
  gl.deleteBuffer(chunk.gl.vertexBuffer)
  gl.deleteBuffer(chunk.gl.uvBuffer)
  chunk.gl = null
}

// Handles all keyboard and mouse input
// Lets you move and look around
function handleInput (dt) {
  var camera = dcgl.getCamera()
  var speed = INPUT_SPEED
  if (dcinput.keys.shift) speed *= 3
  var dir = camera.dir
  if (dcinput.keys.up) move(dt * speed, dir + Math.PI, camera.attitude)
  if (dcinput.keys.down) move(dt * speed, dir, -camera.attitude)
  if (dcinput.keys.left) move(dt * speed, dir + Math.PI * 0.5, 0)
  if (dcinput.keys.right) move(dt * speed, dir + Math.PI * 1.5, 0)

  var movePx = dcinput.getAndClearMouseMove()
  if (!dcinput.mouse.drag && !dcinput.mouse.pointerLock) return
  camera.attitude -= movePx.y * INPUT_SENSITIVITY
  camera.attitude = Math.min(0.4 * Math.PI, Math.max(-0.4 * Math.PI, camera.attitude))
  camera.dir -= movePx.x * INPUT_SENSITIVITY
}

// Moves you (the camera) in any direction by any distance
function move (r, theta, attitude) {
  var camera = dcgl.getCamera()
  camera.loc[0] += Math.sin(theta) * Math.cos(attitude) * r
  camera.loc[1] += Math.sin(attitude) * r
  camera.loc[2] += Math.cos(theta) * Math.cos(attitude) * r
}

function getCartesianSpiral (n) {
  var ret = [[0, 0]]
  if (ret.length >= n) return ret
  for (var dist = 1; ; dist++) {
    for (var x = -dist; x < dist; x++) {
      ret.push([x, dist])
      if (ret.length >= n) return ret
    }
    for (var y = dist; y > -dist; y--) {
      ret.push([dist, y])
      if (ret.length >= n) return ret
    }
    for (x = dist; x > -dist; x--) {
      ret.push([x, -dist])
      if (ret.length >= n) return ret
    }
    for (y = -dist; y < dist; y++) {
      ret.push([-dist, y])
      if (ret.length >= n) return ret
    }
  }
}

// Loads up to MAX_CHUNK_LOADS_PER_FRAME chunk, starting with lowest LOD
// and starting closest to where you stand
// Unloads *all* chunks that are out of range
function updateChunks () {
  var chunksLoaded = 0
  var camera = dcgl.getCamera()
  for (var lod = 0; lod < LOD_MAX; lod++) {
    var lodChunkWidth = CHUNK_WIDTH << lod
    var chunkx = Math.round(camera.loc[0] / lodChunkWidth) * lodChunkWidth
    var chunkz = Math.round(camera.loc[2] / lodChunkWidth) * lodChunkWidth

    // load one chunk, if needed, to fill an 2*radius by 2*radius
    // neighborhood of chunks around where you're standing
    var chunkRadius = LOD_CHUNK_RADIUS * lodChunkWidth
    // align with the grid of the next LOD level up
    var chunkWidth2 = lodChunkWidth * 2
    var minX = Math.floor((chunkx - chunkRadius) / chunkWidth2) * chunkWidth2
    var maxX = Math.floor((chunkx + chunkRadius) / chunkWidth2) * chunkWidth2
    var minZ = Math.floor((chunkz - chunkRadius) / chunkWidth2) * chunkWidth2
    var maxZ = Math.floor((chunkz + chunkRadius) / chunkWidth2) * chunkWidth2
    // only go to next coarser (further away) LOD once the finer ones are fully loaded
    // load from closest to farthest away, in a spiral
    for (var i = 0; i < LOD_SPIRAL.length; i++) {
      if (chunksLoaded >= MAX_CHUNK_LOADS_PER_FRAME) {
        break
      }
      var x = LOD_SPIRAL[i][0] * lodChunkWidth + chunkx
      var z = LOD_SPIRAL[i][1] * lodChunkWidth + chunkz
      if (x < minX || x >= maxX || z < minZ || z >= maxZ) continue
      var key = x + '_' + z + '_' + lod
      if (chunks[key]) continue

      // load chunk
      var chunk = createChunk(x, z, lod)
      loadChunkToGPU(chunk)
      linkChunkIntoChunkTree(chunk)
      chunks[key] = chunk
      chunksLoaded++
    }

    // unload all chunks outside the neighborhood
    for (key in chunks) {
      chunk = chunks[key]
      if (chunk.lod !== lod) continue
      if (chunk.x < minX ||
        chunk.x >= maxX ||
        chunk.z < minZ ||
        chunk.z >= maxZ) {
        unloadChunkFromGPU(chunk)
        delete chunks[key]
      }
    }
  }
  if (chunksLoaded === 0 && prevChunksLoaded !== 0) {
    console.log('All chunks loaded! ' + (new Date().getTime() - startMillis) + 'ms')
  } else if (chunksLoaded === 0) {
    startMillis = new Date().getTime()
  }
  prevChunksLoaded = chunksLoaded
}
var prevChunksLoaded = 0
var startMillis = new Date().getTime()

// Links the chunk at LOD x to the four chunks at LOD x-1
// if already loaded and to the parent (LOD x+1) if loaded
function linkChunkIntoChunkTree (chunk) {
  chunk.children = []
  if (chunk.lod > 0) {
    var halfWidth = CHUNK_WIDTH << (chunk.lod - 1)
    for (var ix = 0; ix <= 1; ix++) {
      for (var iz = 0; iz <= 1; iz++) {
        var x = chunk.x + halfWidth * ix
        var z = chunk.z + halfWidth * iz
        var child = chunks[x + '_' + z + '_' + (chunk.lod - 1)]
        if (child) {
          chunk.children.push(child)
          if (child.parent && child.parent.gl) {
            throw new Error('Invalid state: two identical parent chunks')
          }
          child.parent = chunk
        }
      }
    }
  }
  var doubleWidth = CHUNK_WIDTH << (chunk.lod + 1)
  var px = Math.floor(chunk.x / doubleWidth) * doubleWidth
  var pz = Math.floor(chunk.z / doubleWidth) * doubleWidth
  chunk.parent = chunks[px + '_' + pz + '_' + (chunk.lod + 1)]
  if (chunk.parent) {
    var sibIx = 0
    for (; sibIx < chunk.parent.children.length; sibIx++) {
      var sibling = chunk.parent.children[sibIx]
      if (sibling.x === chunk.x && sibling.z === chunk.z) {
        if (sibling.gl) {
          throw new Error('Invalid state: two identical child chunks loaded')
        }
        break
      }
    }
    if (sibIx < chunk.parent.children.length) {
      // replace sibling
      chunk.parent.children[sibIx] = chunk
    } else {
      // add new sibling
      chunk.parent.children.push(chunk)
    }
  }
}

// Does this chunk have all four of its children loaded?
// If so we want to draw those instead
function hasBetterChunksLoaded (chunk) {
  if (chunk.children.length < 4) return false
  for (var i = 0; i < 4; i++) {
    if (!chunk.children[i].gl) return false
  }
  return true
}

// Renders one frame
// Expects initGL() to already have been called,
// and voxel chunks to already be loaded to the GPU
function renderFrame (canvas) {
  // scale, clear window
  var width = canvas.clientWidth
  var height = canvas.clientHeight
  canvas.width = width
  canvas.height = height
  gl.viewport(0, 0, width, height)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // setup camera
  mat4.perspective(dcgl.getProjectionMatrix(), 1, width / height, 0.2, 4000.0)

  // draw the scene
  renderSky(canvas)
  renderVoxels(canvas)
  if (ENABLE_CLOUDS) renderClouds(canvas)
}

// Renders the skybox and clouds
function renderSky () {
  // setup matrixes
  var camera = dcgl.getCamera()
  var mvmat = dcgl.getModelViewMatrix()
  mat4.identity(mvmat)
  mat4.rotate(mvmat, mvmat, -camera.attitude, [1, 0, 0])

  // setup shaders
  dcgl.setShaders('vert_simple', 'frag_color')
  dcgl.setCameraUniforms()

  // draw the sky
  drawColorBuffers(sky.skybox.gl)

  // draw the sun
  mat4.rotate(mvmat, mvmat, -camera.dir, [0, 1, 0])
  dcgl.setCameraUniforms()
  drawColorBuffers(sky.sun.gl)
}

// Renders a slow-moving layer clouds
// See updateClouds()
function renderClouds () {
  // setup matrixes
  var camera = dcgl.getCamera()
  var mvmat = dcgl.getModelViewMatrix()
  mat4.identity(mvmat)
  mat4.rotate(mvmat, mvmat, -camera.attitude, [0, 0, 1])
  mat4.rotate(mvmat, mvmat, -camera.dir, [0, 1, 0])
  mat4.translate(mvmat, mvmat, [-camera.loc[0], -camera.loc[1], -camera.loc[2]])

  // setup shaders
  dcgl.setShaders('vert_simple', 'frag_color')
  dcgl.setCameraUniforms()

  // draw the clouds
  drawColorBuffers(sky.clouds.gl)
}

// Helper method to bind and draw a vertex + color buffer
function drawColorBuffers (buffers) {
  var posVertexPosition = dcgl.getAttributeLocation('aVertexPosition')
  var posVertexColor = dcgl.getAttributeLocation('aVertexColor')
  gl.enableVertexAttribArray(posVertexPosition)
  gl.enableVertexAttribArray(posVertexColor)

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer)
  gl.vertexAttribPointer(posVertexPosition, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.colorBuffer)
  gl.vertexAttribPointer(posVertexColor, 4, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, buffers.vertexCount)

  // clean up
  gl.disableVertexAttribArray(posVertexPosition)
  gl.disableVertexAttribArray(posVertexColor)
}

// Draws all currently loaded chunks of voxels.
// See updateChunks() for loading and unloading logic.
function renderVoxels () {
  // setup matrices
  var camera = dcgl.getCamera()
  var mvmat = dcgl.getModelViewMatrix()
  mat4.identity(mvmat)
  mat4.rotate(mvmat, mvmat, -camera.attitude, [1, 0, 0])
  mat4.rotate(mvmat, mvmat, -camera.dir, [0, 1, 0])
  mat4.translate(mvmat, mvmat, [-camera.loc[0], -camera.loc[1], -camera.loc[2]])

  // setup uniforms
  dcgl.setShaders('vert_texture', 'frag_voxel')
  dcgl.setCameraUniforms()
  var sunDir = sky.sunDirection
  var diffuse = interp.tween(NIGHT.DIFFUSE_COLOR, DAY.DIFFUSE_COLOR, sky.day)
  var ambient = interp.tween(NIGHT.AMBIENT_COLOR, DAY.AMBIENT_COLOR, sky.day)
  var posLightDir = dcgl.getUniformLocation('uLightDir')
  var posLightDiffuse = dcgl.getUniformLocation('uLightDiffuse')
  var posLightAmbient = dcgl.getUniformLocation('uLightAmbient')
  gl.uniform3f(posLightDir, sunDir[0], sunDir[1], sunDir[2])
  gl.uniform3f(posLightDiffuse, diffuse[0], diffuse[1], diffuse[2])
  gl.uniform3f(posLightAmbient, ambient[0], ambient[1], ambient[2])

  // draw some voxels
  var posVertexPosition = dcgl.getAttributeLocation('aVertexPosition')
  var posVertexNormal = dcgl.getAttributeLocation('aVertexNormal')
  var posVertexUV = dcgl.getAttributeLocation('aVertexUV')
  var posSampler = dcgl.getUniformLocation('uSampler')
  gl.enableVertexAttribArray(posVertexPosition)
  gl.enableVertexAttribArray(posVertexNormal)
  gl.enableVertexAttribArray(posVertexUV)
  // bind textures (already copied to GPU)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, blockTexture)
  gl.uniform1i(posSampler, 0)
  for (var key in chunks) {
    var chunk = chunks[key]
    // don't render if the chunk is not loaded to GPU
    if (!chunk.gl) continue
    // don't render if we have a higher res chunk for the same location
    if (hasBetterChunksLoaded(chunk)) continue
    // don't render if we're going to render the parent instead
    if (chunk.parent && !hasBetterChunksLoaded(chunk.parent)) continue

    // bind verts and uvs (already copied to GPU)
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.vertexBuffer)
    gl.vertexAttribPointer(posVertexPosition, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.normalBuffer)
    gl.vertexAttribPointer(posVertexNormal, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.uvBuffer)
    gl.vertexAttribPointer(posVertexUV, 2, gl.FLOAT, false, 0, 0)

    gl.drawArrays(gl.TRIANGLES, 0, chunk.gl.vertexCount)
  }

  // clean up
  gl.disableVertexAttribArray(posVertexPosition)
  gl.disableVertexAttribArray(posVertexNormal)
  gl.disableVertexAttribArray(posVertexUV)
}

function main () {
  var canvas = document.getElementById('gl')

  // initialize input
  dcinput = new DCInput(canvas)
  canvas.addEventListener('click', function () { dcinput.requestPointerLock() })

  // initialize webgl
  dcgl = new DCGL(canvas)
  gl = dcgl.getWebGLContext()

  // load resources. once that's done, start the render loop
  blockTexture = dcgl.loadTexture('textures/isabella.png', function () {
    dcgl.requestAnimationFrame(frame, canvas)
  })

  // render loop
  var startTime = new Date().getTime() / 1000
  var lastTime = startTime
  function frame () {
    var now = new Date().getTime() / 1000
    var t = now - startTime
    var dt = now - lastTime
    lastTime = now

    handleInput(dt)
    updateChunks()
    updateSky(t)
    renderFrame(canvas)
    dcgl.requestAnimationFrame(frame, canvas)
  }
}

main()
