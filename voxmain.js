/**
 * DC
 * March 2015
 * Trying out some voxel rendering
 */

// Constants
// Each chunk is 16x16 voxels wide (X, Z) and 64 voxels high (Y)
var CHUNK_WIDTH = 16
var CHUNK_HEIGHT = 64

var LOD_MAX = 4 // biggest blocks are 2^4 = 16 units on a side
var LOD_CHUNK_RADIUS = 8 // 16x16 neighborhood around the viewer
var LOD_CHUNK_RADIUS2 = LOD_CHUNK_RADIUS*LOD_CHUNK_RADIUS
var LOD_SPIRAL = getCartesianSpiral(LOD_CHUNK_RADIUS2*8) // 4x + some extra

// There are different kinds of blocks
var VOX_TYPE_AIR = 0
var VOX_TYPE_WATER = 1
var VOX_TYPE_GRASS = 2
var VOX_TYPE_STONE = 3

// How fast you can move and look around
var INPUT_SPEED = 25 // blocks per second
var INPUT_SENSITIVITY = 0.01 // radians per pixel

// Voxel world
var chunks = {}

// The DCInput object. See dcinput.js
var input = null

// Textures for every kind of block, all on one image.
// See http://dcpos.ch/canvas/dcgl/blocksets/simple.png
var blockTexture
var blockTextureUVs = {}
blockTextureUVs[VOX_TYPE_WATER] = {side:[13,12], top:[13,12], bottom:[13,12]}
blockTextureUVs[VOX_TYPE_GRASS] = {side:[3,0], top:[0,0], bottom:[2,0]}
blockTextureUVs[VOX_TYPE_STONE] = {side:[1,0], top:[1,0], bottom:[1,0]}


// Generates a test chunk at the given coords and LOD
function createChunk(x, z, lod) {
    var data = new Uint8Array(CHUNK_WIDTH*CHUNK_WIDTH*CHUNK_HEIGHT)
    for(var iy = 0; iy < CHUNK_HEIGHT; iy++)
    for(var ix = 0; ix < CHUNK_WIDTH; ix++)
    for(var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxsize = 1<<lod;
        var voxx = x + ix*voxsize
        var voxy = iy*voxsize
        var voxz = z + iz*voxsize

        var voxtype
        if(voxy < 10*((Math.sin(voxx/23) + Math.cos(voxz/19))+2)) {
        // if(voxy < 30 && voxy > 20 && ix > 1 && ix < 8 && iz > 1 && iz < 8) {
            voxtype = VOX_TYPE_GRASS
        } else if (voxy < 15){
            voxtype = VOX_TYPE_WATER
        } else {
            voxtype = VOX_TYPE_AIR
        }

        data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz] = voxtype
    }
    return {
        x: x,
        z: z,
        lod: lod,
        data: data
    }
}

// Helper method for looking up a value from a packed voxel array (YXZ layout)
function getVoxel(data, ix, iy, iz) {
    return data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz]
}

// Helper method for writing up a value from a packed voxel array (YXZ layout)
function setVoxel(data, ix, iy, iz, val) {
    data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz] = val
}

