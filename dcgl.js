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
    var loc = vec3.create([0,50,150]);
    var dir = 0;
    var attitude = 0;

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
        gl = canvas.getContext("webgl", {antialias:true})
            || die("could not initialise WebGL");
        console.log("GL attributes: "+JSON.stringify(gl.getContextAttributes()))
        console.log("GL antialiasing level: "+ gl.getParameter(gl.SAMPLES))
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;

        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);

        //gl.enable(gl.BLEND);
        //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
        if (shader_prog_cache[key]) {
            prog = shader_prog_cache[key];
        } else {
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

    function getAttribute(name) {
        var pos = gl.getAttribLocation(prog, name)
        if (pos < 0) {
            die("Attribute "+name+" not found. " +
              "Maybe stripped out because it's unused in shader code?")
        }
        return pos
    }

    function getUniform(name) {
        var pos = gl.getUniformLocation(prog, name)
        if (pos < 0) {
            die("Uniform "+name+" not found. " +
              "Maybe stripped out because it's unused in shader code?")
        }
        return pos
    }

    // Starts loading a texture from a given image URL
    // Returns the texture ID immediately
    // Calls an optional callback once the texture is copied to the GPU
    function loadTexture(url, cb) {
      var tex = gl.createTexture()
      var texImg = new Image()
      texImg.onload = function() { 
          gl.bindTexture(gl.TEXTURE_2D, tex)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texImg)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR)
          gl.generateMipmap(gl.TEXTURE_2D)
          gl.bindTexture(gl.TEXTURE_2D, null)
        
          if (cb) cb()
      }
      texImg.src = url
      return tex
    }



    /* MATRIX STACK + UNIFORMS */

    function mvPush(){
        var copy = mat4.create();
        mat4.set(mvmat, copy);
        mvstack.push(copy);
    }

    function mvPop(){
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

    // TODO: DELETE. creating a new buffer each time is wrong.
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

