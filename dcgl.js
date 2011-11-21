/*
   Dan Posch
   Sep 2011
   DCGL simple webgl library
*/

    var gl, prog;

    // uniforms
    var pmat = mat4.create();
    var mvmat = mat4.create();
    var mvstack = [];

    // anim
    var t = 0.0, dt = (1/60.0);

    // camera
    var loc = vec3.create([0,0,40]);
    var dir = 0;
    var azith = 0;

    //shaders
    var shader_cache = {};
    var shader_prog_cache = {};
    var shaders = shaders || {};

    function die(msg){
        throw msg;
    }

    function log(msg){
        console.log(msg);
    }

    function initGL(canvas) {
        gl = canvas.getContext("experimental-webgl")
            || die("could not initialise WebGL");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.DEPTH_TEST);
        //gl.enable(gl.BLEND);
        //gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        //gl.enable(gl.VERTEX_PROGRAM_POINT_SIZE);
        //gl.enable(gl.POINT_SMOOTH);
    }

    function shader(id) {
        //memoize
        if(shader_cache[id])
            return shader_cache[id];
        
        //get the source
        log("finding and compiling shader "+id);
        var source, type;
        if(typeof(shaders[id])=="undefined"){
            var shaderScript = document.getElementById(id) || die("can't find "+id);
            source = shaderScript.firstChild.textContent;
            type = shaderScript.type;
            if (shaderScript.type == "x-shader/x-fragment") {
                type = gl.FRAGMENT_SHADER;
            } else if (type == "x-shader/x-vertex") {
                type = gl.VERTEX_SHADER;
            } else {
                die("unrecognized shader type "+type);
            }
        } else {
            source = shaders[id];
            if(id.indexOf("vert")==0){
                type=gl.VERTEX_SHADER;
            } else {
                type = gl.FRAGMENT_SHADER;
            }
        }

        //create the shader
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);

        //compile
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            die(gl.getShaderInfoLog(shader));
        }

        shader_cache[id] = shader;
        return shader;
    }

    
    function setShaders(vertexShader, fragmentShader) {
        //memoize
        var key = vertexShader + "_" + fragmentShader;
        if(shader_prog_cache[key]){
            prog = shader_prog_cache[key];
        }
        else {
            //link them
            log("linking shader program "+key);
            prog = gl.createProgram();
            gl.attachShader(prog, shader(vertexShader));
            gl.attachShader(prog, shader(fragmentShader));
            gl.linkProgram(prog);
            gl.getProgramParameter(prog, gl.LINK_STATUS) || 
                die("could not link shaders");

            shader_prog_cache[key] = prog;
        }
        gl.useProgram(prog);
    }




    /* MATRIX STACK + UNIFORMS */

    function mvpush(){
        var copy = mat4.create();
        mat4.set(mvmat, copy);
        mvstack.push(copy);
    }

    function mvpop(){
        mvmat = mvstack.pop() || die("can't pop, no modelview mats on stack");
    }

    function setUniforms() {
        var mat = mat4.create();
        mat4.multiply(pmat, mvmat, mat);
        var matPos = gl.getUniformLocation(prog, "uMatrix");
        gl.uniformMatrix4fv(matPos, false, mat);

        var camPos = gl.getUniformLocation(prog, "uCameraLoc");
        gl.uniform3f(camPos, loc.x, loc.y, loc.z);

    }

    //sets a shader program attribute
    //
    //name, eg "aVertexPosition"
    //vec, a Float32Array
    //itemsize, stride in floats (eg 3 for an array of vec3s)
    //buftype, defaults to gl.STATIC_DRAW
    function setAttribute(name, vec, itemsize, buftype){
        if(!buftype){
            buftype = gl.STATIC_DRAW;
        }

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, vec, buftype);
        var pos = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, itemsize, gl.FLOAT, false, 0, 0);
    }
    
    function setAttributes(model) {
        if(model.positions)
            setAttribute("aVertexPosition", model.positions, 3);
        if(model.colors)
            setAttribute("aVertexColor", model.colors, 3);
        if(model.normals)
            setAttribute("aVertexNormal", model.normals, 3);
        if(model.uvs)
            setAttribute("aVertexUv", model.uvs, 2);
    }


    function animate(renderFunction, element){
        // via http://paulirish.com/2011/requestanimationframe-for-smart-animating/
        // shim layer with setTimeout fallback
        var requestAnimFrame = 
            window.requestAnimationFrame       || 
            window.webkitRequestAnimationFrame || 
            window.mozRequestAnimationFrame    || 
            window.oRequestAnimationFrame      || 
            window.msRequestAnimationFrame     || 
            function( callback, element){
              window.setTimeout(callback, 1000 / 60);
            };
 
        var startTime = new Date().getTime()/1000.0;
        var lastTime = 0;
        (function animloop(){
            //update time
            t = (new Date().getTime())/1000.0 - startTime;
            dt = t - lastTime;
            lastTime = t;

            //render frame
            renderFunction();

            //wait
            requestAnimFrame(animloop, element);
        })(); 
    }