// Meshes a chunk, and sends the mesh (as a vertex buffer + UV buffer)
// to the GPU
function loadChunkToGPU(chunk) {
    if(chunk.gl) return

    // greedy meshing algo
    // http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
    var verts = [], uvs = []
    var meshed = new Uint8Array(chunk.data.length)
    for(var iy = 0; iy < CHUNK_HEIGHT; iy++)
    for(var ix = 0; ix < CHUNK_WIDTH; ix++)
    for(var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxtype = getVoxel(chunk.data, ix, iy, iz)
        if (voxtype === VOX_TYPE_AIR) continue
        var isMeshed = getVoxel(meshed, ix, iy, iz)
        if (isMeshed > 0) continue

        // expand to largest possible quad
        var jy = iy
        var jx = ix
        var jz = iz
        for(; jy < CHUNK_HEIGHT; jy++) {
            var jvoxtype = getVoxel(chunk.data, jx, jy, jz)
            if (jvoxtype !== voxtype) break
        }
        for(; jx < CHUNK_WIDTH; jx++) {
            var hasGaps = false
            for(var ky = iy; ky < jy; ky++) {
                hasGaps |= getVoxel(chunk.data, jx, ky, jz) !== voxtype
            }
            if (hasGaps) break
        }
        for(; jz < CHUNK_WIDTH; jz++) {
            var hasGaps = false
            for(var ky = iy; ky < jy; ky++)
            for(var kx = ix; kx < jx; kx++) {
                hasGaps |= getVoxel(chunk.data, kx, ky, jz) !== voxtype
            }
            if (hasGaps) break
        }

        // mark quad as done
        for(var ky = iy; ky < jy; ky++)
        for(var kx = ix; kx < jx; kx++) 
        for(var kz = iz; kz < jz; kz++) {
            setVoxel(meshed, kx, ky, kz, 1)
        }

        // add the six faces (12 tris total) for the quad
        var eps = 0.001
        var voxsize = 1 << chunk.lod
        var voxx = chunk.x + ix*voxsize
        var voxy = iy*voxsize
        var voxz = chunk.z + iz*voxsize
        var voxx2 = chunk.x + jx*voxsize - eps
        var voxy2 = jy*voxsize - eps
        var voxz2 = chunk.z + jz*voxsize - eps
        for(var fside = 0; fside < 2; fside++) {
            var xface = fside === 1 ? voxx2 : voxx
            verts.push(
                xface, voxy, voxz,
                xface, voxy2, voxz,
                xface, voxy, voxz2,
                xface, voxy, voxz2,
                xface, voxy2, voxz,
                xface, voxy2, voxz2)
            var yface = fside === 1 ? voxy2 : voxy
            verts.push(
                voxx, yface, voxz,
                voxx2, yface, voxz,
                voxx, yface, voxz2,
                voxx, yface, voxz2,
                voxx2, yface, voxz,
                voxx2, yface, voxz2)
            var zface = fside === 1 ? voxz2 : voxz
            verts.push(
                voxx, voxy, zface,
                voxx2, voxy, zface,
                voxx, voxy2, zface,
                voxx, voxy2, zface,
                voxx2, voxy, zface,
                voxx2, voxy2, zface)

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
                uvVoxXZ0+uvW, uvVoxXZ1,
                uvVoxXZ0, uvVoxXZ1+uvW,
                uvVoxXZ0, uvVoxXZ1+uvW,
                uvVoxXZ0+uvW, uvVoxXZ1,
                uvVoxXZ0+uvW, uvVoxXZ1+uvW,

                uvVoxY0, uvVoxY1,
                uvVoxY0+uvW, uvVoxY1,
                uvVoxY0, uvVoxY1+uvW,
                uvVoxY0, uvVoxY1+uvW,
                uvVoxY0+uvW, uvVoxY1,
                uvVoxY0+uvW, uvVoxY1+uvW,

                uvVoxXZ0, uvVoxXZ1,
                uvVoxXZ0+uvW, uvVoxXZ1,
                uvVoxXZ0, uvVoxXZ1+uvW,
                uvVoxXZ0, uvVoxXZ1+uvW,
                uvVoxXZ0+uvW, uvVoxXZ1,
                uvVoxXZ0+uvW, uvVoxXZ1+uvW)
        }
    }

    var vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
    var uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW)
    var vertexCount = verts.length / 3
    chunk.gl = {
        vertexBuffer: vertexBuffer,
        vertexCount: vertexCount,
        uvBuffer: uvBuffer
    }
}

// Removes all resources a (loaded) chunk
// uses on the GPU. Sets chunk.gl to null
function unloadChunkFromGPU(chunk) {
    if(!chunk.gl) return
    gl.deleteBuffer(chunk.gl.vertexBuffer)
    gl.deleteBuffer(chunk.gl.uvBuffer)
    chunk.gl = null
}

