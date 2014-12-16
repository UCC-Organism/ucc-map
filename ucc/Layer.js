var geom = require('pex-geom');
var glu = require('pex-glu');
var materials = require('pex-materials');
var color = require('pex-color');
var sys = require('pex-sys');
var gen = require('pex-gen');

var Mesh = glu.Mesh;
var Plane = gen.Plane;
var Cube = gen.Cube;
var SolidColor = materials.SolidColor;
var TexturedAlpha = require('../materials/TexturedAlpha');
var Vec3 = geom.Vec3;
var Quat = geom.Quat;
var Texture2D = glu.Texture2D;
var Platform = sys.Platform;
var Color = color.Color;

function Layer(imageFile, id) {
  this.id = id;
  this.position = new Vec3(0, 0, 0);
  this.scale = new Vec3(1, 1, 1);
  this.up = new Vec3(0, 1, 0);
  this.rotation = new Quat();
  this.axis = new Vec3(0, 1, 0);
  this.rotationAngle = 0;
  this.showImage = true;
  this.selected = false;
  this.alpha = 1;

  Texture2D.load(imageFile, { flip: false }, function(texture) {
    texture.bind();
    gl = texture.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //ext = gl.getExtension("MOZ_EXT_texture_filter_anisotropic");;
    if (Platform.isPlask) {
      gl.texParameterf(gl.TEXTURE_2D, 0x84FE, 4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    planeGeom = new Plane(1, texture.height/texture.width, 1, 1, 'x', 'z');
    this.planeMesh = new Mesh(planeGeom, new TexturedAlpha({texture:texture, alpha:0.5}));
    this.planeMesh.updateBoundingBox();
    borderGeom = new Plane(1, texture.height/texture.width, 3, 3, 'x', 'z');
    borderGeom.computeEdges();
    this.border = new Mesh(borderGeom, new SolidColor({color:new Color(0.1, 0.99, 0.9, 1)}), { useEdges:true });
  }.bind(this));
}

Layer.prototype.draw = function(camera) {
  if (this.planeMesh) {
    this.rotation.setAxisAngle(this.up, this.rotationAngle);
    this.planeMesh.material.uniforms.alpha = this.alpha;
    if (!this.position.equals(this.planeMesh.position) || !this.scale.equals(this.planeMesh.scale) || !this.rotation.equals(this.planeMesh.rotation)) {
      this.planeMesh.position.setVec3(this.position);
      this.planeMesh.rotation.setQuat(this.rotation);
      this.planeMesh.scale.setVec3(this.scale);

      this.border.position.setVec3(this.position);
      this.border.rotation.setQuat(this.rotation);
      this.border.scale.setVec3(this.scale);
      this.planeMesh.updateBoundingBox();
    }
    if (this.showImage) {
      this.planeMesh.draw(camera);
    }
    if (this.selected) {
      this.border.draw(camera);
    }
  }
}

module.exports = Layer;