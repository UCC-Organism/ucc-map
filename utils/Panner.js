var geom = require('pex-geom');
var Vec2 = geom.Vec2;
var Vec3 = geom.Vec3;

function Panner(window, camera, distance) {
  this.window = window;
  this.camera = camera;
  this.enabled = true;
  this.allowZooming = true;
  this.distance = distance || 2;;
  this.minDistance = distance*0.025 || 0.025;;
  this.maxDistance = distance*2 || 5;;
  this.dragCenter = new Vec3();
  this.dragStart = new Vec3();
  this.dragDelta = new Vec3();
  this.dragStartCameraUp = new Vec3();
  this.dragStartCameraRight = new Vec3();
  this.up = null;
  this.rotation = 0;
  this.dragRotationBaseAngle = 0;
  this.dragRotationInit = false;
  this.dragging = false;

  this.addEventHanlders();
}

Panner.prototype.addEventHanlders = function() {
  this.window.on('leftMouseDown', function(e) {
    if (e.handled || !this.enabled) return;
    this.dragging = true;
    this.down(e.x, this.window.height - e.y, e); //we flip the y coord to make rotating camera work
  }.bind(this));

  this.window.on('mouseDragged', function(e) {
    if (e.handled || !this.enabled || !this.dragging) return;
    this.drag(e.x, this.window.height - e.y, e); //we flip the y coord to make rotating camera work
  }.bind(this));

  this.window.on('leftMouseUp', function(e) {
    this.dragging = false;
  }.bind(this));

  this.window.on('scrollWheel', function(e) {
    if (e.handled || !this.enabled || !this.allowZooming) return;
    this.distance = Math.min(this.maxDistance, Math.max(this.distance + e.dy/1000*(this.maxDistance-this.minDistance), this.minDistance));
    this.updateCamera();
  }.bind(this));
}

Panner.prototype.down = function(x, y, e) {
  this.dragCenter.setVec3(this.camera.getTarget());
  var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
  this.up = Vec3.create().asSub(this.camera.getPosition(), this.camera.getTarget()).normalize();
  var hits = ray.hitTestPlane(this.dragCenter, this.up);
  this.dragStart.setVec3(hits[0]);
  this.dragDelta.asSub(hits[0], this.dragCenter);
  this.dragRotationInit = false;
  this.dragStartCameraUp.setVec3(this.camera.getUp());
  this.dragStartCameraRight.asCross(this.dragStartCameraUp, this.up); // up x forward
  this.updateCamera();
}

Panner.prototype.drag = function(x, y, e) {
  var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
  var hits = ray.hitTestPlane(this.dragCenter, this.up);
  if (!e.shift && !e.option) {
    var diff = Vec3.create().asSub(this.dragStart, hits[0]);
    this.camera.getTarget().setVec3(this.dragCenter).add(diff);
    this.updateCamera();
    //update drag center because this.camera world ray influences hit test
    this.dragCenter.setVec3(this.camera.getTarget());
  }
  if (e.option) {
    this.dragDelta.asSub(hits[0], this.camera.getTarget());
    var radians = Math.atan2(-(y - this.window.height/2), x - this.window.width/2);
    var angle = Math.floor(radians*180/Math.PI);
    if (!this.dragRotationInit) {
      this.dragRotationInit = true;
      this.dragRotationBaseAngle = angle;//rotateAngleBase;
    }
    var dragRotationDiffAngle = angle - this.dragRotationBaseAngle;
    this.rotation = dragRotationDiffAngle;
    this.rotation = (this.rotation + 360 + 90) % 360;
    this.updateCameraRotation();
  }
}

Panner.prototype.updateCamera = function() {
  if (!this.up) {
    this.up = Vec3.create().asSub(this.camera.getPosition(), this.camera.getTarget()).normalize();
  }

  this.camera.getPosition().setVec3(this.up).scale(this.distance).add(this.camera.getTarget());
  this.camera.updateMatrices();
}

Panner.prototype.updateCameraRotation = function() {
  var u = Math.cos((this.rotation)/ 180 * Math.PI);
  var v = Math.sin((this.rotation)/ 180 * Math.PI);
  if (!this.dragStartCameraRight || this.dragStartCameraRight.length() == 0) {
    this.dragStartCameraRight.set(0, 1, 0);
    this.dragStartCameraUp.set(0, 0, -1);
  }
  console.log(this.dragStartCameraRight.toString() + ' ' + this.dragStartCameraUp.toString());
  var newUp = new Vec3(
    this.dragStartCameraRight.x * u + this.dragStartCameraUp.x * v,
    this.dragStartCameraRight.y * u + this.dragStartCameraUp.y * v,
    this.dragStartCameraRight.z * u + this.dragStartCameraUp.z * v
  ).normalize();

  console.log(newUp);

  this.camera.setUp(newUp);
}


module.exports = Panner;