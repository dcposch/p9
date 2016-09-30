precision mediump float;
attribute vec3 aVertexPosition;
attribute vec4 aVertexColor;
uniform mat4 uMatrix;
varying vec4 vColor;

void main(void) {
  gl_Position = uMatrix * vec4(aVertexPosition, 1.0);
  vColor = aVertexColor;
}
