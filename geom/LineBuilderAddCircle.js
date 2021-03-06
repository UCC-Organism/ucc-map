var LineBuilder = require('pex-gen').LineBuilder;
var Vec3 = require('pex-geom').Vec3;
var Color = require('pex-color').Color;

LineBuilder.prototype.addCircle = function(center, r, n, color, u, v) {
  n = n || 16;
  u = u || 'x';
  v = v || 'y';
  color = Color.Red;
  for(var i=0; i<n; i++) {
    var a = i/n * Math.PI * 2;
    var na = (i+1)/n * Math.PI * 2;

    var p = center.dup();
    p[u] += r * Math.cos(a);
    p[v] += r * Math.sin(a);

    var np = center.dup();
    np[u] += r * Math.cos(na);
    np[v] += r * Math.sin(na);

    //duplicated points all over the place...
    this.addLine(p, np, color, color);
  }
}

module.exports = LineBuilder;