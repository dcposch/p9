/**
 * DC
 * Generate some simple test models, + models for glrace.
 */

function genSquare(){
    var verts = [
        1,0,0,
        1,1,0,
        0,1,0,
        0,0,0,
        2,2,3];
    var cols = [
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1];
    var norms = [
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1];
    var tris = [
        0, 1, 2,
        0, 2, 3,
        0, 4, 2,
            ];

    var model = {
        ntris:tris.length/3,
        nverts:verts.length/3,

        positions:new Float32Array(verts),
        colors:new Float32Array(cols),
        normals:new Float32Array(norms),
        tris:new Uint32Array(tris),
        position:vec3.create()
    };
    return model;
}


function genTerrain(){
    var tris = [], cols = [], norms = [];
    var heights = [], normals = [];
    var w = 20, h = 20;
    for(var i = 0; i < w; i++){
        for(var j = 0; j < h; j++){
            var x = i - 10;
            var y = Math.sin(i*j/30)/0.5;
            heights[i*h+j] = y;
            var di = Math.cos(i*j/30)/0.5*j/30;
            var dj = Math.cos(i*j/30)/0.5*i/30;
            var normal = vec3.normalize(vec3.create([dj,-1,di]));
            normals[i*h+j] =[normal[0], normal[1], normal[2]];
            var z = j - 10;
            if(i > 0 && j > 0){
                tris.push(x,   heights[i*h+j],       z);
                tris.push(x-1, heights[(i-1)*h+j-1], z-1);
                tris.push(x,   heights[i*h+j-1],     z-1);
                tris.push(x-1, heights[(i-1)*h+j-1], z-1);
                tris.push(x,   heights[i*h+j],       z);
                tris.push(x-1, heights[(i-1)*h+j],   z);

                cols.push(0.7,   0,   0);
                cols.push(0.7,   0,   0);
                cols.push(0.7,   0,   0);
                cols.push(0.7,   0,   0);
                cols.push(0.7,   0,   0);
                cols.push(0.7,   0,   0);

                norms.push.apply(norms, normals[i*h+j]);
                norms.push.apply(norms, normals[(i-1)*h+j]);
                norms.push.apply(norms, normals[i*h+j-1]);
                norms.push.apply(norms, normals[(i-1)*h+j-1]);
                norms.push.apply(norms, normals[i*h+j]);
                norms.push.apply(norms, normals[(i-1)*h+j]);
            }
        }
    }
    var model = {
        nverts: tris.length/3,

        positions:new Float32Array(tris),
        colors:new Float32Array(cols),
        normals:new Float32Array(norms)
    };
    return model;
}

function genTerrain2(){
    var verts = [], cols = [], norms = [], tris = [];
    var heights = [];
    var w = 20, h = 20;
    for(var i = 0; i < w; i++){
        for(var j = 0; j < h; j++){
            var x = i - 10;
            var y = Math.sin(i*j/30)/0.5;
            heights[i*h+j] = y;
            var z = j - 10;
            if(i > 0 && j > 0){
                var ix = verts.length;

                verts.push(x,   heights[i*h+j],       z);
                verts.push(x-1, heights[(i-1)*h+j-1], z-1);
                verts.push(x,   heights[i*h+j-1],     z-1);
                verts.push(x-1, heights[(i-1)*h+j],   z);

                cols.push(1,   1,   0);
                cols.push(1,   0,   1);
                cols.push(0,   1,   1);
                cols.push(0,   1,   0);

                norms.push(1,   0,   0);
                norms.push(0,   1,   0);
                norms.push(0,   0,   1);
                norms.push(0,   1,   0);

                tris.push(ix);
                tris.push(ix+1);
                tris.push(ix+2);
                tris.push(ix+2);
                tris.push(ix+1);
                tris.push(ix+3);
            }
        }
    }

    var model = {
        ntris:tris.length/3,
        nverts:verts.length/3,

        positions:new Float32Array(verts),
        colors:new Float32Array(cols),
        normals:new Float32Array(norms),
        tris:new Uint32Array(tris),
        position:vec3.create()
    };
    return model;
}


function genGlobe(){
    var radius = 20;
    var verts = [], cols = [], norms = [];
    var lats = 100;
    var maxlons = 100;
    for(var i = 0; i < lats; i++){
        var lat = (((i+0.5)/lats)*2-1)*Math.PI/2;
        var lons = Math.cos(lat)*maxlons;
        for(var j = 0; j < lons; j++){
            var lon = (j/lons)*Math.PI*2;

            var x = Math.cos(lon)*Math.cos(lat);
            var y = Math.sin(lat);
            var z = Math.sin(lon)*Math.cos(lat);

            verts.push(x*radius, y*radius, z*radius);
            cols.push(Math.sin(lon)*.5+.5,Math.cos(lon)*.5+.5,Math.sin(lon+1)*.5+.5);
            norms.push(x,y,z);
        }
    }
    var model = {
        type:'pointcloud',
        positions:new Float32Array(verts),
        colors:new Float32Array(cols),
        normals:new Float32Array(norms)
    };
    return model;
}