// Handles all keyboard and mouse input
// Lets you move and look around
function handleInput() {
    var speed = INPUT_SPEED
    if(input.keys.shift) speed *= 3
    if(input.keys.up) move(dt*speed, dir + Math.PI, attitude)
    if(input.keys.down) move(dt*speed, dir, -attitude)
    if(input.keys.left) move(dt*speed, dir + Math.PI*0.5, 0)
    if(input.keys.right) move(dt*speed, dir + Math.PI*1.5, 0)

    var movePx = input.getAndClearMouseMove()
    if(!input.mouse.drag && !input.mouse.pointerLock) return
    attitude -= movePx.y*INPUT_SENSITIVITY
    attitude = Math.min(0.4*Math.PI, Math.max(-0.4*Math.PI, attitude))
    dir -= movePx.x*INPUT_SENSITIVITY
}

// Moves you (the camera) in any direction by any distance
function move(r, theta, attitude) {
    loc[0] += Math.sin(theta) * Math.cos(attitude) * r
    loc[1] += Math.sin(attitude) * r
    loc[2] += Math.cos(theta) * Math.cos(attitude) * r
}

function getCartesianSpiral(n) {
    var ret = [[0,0]]
    if(ret.length >= n) return ret
    for(var dist = 1;; dist++) {
        for(var x = -dist; x < dist; x++) {
            ret.push([x,dist])
            if(ret.length >= n) return ret
        }
        for(var y = dist; y > -dist; y--) {
            ret.push([dist,y])
            if(ret.length >= n) return ret
        }
        for(var x = dist; x > -dist; x--) {
            ret.push([x,-dist])
            if(ret.length >= n) return ret
        }
        for(var y = -dist; y < dist; y++) {
            ret.push([-dist,y])
            if(ret.length >= n) return ret
        }
    }
}

// Loads up to *one* chunk, starting with lowest LOD
// and starting closest to where you stand
// Unloads *all* chunks that are out of range
function updateChunks() {
    var lodBounds = []
    var allLoaded = true
    for(var lod = 0; lod < LOD_MAX; lod++) {
        var lodChunkWidth = CHUNK_WIDTH<<lod
        var chunkx = Math.round(loc[0]/lodChunkWidth) * lodChunkWidth
        var chunkz = Math.round(loc[2]/lodChunkWidth) * lodChunkWidth

        // load one chunk, if needed, to fill an 2*radius by 2*radius 
        // neighborhood of chunks around where you're standing
        var chunkRadius = LOD_CHUNK_RADIUS*lodChunkWidth
        // align with the grid of the next LOD level up
        var chunkWidth2 = lodChunkWidth*2
        var minX = Math.floor((chunkx-chunkRadius)/chunkWidth2)*chunkWidth2
        var maxX = Math.floor((chunkx+chunkRadius)/chunkWidth2)*chunkWidth2
        var minZ = Math.floor((chunkz-chunkRadius)/chunkWidth2)*chunkWidth2
        var maxZ = Math.floor((chunkz+chunkRadius)/chunkWidth2)*chunkWidth2
        // only go to next coarser (further away) LOD once the finer ones are fully loaded
        if(allLoaded) {
            // load from closest to farthest away, in a spiral
            for(var i = 0; i < LOD_SPIRAL.length; i++) {
                var x = LOD_SPIRAL[i][0]*lodChunkWidth+chunkx
                var z = LOD_SPIRAL[i][1]*lodChunkWidth+chunkz
                if(x<minX || x>=maxX || z<minZ || z>=maxZ) continue
                var key = x+"_"+z+"_"+lod
                if(chunks[key]) continue
                allLoaded = false
                var chunk = createChunk(x, z, lod)
                loadChunkToGPU(chunk)
                linkChunkIntoChunkTree(chunk)
                chunks[key] = chunk
                break
            }
        }

        // unload all chunks outside the neighborhood
        for(key in chunks) {
            var chunk = chunks[key]
            if(chunk.lod !== lod) continue
            if(chunk.x < minX ||
               chunk.x >= maxX ||
               chunk.z < minZ ||
               chunk.z >= maxZ) {
                unloadChunkFromGPU(chunk)
                delete chunks[key]
            }
        }
    }
}

