var geom = require('pex-geom');
var sys = require('pex-sys');
var Layer = require('./Layer');
var Plane = geom.Plane;
var Quat = geom.Quat;
var Vec3 = geom.Vec3;
var Mat4 = geom.Mat4;
var BoundingBox = geom.BoundingBox;
var Triangle2D = geom.Triangle2D;
var IO = sys.IO;

function rayBoxIntersection(ray, bbox, t0, t1) {
  var tmin = 0
  var tmax = 0
  var tymin = 0
  var tymax = 0
  var tzmin = 0
  var tzmax = 0
  if (ray.direction.x >= 0) {
    tmin = (bbox.min.x - ray.origin.x) / ray.direction.x;
    tmax = (bbox.max.x - ray.origin.x) / ray.direction.x;
  }
  else {
    tmin = (bbox.max.x - ray.origin.x) / ray.direction.x;
    tmax = (bbox.min.x - ray.origin.x) / ray.direction.x;
  }
  if (ray.direction.y >= 0) {
    tymin = (bbox.min.y - ray.origin.y) / ray.direction.y;
    tymax = (bbox.max.y - ray.origin.y) / ray.direction.y;
  }
  else {
    tymin = (bbox.max.y - ray.origin.y) / ray.direction.y;
    tymax = (bbox.min.y - ray.origin.y) / ray.direction.y;
  }

  if ((tmin > tymax) || (tymin > tmax)) {
    return 0;
  }

  if (tymin > tmin) {
    tmin = tymin;
  }
  if (tymax < tmax) {
    tmax = tymax;
  }
  if (ray.direction.z >= 0) {
    tzmin = (bbox.min.z - ray.origin.z) / ray.direction.z;
    tzmax = (bbox.max.z - ray.origin.z) / ray.direction.z;
  }
  else {
    tzmin = (bbox.max.z - ray.origin.z) / ray.direction.z;
    tzmax = (bbox.min.z - ray.origin.z) / ray.direction.z;
  }
  if ((tmin > tzmax) || (tzmin > tmax)) {
    return 1;
  }
  if (tzmin > tmin) {
    tmin = tzmin;
  }
  if (tzmax < tmax) {
    tmax = tzmax;
  }
  if (tmin > 0 && tmax > 0) {
    return 2;
  }
  return -2; //return (tmin < t1) && (tmax > t0)
}

function LayersController(window, scene, camera) {
  this.window = window;
  this.scene = scene;
  this.camera = camera;

  this.compactLayers = false;
  this.enabled = true;

  this.up = new Vec3(0, 1, 0);
  this.selectedLayer = null;
  this.dragCenter = new Vec3();
  this.dragStart = new Vec3();
  this.dragDelta = new Vec3();
  this.dragScale = new Vec3();
  this.dragStartRotationAngle = 0;

  this.loadLayers('data/layers.json');

  this.addEventHandlers();
}

LayersController.prototype.addEventHandlers = function() {
  this.window.on('mouseMoved', function(e) {
    if (!this.enabled) return ;
    this.testHit(e);
  }.bind(this));

  this.window.on('leftMouseDown', function(e) {
    if (!this.enabled) return ;
    if (this.selectedLayer) {
      var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
      var hits = ray.hitTestPlane(this.selectedLayer.position, this.up);
      this.dragCenter.setVec3(this.selectedLayer.position);
      this.dragStart.setVec3(hits[0]);
      this.dragDelta.asSub(hits[0], this.selectedLayer.position);
      this.dragScale.setVec3(this.selectedLayer.scale);
      this.dragRotationInit = false;
      this.dragRotationStartAngle = this.selectedLayer.rotationAngle;
    }
  }.bind(this));

  this.window.on('mouseDragged', function(e) {
    if (!this.enabled) return ;
    if (this.selectedLayer) {
      var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
      var hits = ray.hitTestPlane(this.selectedLayer.position, this.up);
      if (!e.shift && !e.option) {
        this.selectedLayer.position.setVec3(hits[0]).sub(this.dragDelta);
      }
      if (e.shift) {
        var originalDistance = this.dragStart.distance(this.dragCenter);
        var currentDistance = hits[0].distance(this.dragCenter);
        var scaleRatio = currentDistance / originalDistance;
        this.selectedLayer.scale.set(this.dragScale.x * scaleRatio, this.dragScale.y * scaleRatio, this.dragScale.z * scaleRatio);
      }
      if (e.option) {
        this.dragDelta.asSub(hits[0], this.selectedLayer.position);
        var radians = Math.atan2(-this.dragDelta.z, this.dragDelta.x);
        var angle = Math.floor(radians*180/Math.PI);
        if (!this.dragRotationInit) {
          this.dragRotationInit = true;
          this.dragRotationBaseAngle = angle;
        }
        var dragRotationDiffAngle = angle - this.dragRotationBaseAngle;
        this.selectedLayer.rotationAngle = this.dragRotationStartAngle + dragRotationDiffAngle;
        e.handled = true;;
      }
    }
  }.bind(this));

  this.window.on('keyDown', function(e) {
    if (!this.enabled) return ;
    switch (e.str) {
      case '-': if (this.selectedLayer) this.selectedLayer.alpha = Math.max(0, this.selectedLayer.alpha - 0.1); break;
      case '=': if (this.selectedLayer) this.selectedLayer.alpha = Math.min(1, this.selectedLayer.alpha + 0.1); break;
      case 'S': this.saveLayers('data/layers.json'); break;
      case 'L': this.loadLayers('data/layers.json'); break;
    }
    switch (e.keyCode) {
      case 48: this.toggleCompactLayers()
    }
  }.bind(this));
}