function genGrid(){
    var gridWidth = 10000;
    var y = -2;
    var verts = [
        -gridWidth/2, y, gridWidth/2,
        -gridWidth/2, y,-gridWidth/2,
         gridWidth/2, y, gridWidth/2,
         gridWidth/2, y,-gridWidth/2];
    var norms = [
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0];
    var uvs = [
        0,1,
        0,0,
        1,1,
        1,0
        ];
    var tris = [
        0, 1, 2,
        1, 2, 3];
    var model = {
        ntris:tris.length/3,
        nverts:verts.length/3,

        positions:new Float32Array(verts),
        uvs:new Float32Array(uvs),
        normals:new Float32Array(norms),
        tris:new Uint32Array(tris),
        position:vec3.create(),

        vertex_shader: "vert_texture",
        fragment_shader: "frag_grid",

        prerender: function(mod) {
            var pos = car.position;
            var uuv = [(pos[0] + gridWidth/2) / gridWidth, 
               (pos[2] + gridWidth/2) / gridWidth];
            var uvPos = gl.getUniformLocation(prog, "uUv");
            gl.uniform2f(uvPos,uuv[0],uuv[1]);
        }
    };
    return model;
}

function loadRoad(fn){
    var loc = "data/roads/nurburgring.csv";
    $.get(loc, function(data){
        var lines = data.split('\n');
        console.log(lines[0].toLowerCase());
        //if(lines[0].toLowerCase()!="latitude,longitude,elevation")
        //    die("road file is in wrong format: "+loc);
        var n = lines.length-1;
        var lats=[],lons=[],elevs=[];
        for(var i = 1; i <= n; i++){
            var parts = lines[i].split(',');
            lats.push(parseFloat(parts[0]));
            lons.push(parseFloat(parts[1]));
            elevs.push(parseFloat(parts[2]));
        }

        //make the track start at the origin
        var points = [];
        var m_per_deg = 6371000 * 3.1416 / 180;
        var m_per_deg_lon = m_per_deg*Math.cos(lats[0]*3.1416/180.0);
        for(var i = 0; i < n; i++){
            var dy = (lats[i]-lats[0])*m_per_deg;
            var dx = (lons[i]-lons[0])*m_per_deg_lon;
            var dz = elevs[i]-elevs[0];
            points.push([dx,dy,dz]);
        }


        //now get some verts and normals
        var verts = [], cols = [], tris = [];
        for(var i = 0; i < n; i++){
            verts[3*i  ] = points[i][0];
            verts[3*i+1] = points[i][1];
            verts[3*i+2] = points[i][2];

            //TODO: less shitty geom
            var dx = points[(i+1)%n][0] - points[i][0];
            var dy = points[(i+1)%n][1] - points[i][1];
            var ndx = dy/Math.sqrt(dx*dx+dy*dy)*10;
            var ndy = -dx/Math.sqrt(dx*dx+dy*dy)*10;
            verts[3*n+3*i  ] = points[i][0]+ndx;
            verts[3*n+3*i+1] = points[i][1]+ndy;
            verts[3*n+3*i+2] = points[i][2];

            tris.push(i, (i+1)%n, n+i);
            tris.push((i+1)%n, n+(i+1)%n, n+i);

            cols[3*i  ] = Math.cos(i/10.0);
            cols[3*i+1] = Math.sin(i/23.0);
            cols[3*i+2] = Math.sin(i/37.0);
            cols[3*n+3*i  ] =  Math.cos(i/10.0);
            cols[3*n+3*i+1] =  Math.sin(i/23.0);
            cols[3*n+3*i+2] =  Math.sin(i/37.0);
        }
        var model = {
            ntris:n*2,
            nverts:n*2,

            positions:new Float32Array(verts),
            colors:new Float32Array(cols),
            //normals:new Float32Array(norms),
            tris:new Uint32Array(tris),
            position:vec3.create()
        };

        console.log(["ROAD",model]);
        fn(model);
    }, 'text');
}

function genCar(){
    var verts = [
        -3,-3,-3,
        -3,-3, 3,
        -3, 3,-3,
        -3, 3, 3,
         2,-2,-2,
         2,-2, 2,
         2, 2,-2,
         2, 2, 2];
    var cols = [
        0,0.5,0,
        0,0.5,0,
        0,0.5,0,
        0,0.5,0,
        0,0.7,0,
        0,0.7,0,
        0,0.7,0,
        0,0.7,0];
    var norms = [
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1,
        1,1,1];
    var tris = [
        0, 1, 2,
        1, 2, 3,
        4, 5, 6,
        5, 6, 7,
        0, 1, 4,
        1, 4, 5,
        2, 3, 6,
        3, 6, 7,
        0, 2, 4,
        2, 4, 6,
        1, 3, 5,
        3, 5, 7 ];

    var model = {
        ntris:tris.length/3,
        nverts:verts.length/3,

        positions:new Float32Array(verts),
        colors:new Float32Array(cols),
        normals:new Float32Array(norms),
        tris:new Uint32Array(tris),
        position:vec3.create(),

        speed:0.0,
        heading:0.0
    };

    return model;

}

