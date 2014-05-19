var materials = require('pex-materials');
var geom = require('pex-geom');
var glu = require('pex-glu');
var gen = require('pex-gen');
var color = require('pex-color');
var sys = require('pex-sys');

var ShowColors = materials.ShowColors;
var SolidColor = materials.SolidColor;
var Mesh = glu.Mesh;
var LineBuilder = gen.LineBuilder;
var Cube = gen.Cube;
var Color = color.Color;
var Vec2 = geom.Vec2;
var Vec3 = geom.Vec3;
var Plane = geom.Plane;
var IO = sys.IO;

function NodesEditor(window, camera) {
  this.window = window;
  this.camera = camera;

  this.normalColor = new Color(1.0, 0.2, 0.0, 1.0);
  this.selectedColor = new Color(0.0, 0.7, 1.0, 1.0);
  this.currentLayer = null;
  this.enabled = false;
  this.nodes = [];
  this.connections = [];
  this.rooms = [];

  this.lineBuilder = new LineBuilder();
  this.lineBuilder.addLine(new Vec3(0, 0, 0), new Vec3(0, 0, 0), this.normalColor);
  this.lineMesh = new Mesh(this.lineBuilder, new ShowColors(), { lines: true});

  this.nodeRadius = 0.003;
  var cube = new Cube(this.nodeRadius, 0.0005, this.nodeRadius)
  cube.computeEdges()
  this.wireCube = new Mesh(cube, new SolidColor({color:this.normalColor}), { lines: true });

  this.hoverNode = null;

  this.addEventHanlders();
  this.load('data/nodes.txt')
}

NodesEditor.prototype.save = function(fileName) {
  var data = {
   nodes: this.nodes,
   connections: this.connections.map(function(c) { return [this.nodes.indexOf(c.a), this.nodes.indexOf(c.b)]; }.bind(this))
  };
  IO.saveTextFile(fileName, JSON.stringify(data));
}

NodesEditor.prototype.load = function(fileName) {
  IO.loadTextFile(fileName, function(data) {
    data = JSON.parse(data)
    this.nodes = data.nodes.map(function(nodeData) {
      return {
        layerId: nodeData.layerId,
        position: new Vec3(nodeData.position.x, nodeData.position.y, nodeData.position.z),
        position2d: new Vec2(nodeData.position2d.x, nodeData.position2d.y)
      }
    });
    this.connections = data.connections.map(function(connectionData) {
      return {
        a: this.nodes[connectionData[0]],
        b: this.nodes[connectionData[1]]
      };
    }.bind(this));
    this.updateConnectionsMesh()
  }.bind(this));
}

NodesEditor.prototype.addEventHanlders = function() {
  this.window.on('leftMouseDown', function(e) {
    if (e.handled || !this.enabled) return;
    this.cancelNextClick = false;
    this.draggedNode = this.hoverNode;
  }.bind(this));

  this.window.on('leftMouseUp', function(e) {
    if (e.handled || !this.enabled) return;
    selectedNodes = this.nodes.filter(function(node) { return node.selected; });
    if (this.cancelNextClick) {
      if (!e.shift)
        selectedNodes.forEach(function(node) {
          if (node != this.hoverNode) node.selected = false;
        }.bind(this));
      if (this.draggedNode) this.draggedNode.selected = true;
      this.draggedNode = null;
      return;
    }
    if (this.hoverNode) {
      if (!e.shift) {
        selectedNodes.forEach(function(node) {
          if (node != this.hoverNode) node.selected = false;
        }.bind(this));
      }
      this.hoverNode.selected = !this.hoverNode.selected;
      e.handled = true;
      this.cancelNextClick = true;
      this.draggedNode = null;
    }
    else {
      var forward = this.camera.getTarget().dup().sub(this.camera.getPosition()).normalize();
      this.layerPlane = new Plane(this.currentLayer.position, forward);
      var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
      var hits = ray.hitTestPlane(this.layerPlane.point, this.layerPlane.normal);
      var hit3d = hits[0];
      var hit2d = this.layerPlane.rebase(this.layerPlane.project(hit3d));
      this.nodes.push({
        layerId: this.currentLayer.id,
        position: hit3d,
        position2d: hit2d,
        color: Color.Green
      })
    }
  }.bind(this));

  this.window.on('mouseMoved', function(e) {
    forward = this.camera.getTarget().dup().sub(this.camera.getPosition()).normalize()
    this.layerPlane = new Plane(this.currentLayer.position, forward);
    ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
    hits = ray.hitTestPlane(this.layerPlane.point, this.layerPlane.normal);
    hit3d = hits[0];
    this.hoverNode = null;
    this.nodes.forEach(function(node, i) {
      if (node.layerId != this.currentLayer.id) return;
      if (hit3d.distance(node.position) < this.nodeRadius) {
        this.hoverNode = node;
      }
    }.bind(this));
  }.bind(this));

  this.window.on('mouseDragged', function(e) {
    this.cancelNextClick = true
    if (e.handled || !this.enabled) return;
    if (this.draggedNode) {
      var forward = this.camera.getTarget().dup().sub(this.camera.getPosition()).normalize();
      this.layerPlane = new Plane(this.currentLayer.position, forward);
      var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
      var hits = ray.hitTestPlane(this.layerPlane.point, this.layerPlane.normal);
      var hit3d = hits[0];
      this.draggedNode.position = hit3d;
      e.handled = true;
      this.updateConnectionsMesh();
    }
  }.bind(this));

  this.window.on('keyDown', function(e) {
    if (!this.enabled) return;
    switch (e.str) {
      case 'S': this.save('data/nodes.txt'); break;
      case 'L': this.load('data/nodes.txt'); break;
      case 'j': this.joinNodes(true); break;
      case 'J': this.joinNodes(false); break;
    }
    switch (e.keyCode) {
      case 51: this.deleteNodes(); break;
    }
  }.bind(this));
}

