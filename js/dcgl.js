var glMatrix = require('gl-matrix')
var mat4 = glMatrix.mat4
var vec3 = glMatrix.vec3

/**
 * Sets up a WebGL context.
 * Compiles and links shaders.
 * Keeps track of some state, like where the camera is and where it's pointing.
 */
module.exports = function DCGL (canvas) {
  // STATE
  // webgl context
  var gl = null

  // current shader program
  var prog = null

  // uniforms
  var pmat = mat4.create()
  var mvmat = mat4.create()

  // camera
  var camera = {
    loc: vec3.clone([0, 50, 150]),
    dir: 0, // radians, counterclockwise, 0 faces in the +X direction
    attitude: 0 // radians, 0 is level, +pi/2 faces straight up
  }

  // shaders
  var shaderCache = {}
  var shaderProgramCache = {}

  // logging
  var log = function (message) { console.log(message) }
  var die = function (errorMessage) { throw new Error(errorMessage) }

  // PUBLIC INTERFACE
  this.getWebGLContext = function () { return gl }
  this.getModelViewMatrix = function () { return mvmat }
  this.getProjectionMatrix = function () { return pmat }
  this.getCamera = function () { return camera }
  this.setShaders = setShaders
  this.getShaderProgram = getShaderProgram
  this.getAttributeLocation = getAttributeLocation
  this.getUniformLocation = getUniformLocation
  this.loadTexture = loadTexture
  this.setCameraUniforms = setCameraUniforms
  // via http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  // shim layer with setTimeout fallback
  this.requestAnimationFrame = function (callback, elem) {
    var fn = window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (callback, _) {
        window.setTimeout(callback, 1000 / 60)
      }
    fn(callback, elem)
  }

  // INITIALIZATION
  gl = canvas.getContext('webgl', {antialias: true})
  if (!gl) {
    throw new Error('Sorry, looks like your browser doesn\'t support WebGL')
  }
  console.log('GL attributes: ' + JSON.stringify(gl.getContextAttributes()))
  console.log('GL antialiasing level: ' + gl.getParameter(gl.SAMPLES))
  gl.viewportWidth = canvas.width
  gl.viewportHeight = canvas.height

  gl.clearColor(1.0, 1.0, 1.0, 1.0)
  gl.enable(gl.DEPTH_TEST)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  /*
   * Gets a WebGL shader program, (vertex + fragment shader),
   * compiling each if necessary and then linking them.
   *
   * Expects BOTH of these <script> tags to be present:
   * <script id="(vertexShaderID)" type="x-shader/x-fragment"> or
   * <script id="(fragmentShaderID)" type="x-shader/x-vertex">
   */
  function setShaders (vertexShaderID, fragmentShaderID) {
    // memoize
    var key = vertexShaderID + '_' + fragmentShaderID
    if (shaderProgramCache[key]) {
      prog = shaderProgramCache[key]
    } else {
      // link them
      log('linking shader program ' + key)
      prog = gl.createProgram()
      gl.attachShader(prog, getShaderProgram(vertexShaderID))
      gl.attachShader(prog, getShaderProgram(fragmentShaderID))
      gl.linkProgram(prog)
      gl.getProgramParameter(prog, gl.LINK_STATUS) || die('could not link shaders')
      shaderProgramCache[key] = prog
    }

    gl.useProgram(prog)
  }

  /**
   * Gets a WebGL shader, compiling it if necessary.
   *
   * getShaderProgram("foo") looks for either
   * <script id="foo" type="x-shader/x-fragment"> or
   * <script id="foo" type="x-shader/x-vertex">
   */
  function getShaderProgram (id) {
    // memoize
    if (shaderCache[id]) {
      return shaderCache[id]
    }

    // get the source
    log('finding and compiling shader ' + id)
    var shaderScript = document.getElementById(id) || die("can't find " + id)
    var source = shaderScript.firstChild.textContent
    var type = shaderScript.type
    if (shaderScript.type === 'x-shader/x-fragment') {
      type = gl.FRAGMENT_SHADER
    } else if (type === 'x-shader/x-vertex') {
      type = gl.VERTEX_SHADER
    } else {
      die('unrecognized shader type ' + type)
    }

    // create the shader
    var shader = gl.createShader(type)
    gl.shaderSource(shader, source)

    // compile
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      die(gl.getShaderInfoLog(shader))
    }

    shaderCache[id] = shader
    return shader
  }

  /**
   * Gets a shader attribute location.
   *
   * Use that to bind the attribute to a buffer, eg a vertex or color buffer.
   */
  function getAttributeLocation (name) {
    var pos = gl.getAttribLocation(prog, name)
    if (pos === null || pos < 0) {
      throw new Error('Attribute ' + name + ' not found. ' +
        'Maybe stripped out because it\'s unused in shader code?')
    }
    return pos
  }

  /**
   * Gets a shader uniform location.
   *
   * Use that to bind the uniform, eg to a constant or texture.
   */
  function getUniformLocation (name) {
    var pos = gl.getUniformLocation(prog, name)
    if (pos === null || pos < 0) {
      throw new Error('Uniform ' + name + ' not found. ' +
        'Maybe stripped out because it\'s unused in shader code?')
    }
    return pos
  }

  /**
   * Starts loading a texture from a given image URL
   * Returns the texture ID immediately
   * Calls an optional callback once the texture is copied to the GPU
   */
  function loadTexture (url, cb) {
    var tex = gl.createTexture()
    var texImg = new window.Image()
    texImg.onload = function () {
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

  /**
   * Sets the projection and modelview matrices.
   *
   * Expects your shader program to contain the following variables:
   * - uMatrix represents the combined projection * modelview matrix
   * - uCameraLoc represents the camera location in world coordinates
   */
  function setCameraUniforms () {
    var mat = mat4.create()
    mat4.multiply(mat, pmat, mvmat)
    var matPos = gl.getUniformLocation(prog, 'uMatrix')
    gl.uniformMatrix4fv(matPos, false, mat)

    var camPos = gl.getUniformLocation(prog, 'uCameraLoc')
    gl.uniform3f(camPos, camera.loc[0], camera.loc[1], camera.loc[2])
  }
}
