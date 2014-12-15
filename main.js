var glu = require('pex-glu');
var geom = require('pex-geom');
var color = require('pex-color');
var sys = require('pex-sys');
var gui = require('pex-gui');
var gen = require('pex-gen');
var materials = require('pex-materials');

var PerspectiveCamera = glu.PerspectiveCamera;
var OrthographicCamera = glu.OrthographicCamera;
var Arcball = glu.Arcball;
var Mesh = glu.Mesh;

var Vec3 = geom.Vec3;
var Plane = geom.Plane;
var Color = color.Color;
var GUI = gui.GUI;
var Window = sys.Window;
var Platform = sys.Platform;
var Cube = gen.Cube;
var SolidColor = materials.SolidColor;

var Layer = require('./ucc/Layer');
var LayersController = require('./ucc/LayersController');
var NodeEditor = require('./ucc/NodeEditor');
var Panner = require('./utils/Panner');

Window.create({
  settings: {
    width: 1280*2,
    height: 720*2,
    fullscreen: Platform.isBrowser,
    highdpi: 2
  },
  layerDistance: 0.1,
  xray: false,
  focusLayerId: 0,
  enableLayerEditing: false,
  showPlans: true,
  selectedRoomId: 'N/A',
  selectedRoomType: 'N/A',
  selectedRoom: null,
  init: function() {
    //has to be here to capture events before others
    this.gui = new GUI(this);
    this.camera = new PerspectiveCamera(60, this.width / this.height, 0.01, 100, new Vec3(0, 1, 0), new Vec3(0, 0, 0), new Vec3(0, 0, -1));
    geom.randomSeed(0);
    this.initLayers();
    this.initScene();
    this.initGUI();
    this.initKeyboard();
  },
  initLayers: function() {
    this.layerInfo = [
      {
        img: 'assets/satellite.jpg',
        level: -1,
        enabled: false,
        name: 'ALL',
        value: 0
      }, {
        img: 'assets/A0-plan.png',
        level: 0,
        enabled: true,
        name: 'A 0',
        value: 1
      }, {
        img: 'assets/A1-plan.png',
        level: 1,
        enabled: true,
        name: 'A 1',
        value: 2
      }, {
        img: 'assets/B0-plan.png',
        level: 0,
        enabled: true,
        name: 'B 0',
        value: 3
      }, {
        img: 'assets/B1-plan.png',
        level: 1,
        enabled: true,
        name: 'B 1',
        value: 4
      }, {
        img: 'assets/C0-plan.png',
        level: 0,
        enabled: true,
        name: 'C 0',
        value: 5
      }, {
        img: 'assets/C1-plan.png',
        level: 1,
        enabled: true,
        name: 'C 1',
        value: 6
      }, {
        img: 'assets/C2-plan.png',
        level: 2,
        enabled: true,
        name: 'C 2',
        value: 7
      }
    ];
  },
  initScene: function() {
    this.scene = [];

    this.layers = this.layerInfo.map(function(layerData, id) {
      var layer = new Layer(layerData.img, id);
      var layerYPos = layerData.level >= 0 ? layerData.level * this.layerDistance : 10;
      //layer.position = new Vec3(Math.random() * 0.5 - 0.25, -0.02 + layerYPos, Math.random() * 0.5 - 0.25);
      layer.rotationAngle = 0;
      layer.name = layerData.img;
      layer.level = layerData.level;
      layer.enabled = layerData.enabled;
      this.scene.push(layer);
      return layer;
    }.bind(this));

    this.layersController = new LayersController(this, this.scene, this.camera);
    this.layersController.enabled = true;

    this.nodeEditor = new NodeEditor(this, this.camera);
    this.nodeEditor.enabled = false;
    this.arcball = new Arcball(this, this.camera);
    this.arcball.enabled = true;
    this.panner = new Panner(this, this.camera);
    this.panner.enabled = false;
  },
  initGUI: function() {
    this.gui.addHeader('Keyboard');
    this.gui.addLabel('x - xray mode');
    this.gui.addHeader('Layers');
    this.gui.addParam('show plans', this, 'showPlans');
    this.gui.addRadioList('Focus on', this, 'focusLayerId', this.layerInfo, function(e) {
      this.onFocusLayerChange(e);
    }.bind(this));
    this.gui.addHeader('Panner');
    this.rotationParam = this.gui.addParam('Rotation', this.panner, 'rotation', { min: 0, max: 360 }, function(e) {
      this.panner.updateCameraRotation();
    }.bind(this));
    this.distanceParam = this.gui.addParam('Distance', this.panner, 'distance', { min: 0, max: 5 }, function(e) {
      this.panner.updateCamera();
    }.bind(this));
    this.gui.load('data/settings.json');
    this.onFocusLayerChange(this.focusLayerId);
    this.panner.updateCameraRotation();
    this.gui.addHeader('Selected Room').setPosition(2*180, 20);
    this.roomIdParam = this.gui.addParam('ID', this, 'selectedRoomId', {}, function(e) {
      if (this.selectedRoom) {
        this.selectedRoom.id = this.selectedRoomId;
      }
      else {
        this.selectedRoomId = 'N/A';
        this.selectedRoomType = 'N/A';
      }
    }.bind(this));
    var roomTypes = [
      { name: 'Other', value: ''},
      { name: 'Classroom', value: 'classroom'},
      { name: 'Toilet', value: 'toilet'},
      { name: 'Research', value: 'research'},
      { name: 'Admin', value: 'admin'},
      { name: 'Empty', value: 'empty'},
    ]
    this.roomIdParam = this.gui.addRadioList('Room type', this, 'selectedRoomType', roomTypes, function(e) {
      if (this.selectedRoom) {
        this.selectedRoom.type = this.selectedRoomType;;
      }
      else {
        this.selectedRoomId = 'N/A';
        this.selectedRoomType = 'N/A';
      }
    }.bind(this));

    this.on('keyDown', function(e) {
      switch (e.str) {
        case 'S':
          this.gui.save(__dirname + '/data/settings.json');
          break;
      }
    }.bind(this));
  },
  initKeyboard: function() {
    this.on('keyDown', function(e) {
      if (e.handled) return;
      switch (e.str) {
        case 'x':
          this.xray = !this.xray;
          this.layers.forEach(function(layer) {
            layer.planeMesh.material.uniforms.xray = this.xray;
          }.bind(this));
          break;
        case '0':
          this.scene.forEach(function(drawable) {
            drawable.enabled = drawable.level === 0;
          }.bind(this));
          this.onFocusLayerChange(0);
          break;
        case '1':
          this.scene.forEach(function(drawable) {
            drawable.enabled = drawable.level === 1;
          }.bind(this));
          this.onFocusLayerChange(1);
          break;
        case '2':
          this.scene.forEach(function(drawable) {
            drawable.enabled = drawable.level === 2;
          }.bind(this));
          this.onFocusLayerChange(2);
          break;
        case '3':
          this.scene.forEach(function(drawable) {
            drawable.enabled = true
          }.bind(this));
          break;
      }
    });
  },
  onFocusLayerChange: function(layerIndex) {
    for (var i=0; i<this.scene.length; i++) {
      var drawable = this.scene[i];
      drawable.enabled = (i === layerIndex) || (0 === layerIndex);
    }
    var selectedLayer = this.scene[layerIndex];
    var reorientCamera = this.arcball.enabled;
    this.arcball.enabled = layerIndex === 0;
    this.layersController.enabled = (layerIndex === 0) && this.enableLayerEditing;
    this.panner.enabled = layerIndex !== 0;
    this.nodeEditor.enabled = layerIndex !== 0;
    this.nodeEditor.setCurrentLayer(this.layers[layerIndex]);
    this.nodeEditor.onRoomSelected = function(room) {
      this.selectedRoom = room;
      if (room) {
        this.selectedRoomId = '' + room.id;
        this.selectedRoomType = room.type ? room.type : '';
      }
      else {
        this.selectedRoomId = 'N/A';
      }
    }.bind(this);
    this.camera.getTarget().setVec3(selectedLayer.position);
    if (reorientCamera) {
      this.camera.setUp(new Vec3(0, 0, 1));
      this.camera.position.set(selectedLayer.position.x, selectedLayer.position.y + 1, selectedLayer.position.z);
      this.camera.updateMatrices();
    }
    if (this.panner.enabled) {
      this.panner.updateCamera();
    }
    if (this.arcball.enabled) {
      this.arcball.updateCamera();
    }
    this.focusLayerId = layerIndex;
    this.gui.items[0].dirty = true;
  },
  draw: function() {
    for (var i=0; i<this.layers.length; i++) {
      var layer = this.layers[i];
      layer.showImage = layer.id === 0 || this.showPlans;
    }
    glu.enableDepthReadAndWrite(true, true).clearColorAndDepth(Color.Black);
    this.layers[0].enabled = !this.xray;
    if (this.xray) {
      this.layers[0].border.draw(this.camera);
    }
    glu.enableAlphaBlending(true, true);
    this.scene.forEach(function(item) {
      if (item.enabled) {
        item.draw(this.camera);
      }
    }.bind(this));
    this.rotationParam.setNormalizedValue(this.panner.rotation/360);
    this.rotationParam.dirty = true;

    glu.enableDepthReadAndWrite(false, false);
    this.nodeEditor.draw(this.camera);

    this.gui.draw();
  }
});
