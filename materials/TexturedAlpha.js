var glu = require('pex-glu');
var color = require('pex-color');
var geom = require('pex-geom');
var Context = glu.Context;
var Material = glu.Material;
var Program = glu.Program;
var Color = color.Color;
var Vec3 = geom.Vec3;
var merge = require('merge');
var fs = require('fs');

var TexturedalphaGLSL = fs.readFileSync(__dirname + '/Texturedalpha.glsl', 'utf8');

function Texturedalpha(uniforms) {
  this.gl = Context.currentContext.gl;
  var program = new Program(TexturedalphaGLSL);

  var defaults = {
    alpha: 1
  };

  var uniforms = merge(defaults, uniforms);

  Material.call(this, program, uniforms);
}

Texturedalpha.prototype = Object.create(Material.prototype);

module.exports = Texturedalpha;