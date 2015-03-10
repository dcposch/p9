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
chunks.push(createChunk(0,0,1))
//for(var x = 0; x < 64; x+=CHUNK_WIDTH)
//for(var z = 0; z < 64; z+=CHUNK_WIDTH){
//    chunks.push(createChunk(x,z,1));
//}

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

function loadChunkToGPU(chunk) {
    if(chunk.gl) return;

    // naive algo: just draw every voxel
    var verts = [], uvs = [];
    for(var iy = 0; iy < CHUNK_HEIGHT; iy++)
    for(var ix = 0; ix < CHUNK_WIDTH; ix++)
    for(var iz = 0; iz < CHUNK_WIDTH; iz++) {
        var voxtype = chunk.data[iy*CHUNK_WIDTH*CHUNK_WIDTH + ix*CHUNK_WIDTH + iz]
        if (voxtype === VOX_TYPE_AIR) continue
        var voxsize = 1 << chunk.lod
        var voxx = chunk.x + ix*voxsize
        var voxy = iy*voxsize;
        var voxz = chunk.z + iz*voxsize
        for(var fside = 0; fside < 2; fside++) {
            var xface = voxx + fside*voxsize
            verts.push(
                xface, voxy, voxz,
                xface, voxy + voxsize, voxz,
                xface, voxy, voxz + voxsize,
                xface, voxy, voxz + voxsize,
                xface, voxy + voxsize, voxz,
                xface, voxy + voxsize, voxz + voxsize)
            var yface = voxy + fside*voxsize
            verts.push(
                voxx, yface, voxz,
                voxx + voxsize, yface, voxz,
                voxx, yface, voxz + voxsize,
                voxx, yface, voxz + voxsize,
                voxx + voxsize, yface, voxz,
                voxx + voxsize, yface, voxz + voxsize)
            var zface = voxz + fside*voxsize
            verts.push(
                voxx, voxy, zface,
                voxx + voxsize, voxy, zface,
                voxx, voxy + voxsize, zface,
                voxx, voxy + voxsize, zface,
                voxx + voxsize, voxy, zface,
                voxx + voxsize, voxy + voxsize, zface)

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

function frame(canvas){
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

    mvPush();
    mat4.rotate(mvmat, t, [0,1,0]);
    setUniforms();
    mvPop();

    // draw sample triangles
    /*setShaders("vert_simple", "frag_color");
    var verts = new Float32Array([
        0,0,0,
        1,0,0,
        0,1,0,
        0,1,0,
        1,0,0,
        1,1,0]);
    var cols = new Float32Array([
        1,1,1,
        0,1,1,
        1,0,1,
        1,0,1,
        0,1,1,
        0,0,1]);
    setAttribute("aVertexPosition", verts, 3);
    setAttribute("aVertexColor", cols, 3);
    gl.drawArrays(gl.TRIANGLES, 0, 6);*/

    // draw some voxels
    setShaders("vert_texture", "frag_voxel");
    var posVertexPosition = getAttribute("aVertexPosition")
    var posVertexUV = getAttribute("aVertexUV")
    // console.log([posVertexPosition, posVertexUV]);
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
    animate(frame.bind(this,canvas), canvas);
}