// Links the chunk at LOD x to the four chunks at LOD x-1
// if already loaded and to the parent (LOD x+1) if loaded
function linkChunkIntoChunkTree(chunk) {
    chunk.children = []
    if(chunk.lod > 0)  {
        var halfWidth = CHUNK_WIDTH<<(chunk.lod-1)
        for(var ix = 0; ix <= 1; ix++)
        for(var iz = 0; iz <= 1; iz++) {
            var x = chunk.x + halfWidth*ix
            var z = chunk.z + halfWidth*iz
            var child = chunks[x+"_"+z+"_"+(chunk.lod-1)]
            if(child) {
                chunk.children.push(child)
                if(child.parent && child.parent.gl) die("Invalid state: two identical parent chunks loaded");
                child.parent = chunk
            }
        }
    }
    var doubleWidth = CHUNK_WIDTH<<(chunk.lod+1)
    var px = Math.floor(chunk.x/doubleWidth)*doubleWidth
    var pz = Math.floor(chunk.z/doubleWidth)*doubleWidth
    chunk.parent = chunks[px+"_"+pz+"_"+(chunk.lod+1)]
    if(chunk.parent) {
        var sibIx = 0
        for(; sibIx < chunk.parent.children.length; sibIx++){
            var sibling = chunk.parent.children[sibIx]
            if(sibling.x === chunk.x && sibling.z === chunk.z) {
                if(sibling.gl) die("Invalid state: two identical child chunks loaded")
                break
            }
        }
        if (sibIx < chunk.parent.children.length ) {
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
function hasBetterChunksLoaded(chunk) {
    if(chunk.children.length < 4) return false
    for(var i = 0; i < 4; i++) {
        if(!chunk.children[i].gl) return false
    }
    return true
}

// Renders one frame
// Expects initGL() to already have been called, 
// and voxel chunks to already be loaded to the GPU
function renderFrame(canvas){
    // scale, clear window
    var width = canvas.clientWidth
    var height = canvas.clientHeight
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height) 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // setup camera
    mat4.perspective(50, width / height, 1.0, 3000.0, pmat)

    // setup matrixes
    mat4.identity(mvmat)
    mat4.rotate(mvmat, -attitude, [1,0,0])
    mat4.rotate(mvmat, -dir, [0,1,0])
    mat4.translate(mvmat, [-loc[0], -loc[1], -loc[2]])

    // draw some voxels
    setShaders("vert_texture", "frag_voxel")
    setUniforms()
    var posVertexPosition = getAttribute("aVertexPosition")
    var posVertexUV = getAttribute("aVertexUV")
    var posSampler = getUniform("uSampler")
    gl.enableVertexAttribArray(posVertexPosition)
    gl.enableVertexAttribArray(posVertexUV)
    // bind textures (already copied to GPU)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, blockTexture)
    gl.uniform1i(posSampler, 0)
    for(var key in chunks) {
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
        gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.uvBuffer)
        gl.vertexAttribPointer(posVertexUV, 2, gl.FLOAT, false, 0, 0)

        gl.drawArrays(gl.TRIANGLES, 0, chunk.gl.vertexCount)
    }
}

function main() {
    var canvas = document.getElementById("gl")
    input = new DCInput(canvas)
    canvas.addEventListener('click', input.requestPointerLock.bind(input))

    initGL(canvas)
    blockTexture = loadTexture("blocksets/simple.png", function(){
        animate(function(){
            handleInput()
            updateChunks()
            renderFrame(canvas)
        }, canvas)
    })
}

