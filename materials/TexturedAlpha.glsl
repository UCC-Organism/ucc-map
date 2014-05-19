#ifdef VERT

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
attribute vec3 position;
attribute vec2 texCoord;
varying vec2 vTexCoord;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vTexCoord = texCoord;
}

#endif

#ifdef FRAG

uniform sampler2D texture;
uniform float alpha;
uniform bool xray;
varying vec2 vTexCoord;


void main() {
  gl_FragColor = texture2D(texture, vTexCoord) * alpha;
  gl_FragColor.a = alpha;

  if (xray) {
   float w = (1.0 - gl_FragColor.r) * 2.0;
   gl_FragColor.rgba = vec4(w);
  }
}

#endif