NodesEditor.prototype.deleteNodes = function() {
  var selectedNodes = this.nodes.filter(function(node) { return node.selected; });
  selectedNodes.forEach(function(node) {
    var nodeIndex = this.nodes.indexOf(node)
    var nodeConnections = this.connections.filter(function(c) { return c.a == node || c.b == node; });
    nodeConnections.forEach(function(connection) {
      var connectionIndex = this.connections.indexOf(connection);
      this.connections.splice(connectionIndex, 1);
    }.bind(this));
    this.nodes.splice(nodeIndex, 1);
  }.bind(this));
  this.hoverNode = null;
  this.draggedNode = null;
  this.updateConnectionsMesh();
}

NodesEditor.prototype.getConnection = function(a, b) {
  var connection = this.connections.filter(function(conn) {
    return (conn.a == a && conn.b == b) || (conn.a == b && conn.b == a);
  });

  if (connection.length > 0) return connection[0];
  else null;
}

NodesEditor.prototype.joinNodes = function(connect) {
  var selectedNodes = this.nodes.filter(function(node) { return node.selected; });
  if (selectedNodes.length == 2) {
    var existingConnection = this.getConnection(selectedNodes[0], selectedNodes[1]);
    if (connect) {
      if (!existingConnection) {
        this.connections.push({
          a: selectedNodes[0],
          b: selectedNodes[1]
        })
        selectedNodes[0].selected = false
        selectedNodes[1].selected = false
        this.updateConnectionsMesh()
      }
    }
    else if (existingConnection) {
      this.connections.splice(this.connections.indexOf(existingConnection), 1)
      this.updateConnectionsMesh();
    }
  }
}

NodesEditor.prototype.updateConnectionsMesh = function() {
  this.lineBuilder.reset();
  var currentLayerConnections = this.connections.filter(function(connection) {
    return this.currentLayer && this.isNodeVisible(connection.a) && this.isNodeVisible(connection.b);
  }.bind(this));
  currentLayerConnections.forEach(function(connection) {
    this.lineBuilder.addLine(connection.a.position, connection.b.position, this.normalColor);
  }.bind(this));
}

NodesEditor.prototype.setCurrentLayer = function(layer) {
  this.currentLayer = layer;
  this.updateConnectionsMesh();
}

NodesEditor.prototype.isNodeVisible = function(node) {
  return this.currentLayer.id == 0 || node.layerId == this.currentLayer.id;
}

NodesEditor.prototype.draw = function(camera) {
  if (this.lineBuilder.vertices.length > 0) {
    this.lineMesh.draw(camera);
  }

  this.wireCube.material.uniforms.color = this.normalColor;
  this.wireCube.drawInstances(camera, this.nodes.filter(function(node) { return !node.selected && this.isNodeVisible(node); }.bind(this) ));
  this.wireCube.material.uniforms.color = this.selectedColor;
  this.wireCube.drawInstances(camera, this.nodes.filter(function(node) { return node.selected && this.isNodeVisible(node); }.bind(this) ));
  if (this.hoverNode) this.wireCube.drawInstances(camera, [this.hoverNode]);
  //for node in this.nodes
  //  this.wireCube.position = node.position
  //  this.wireCube.draw(camera, this.nodes)
}


module.exports = NodesEditor;