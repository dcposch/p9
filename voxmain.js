/**
 * DC
 * March 2015
 * Trying out some voxel rendering
 */

var CHUNK_WIDTH = 16;
var CHUNK_HEIGHT = 64;

var VOX_TYPE_AIR = 0;
var VOX_TYPE_WATER = 1;
var VOX_TYPE_STONE = 2;

var chunks = [];
for(var x = 0; x < 16*20; x+=CHUNK_WIDTH)
for(var z = 0; z < 16*20; z+=CHUNK_WIDTH){
    chunks.push(createChunk(x,z,1));
}

// Generates a test chunk at the given coords and LOD
function createChunk(x, z, lod) {
    var data = new Uint8Array(CHUNK_WIDTH*CHUNK_WIDTH*CHUNK_HEIGHT);
    for(var iy = 0; iy < CHUNK_HEIGHT; iy++)
    for(var ix = 0; ix < CHUNK_WIDTH; ix++)
    for(var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxsize = 1<<lod;
        var voxx = x + ix*voxsize;
        var voxy = iy*voxsize;
        var voxz = z + iz*voxsize;

        var voxtype;
        if(voxy < 10*((Math.sin(voxx/23) + Math.cos(voxz/19))+2)){
            voxtype = VOX_TYPE_STONE;
        } else if (voxy < 15){
            voxtype = VOX_TYPE_WATER;
        } else {
            voxtype = VOX_TYPE_AIR;
        }

        data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz] = voxtype;
    }
    return {
        x: x,
        z: z,
        lod: lod,
        data: data
    }
}

function getVoxel(data, ix, iy, iz) {
    return data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz]
}

function setVoxel(data, ix, iy, iz, val) {
    data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz] = val
}

function loadChunkToGPU(chunk) {
    if(chunk.gl) return;

    // greedy meshing algo
    // http://0fps.net/2012/06/30/meshing-in-a-minecraft-game/
    var verts = [], uvs = [];
    var meshed = new Uint8Array(chunk.data.length);
    for(var iy = 0; iy < CHUNK_HEIGHT; iy++)
    for(var ix = 0; ix < CHUNK_WIDTH; ix++)
    for(var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxtype = getVoxel(chunk.data, ix, iy, iz)
        if (voxtype === VOX_TYPE_AIR) continue
        var isMeshed = getVoxel(meshed, ix, iy, iz)
        if (isMeshed > 0) continue

        // expand to largest possible quad
        var jy = iy;
        var jx = ix;
        var jz = iz;
        for(; jy < CHUNK_HEIGHT; jy++) {
            var jvoxtype = getVoxel(chunk.data, jx, jy, jz)
            if (jvoxtype === VOX_TYPE_AIR) break
        }
        for(; jx < CHUNK_WIDTH; jx++) {
            var hasGaps = false
            for(var ky = iy; ky < jy; ky++) {
                hasGaps |= getVoxel(chunk.data, jx, ky, jz) == VOX_TYPE_AIR
            }
            if (hasGaps) break
        }
        for(; jz < CHUNK_WIDTH; jz++) {
            var hasGaps = false
            for(var ky = iy; ky < jy; ky++)
            for(var kx = ix; kx < jx; kx++) {
                hasGaps |= getVoxel(chunk.data, kx, ky, jz) == VOX_TYPE_AIR
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
        var voxsize = 1 << chunk.lod
        var voxx = chunk.x + ix*voxsize
        var voxy = iy*voxsize;
        var voxz = chunk.z + iz*voxsize
        var voxx2 = chunk.x + jx*voxsize
        var voxy2 = jy*voxsize;
        var voxz2 = chunk.z + jz*voxsize
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

            // TODO: spritemap uvs for each voxel face
            uvs.push(
                0, 0,
                0, 0,
                0, 0,
                0, 0,
                0, 0,
                0, 0,

                1, 0,
                1, 0,
                1, 0,
                1, 0,
                1, 0,
                1, 0,

                0, 1,
                0, 1,
                0, 1,
                0, 1,
                0, 1,
                0, 1)
        }
    }

    var vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
    var uvBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW)
    var vertexCount = verts.length / 3;
    console.log("Loaded chunk to GPU. "+vertexCount+" verts");
    chunk.gl = {
        vertexBuffer: vertexBuffer,
        vertexCount: vertexCount,
        uvBuffer: uvBuffer
    };
}

function moveXZ(r, theta) {
    loc[0] += Math.sin(theta) * r
    loc[2] += Math.cos(theta) * r
}

function handleInput() {
    var speed = 15
    if(keys.up) moveXZ(dt*speed, dir + Math.PI)
    if(keys.down) moveXZ(dt*speed, dir)
    if(keys.left) moveXZ(dt*speed, dir + Math.PI*0.5)
    if(keys.right) moveXZ(dt*speed, dir + Math.PI*1.5)

    if(!mouse.drag) return
    var sensitivity = 0.01
    azith -= mouse.move.y*sensitivity
    azith = Math.min(0.4*Math.PI, Math.max(-0.4*Math.PI, azith))
    dir -= mouse.move.x*sensitivity
}

function renderFrame(canvas){
    // scale, clear window
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // setup camera
    mat4.perspective(50, width / height, 1.0, 1000.0, pmat);

    // setup matrixes
    mat4.identity(mvmat);
    mat4.rotate(mvmat, -azith, [1,0,0]);
    mat4.rotate(mvmat, -dir, [0,1,0]);
    mat4.translate(mvmat, [-loc[0], -loc[1], -loc[2]]);
    setUniforms()

    // draw some voxels
    setShaders("vert_texture", "frag_voxel");
    var posVertexPosition = getAttribute("aVertexPosition")
    var posVertexUV = getAttribute("aVertexUV")
    gl.enableVertexAttribArray(posVertexPosition)
    gl.enableVertexAttribArray(posVertexUV)
    chunks.forEach(function(chunk) {
        if (!chunk.gl) return

        gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.vertexBuffer)
        gl.vertexAttribPointer(posVertexPosition, 3, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, chunk.gl.uvBuffer)
        gl.vertexAttribPointer(posVertexUV, 2, gl.FLOAT, false, 0, 0)

        gl.drawArrays(gl.TRIANGLES, 0, chunk.gl.vertexCount)
    });
}

function main() {
    var canvas = document.getElementById("gl");
    initGL(canvas);
    chunks.forEach(function(chunk){
        loadChunkToGPU(chunk);
    })
    animate(function(){
        handleInput();
        renderFrame(canvas);
    }, canvas);
}
