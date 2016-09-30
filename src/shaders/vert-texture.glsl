attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aVertexUV;

uniform mat4 uMatrix;

varying vec2 vUV;
varying vec3 vPosition;
varying vec3 vNormal;

void main(void) {
    gl_Position = uMatrix * vec4(aVertexPosition, 1.0);
    vUV = aVertexUV;
    vPosition = aVertexPosition;
    vNormal = aVertexNormal;
}