LayersController.prototype.toggleCompactLayers = function() {
  this.compactLayers = !this.compactLayers;
  this.scene.drawables.forEach(function(drawable, i) {
    if (drawable instanceof Layer) {
      drawable.position.y = this.compactLayers ? drawable.level * 0.005 : drawable.level * 0.1;
    }
  });
}

LayersController.prototype.saveLayers = function(fileName) {
  console.log('LayersController.saveLayers ' + fileName);
  var data = {};
  this.scene.drawables.forEach(function(drawable, i) {
    if (drawable instanceof Layer) {
      var layer = drawable;
      data[layer.name] = {
        position: layer.position,
        scale: layer.scale,
        rotationAngle: layer.rotationAngle
      };
    }
  });
  IO.saveTextFile(fileName, JSON.stringify(data));
}

LayersController.prototype.loadLayers = function(fileName) {
  console.log('LayersController.loadLayers ' + fileName)
  IO.loadTextFile(fileName, function(dataStr) {
    data = JSON.parse(dataStr);
    this.scene.forEach(function(drawable, i) {
      if (drawable instanceof Layer) {
        var layer = drawable;
        if (!data[layer.name]) return;
        layer.position.x = data[layer.name].position.x;
        layer.position.y = data[layer.name].position.y;
        layer.position.z = data[layer.name].position.z;
        layer.scale.x = data[layer.name].scale.x;
        layer.scale.y = data[layer.name].scale.y;
        layer.scale.z = data[layer.name].scale.z;
        layer.rotationAngle = data[layer.name].rotationAngle;
      }
    });
  }.bind(this));
}

LayersController.prototype.testHit = function(e) {
  var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height)
  var hitLayers = []
  var hitPoints = []
  this.scene.forEach(function(drawable, i) {
    if (drawable instanceof Layer && i > 0) {
      if (drawable.enabled == false) return;
      drawable.selected = false;
      var hits = ray.hitTestPlane(drawable.position, this.up)
      var bbox = BoundingBox.fromPoints( drawable.planeMesh.geometry.vertices )

      var plane = new Plane(drawable.position, this.up)
      if (hits.length > 0) {
        var hit = hits[0];
        var hit2d = plane.rebase(plane.project(hit));
        //1. bbox to corners

        var corners = [
          new Vec3(bbox.min.x, bbox.max.y, bbox.min.z),
          new Vec3(bbox.max.x, bbox.max.y, bbox.min.z),
          new Vec3(bbox.max.x, bbox.max.y, bbox.max.z),
          new Vec3(bbox.min.x, bbox.max.y, bbox.max.z)
        ]
        var corners = corners.map(function(v) {
          return v.dup().transformMat4(drawable.planeMesh.modelWorldMatrix);
        });

        //2. project corners on the plane
        //3. convert points to 2d
        var corners2d = corners.map(plane.project.bind(plane)).map(plane.rebase.bind(plane));

        //4. build two triangles from corner points
        var triangle1 = new Triangle2D(corners2d[0], corners2d[1], corners2d[2])
        var triangle2 = new Triangle2D(corners2d[0], corners2d[2], corners2d[3])

        //5. check if hit point belong to any of the tirangles
        if (triangle1.contains(hit2d) || triangle2.contains(hit2d)) {
          hitLayers.push(drawable);
        }
      }
    }
  }.bind(this));

  if (hitLayers.length > 0) {
    hitLayers.sort(function(a, b) {
      return -(a.position.y - b.position.y);
    });
    this.selectedLayer = hitLayers[0];
    this.selectedLayer.selected = true;
  }
  else {
    this.selectedLayer = null;
  }
}

module.exports = LayersController;