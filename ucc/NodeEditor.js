var materials = require('pex-materials');
var geom = require('pex-geom');
var glu = require('pex-glu');
var gen = require('pex-gen');
var color = require('pex-color');
var sys = require('pex-sys');
var R = require('ramda');
var Platform = sys.Platform;
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
var Geometry = geom.Geometry;
var Triangle2D = geom.Triangle2D;
var TextLabel = require('../utils/TextLabel');
var Config = require('../Config');
var convertToClientFormat = require('./ClientFormatter');
var Platform = sys.Platform;

function prop(name) {
  return function(o) {
    return o[name];
  }
}

function centroid2D(points) {
  var n = points.length;
  var center = points.reduce(function(center, p) {
    return center.add(p);
  }, new Vec2(0, 0));
  center.scale(1 / points.length);
  return center;
}

function centroid3D(points) {
  var n = points.length;
  var center = points.reduce(function(center, p) {
    return center.add(p);
  }, new Vec3(0, 0));
  center.scale(1 / points.length);
  return center;
}

function forEachAndNextInLoop(list, cb) {
  for(var i=0; i<list.length; i++) {
    cb(list[i], list[(i+1)%list.length]);
  }
}

function NodesEditor(window, camera) {
  this.window = window;
  this.camera = camera;

  this.normalColor = new Color(1.0, 0.2, 0.0, 1.0);
  this.selectedColor = new Color(0.0, 0.7, 1.0, 1.0);
  this.roomColor = new Color(0.2, 0.2, 0.2, 0.3);
  this.roomColorByType = Config.roomTypes.reduce(function(o, roomType) {
    o[roomType.type] = roomType.color;
    o[roomType.type].a = Config.editorRoomAlpha;
    return o;
  }, {});
  this.selectedRoomColor = new Color(0.9, 0.1, 0.2, 0.3);
  this.currentLayer = null;
  this.enabled = false;
  this.nodes = [];
  this.connections = [];
  this.rooms = [];
  this.prevNode = null;
  this.prevNodes = [];

  this.lineBuilder = new LineBuilder();
  this.lineBuilder.addLine(new Vec3(0, 0, 0), new Vec3(0, 0, 0), this.normalColor);
  this.lineMesh = new Mesh(this.lineBuilder, new ShowColors(), { lines: true});
  this.roomsGeometry = new Geometry({ vertices: true, colors: true, faces: true });
  this.roomsMesh = new Mesh(this.roomsGeometry, new ShowColors());

  this.nodeRadius = 0.002;
  //var cube = new Cube(this.nodeRadius, 0.0005, this.nodeRadius)
  var cubeVertices = [
    new Vec3(-this.nodeRadius, 0.0005,-this.nodeRadius), new Vec3(-this.nodeRadius, 0.0005, this.nodeRadius),
    new Vec3(-this.nodeRadius, 0.0005, this.nodeRadius), new Vec3( this.nodeRadius, 0.0005, this.nodeRadius),
    new Vec3( this.nodeRadius, 0.0005, this.nodeRadius), new Vec3( this.nodeRadius, 0.0005,-this.nodeRadius),
    new Vec3( this.nodeRadius, 0.0005,-this.nodeRadius), new Vec3(-this.nodeRadius, 0.0005,-this.nodeRadius)
  ];
  var cube = new Geometry({ vertices: cubeVertices });
  this.wireCube = new Mesh(cube, new SolidColor({color:this.normalColor}), { lines: true });

  this.hoverNode = null;
  this.hoverRoom = null;
  this.textLabels = [];

  this.addEventHanlders();
  this.load('nodes.json');
}

NodesEditor.prototype.serialize = function() {
  var self = this;
  function serializeConnection(connection) {
    return [ self.nodes.indexOf(connection.a), self.nodes.indexOf(connection.b) ];
  }
  function serializeRoom(room) {
    return {
      id: room.id,
      type: room.type,
      nodes: room.nodes.map(function(node) {
        return self.nodes.indexOf(node);
      }).filter(function(i) {
        return i != -1; //kill zombie nodes
      })
    }
  }
  var data = {
   nodes: this.nodes,
   connections: this.connections.map(serializeConnection),
   rooms: this.rooms.map(serializeRoom)
  };
  return data;
}

NodesEditor.prototype.save = function(fileName) {
  var data = this.serialize();
  var url = Config.dataPath + '/' + (Platform.isPlask ? fileName : '../save.php?filename='+fileName);
  IO.saveTextFile(url, JSON.stringify(data, null, 2));
}

NodesEditor.prototype.saveClient = function(fileName) {
  var data = convertToClientFormat(this.serialize());
  var url = Config.dataPath + '/' + (Platform.isPlask ? fileName : '../save.php?filename='+fileName);
  IO.saveTextFile(url, JSON.stringify(data, null, 2));
}

NodesEditor.prototype.load = function(fileName) {
  var self = this;
  IO.loadTextFile(Config.dataPath + '/' + fileName, function(data) {
    data = JSON.parse(data)
    self.nodes = data.nodes.map(function(nodeData) {
      return {
        layerId: nodeData.layerId,
        position: new Vec3(nodeData.position.x, nodeData.position.y, nodeData.position.z),
        position2d: new Vec2(nodeData.position2d.x, nodeData.position2d.y)
      }
    });
    self.connections = data.connections.map(function(connectionData) {
      return {
        a: self.nodes[connectionData[0]],
        b: self.nodes[connectionData[1]]
      };
    });
    self.rooms = data.rooms.map(function(roomData) {
      return {
        id: roomData.id,
        type: roomData.type,
        nodes: roomData.nodes.map(function(nodeIndex) {
          return self.nodes[nodeIndex];
        })
      };
    });
    self.updateConnectionsMesh();
    self.updateRoomsMesh();
  });
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
      if (!e.shift) {
        selectedNodes.forEach(function(node) {
          if (node != this.hoverNode) node.selected = false;
        }.bind(this));
      }
      if (this.draggedNode) {
        this.draggedNode.selected = true;
      }
      var affectedRooms = this.rooms.filter(function(room) {
        return room.nodes.indexOf(this.draggedNode) != -1;
      }.bind(this))
      if (affectedRooms.length > 0) {
        this.updateRoomsMesh();
      }
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
    else if (this.hoverRoom) {
      this.rooms.filter(prop('selected')).forEach(function(room) {
        if (room != this.hoverRoom) room.selected = false;
      }.bind(this));
      selectedNodes.forEach(function(node) {
        if (node != this.hoverNode) node.selected = false;
      }.bind(this));
      this.hoverRoom.selected = !this.hoverRoom.selected;
      if (this.onRoomSelected) {
        this.onRoomSelected(this.hoverRoom.selected ? this.hoverRoom : null)
      }
      this.updateRoomsMesh();
    }
    else {
      this.rooms.filter(prop('selected')).forEach(function(room) {
        room.selected = false;
        if (this.onRoomSelected) {
          this.onRoomSelected(null)
        }
        this.updateRoomsMesh();
      }.bind(this));
      var forward = this.camera.getTarget().dup().sub(this.camera.getPosition()).normalize();
      this.layerPlane = new Plane(this.currentLayer.position, forward);
      var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
      var hits = ray.hitTestPlane(this.layerPlane.point, this.layerPlane.normal);
      var hit3d = hits[0];
      var hit2d = this.layerPlane.rebase(this.layerPlane.project(hit3d));
      var node = {
        layerId: this.currentLayer.id,
        position: hit3d,
        position2d: hit2d,
        color: Color.Green
      };
      this.nodes.push(node);

      if (this.prevNode && e.ctrl) {
        this.prevNode.selected = true;
        node.selected = true;
        this.connections.push({
          a: this.prevNode,
          b: node
        });
        this.updateConnectionsMesh();
      }
      this.prevNode = node;
      this.prevNodes.push(node);
    }

    if (!e.ctrl) {
      this.prevNode = null;
      this.prevNodes.length = 0;
    }
  }.bind(this));

  this.window.on('mouseMoved', function(e) {
    forward = this.camera.getTarget().dup().sub(this.camera.getPosition()).normalize()
    this.layerPlane = new Plane(this.currentLayer.position, forward);
    var ray = this.camera.getWorldRay(e.x, e.y, this.window.width, this.window.height);
    var hits = ray.hitTestPlane(this.layerPlane.point, this.layerPlane.normal);
    var hit3d = hits[0];
    this.hoverNode = null;
    this.nodes.forEach(function(node, i) {
      if (node.layerId != this.currentLayer.id) return;
      if (hit3d.distance(node.position) < this.nodeRadius) {
        this.hoverNode = node;
      }
    }.bind(this));
    var hit2d = this.layerPlane.rebase(this.layerPlane.project(hit3d));
    var triangle = new Triangle2D();
    var prevHoverRoom = this.hoverRoom;
    this.hoverRoom = false;
    this.rooms.forEach(function(room) {
      if (room.nodes[0].layerId != this.currentLayer.id) return;
      var points2d = room.nodes.map(prop('position2d'));
      var center = centroid2D(points2d);
      var hit = false;
      forEachAndNextInLoop(points2d, function(p, np) {
        triangle.a = p;
        triangle.b = np;
        triangle.c = center;
        if (triangle.contains(hit2d)) {
          hit = true;
        }
      });
      if (hit) {
        this.hoverRoom = room;
      }
    }.bind(this));
    if (this.hoverRoom != prevHoverRoom) {
      this.updateRoomsMesh();
    }
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
      this.updateRoomsMesh();
    }
  }.bind(this));

  this.window.on('keyDown', function(e) {
    if (!this.enabled) return;
    switch (e.str) {
      case 'S': this.save('nodes.json'); this.saveClient('nodes.client.json'); break;
      case 'L': this.load('nodes.json'); break;
      case 'j': this.joinNodes(true); break;
      case 'J': this.joinNodes(false); break;
      case 'c': this.closeLoop(true); break;
      case 'r': this.makeRoom(true); break;
      case 'R': this.makeRoom(false); break;
    }
    switch (e.keyCode) {
      case 117: this.deleteNodes(); break; //del
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

NodesEditor.prototype.closeLoop = function() {
  if (this.prevNodes.length > 2) {
    this.connections.push({
      a: this.prevNodes[0],
      b: this.prevNodes[this.prevNodes.length-1]
    })
    this.updateConnectionsMesh();
  }
}

NodesEditor.prototype.sortNodes = function(nodes) {
  var connections = [];
  for(var i=0; i<nodes.length; i++) {
    for(var j=i+1; j<nodes.length; j++) {
      var c = this.getConnection(nodes[i], nodes[j]);
      if (c) connections.push(c);
    }
  }

  if (connections.length == 0) return nodes;

  var watchdog = 0;
  var sortedNodes = [];
  var c = connections.shift();
  sortedNodes.push(c.a);
  while(connections.length > 0 && watchdog++ < 100) {
    var currNode = sortedNodes[sortedNodes.length-1];
    for(var i=0; i<connections.length; i++) {
      if (currNode == connections[i].a) {
        sortedNodes.push(connections[i].b);
        connections.splice(i, 1);
        break;
      }
      else if (currNode == connections[i].b) {
        sortedNodes.push(connections[i].a);
        connections.splice(i, 1);
        break;
      }
    }
  }
  return sortedNodes;
}

NodesEditor.prototype.makeRoom = function(connect) {
  var selectedNodes = this.nodes.filter(function(node) { return node.selected; });
  if (connect) {
    var sortedNodes = this.sortNodes(selectedNodes);
    this.rooms.push({
      id: 'undefined',
      nodes: sortedNodes
    });
  }
  else {
    var roomsToRemove = this.rooms.filter(function(room) {
      return room.nodes.indexOf(selectedNodes[0]) != -1;
    })
    roomsToRemove.forEach(function(room) {
      this.rooms.splice(this.rooms.indexOf(room), 1);
    }.bind(this));
  }
  this.updateRoomsMesh();
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

NodesEditor.prototype.updateRoomsMesh = function() {
  this.roomsGeometry.vertices.length = 0;
  this.roomsGeometry.faces.length = 0;
  this.roomsGeometry.colors.length = 0;

  var roomsOnThisLevel = this.rooms.filter(function(room) {
    if (!this.currentLayer || !this.isNodeVisible(room.nodes[0])) return false;
    return true;
  }.bind(this));

  roomsOnThisLevel.forEach(function(room) {
    var center = centroid3D(room.nodes.map(prop('position')));
    room.nodes.forEach(function(node, nodeIndex) {
      var nextNode = room.nodes[(nodeIndex + 1) % room.nodes.length];
      var i = this.roomsGeometry.vertices.length;
      var color = this.roomColor;
      if (this.roomColorByType[room.type]) {
        color = this.roomColorByType[room.type];
      }
      if (room.selected || room == this.hoverRoom) {
        color = this.selectedRoomColor;
      }
      this.roomsGeometry.faces.push([i, i+1, i+2]);
      this.roomsGeometry.vertices.push(node.position);
      this.roomsGeometry.vertices.push(nextNode.position);
      this.roomsGeometry.vertices.push(center);
      this.roomsGeometry.colors.push(color);
      this.roomsGeometry.colors.push(color);
      this.roomsGeometry.colors.push(color);
    }.bind(this));
  }.bind(this));
  this.roomsGeometry.vertices.dirty = true;
  this.roomsGeometry.faces.dirty = true;
  this.roomsGeometry.colors.dirty = true;

  this.textLabels.forEach(function(label, labelIndex) {
    if (labelIndex >= roomsOnThisLevel.length) {
      label.dispose();
    }
  }.bind(this));
  this.textLabels.length = roomsOnThisLevel.length;
  roomsOnThisLevel.forEach(function(room, roomIndex) {
    var p2d = this.camera.getScreenPos(room.nodes[0].position, this.window.width, this.window.height);
    var p3d = new Vec3(p2d.x, this.window.height - p2d.y, 0.0);
    if (!this.textLabels[roomIndex]) {
      this.textLabels[roomIndex] = new TextLabel(this.window, p3d, '' +room.id, 20);
    }
    this.textLabels[roomIndex].setText('' +room.id);
  }.bind(this));
}

NodesEditor.prototype.setCurrentLayer = function(layer) {
  this.currentLayer = layer;
  this.updateConnectionsMesh();
  this.updateRoomsMesh();
}

NodesEditor.prototype.isNodeVisible = function(node) {
  return node && this.currentLayer.id == 0 || node.layerId == this.currentLayer.id;
}

NodesEditor.prototype.draw = function(camera) {
  if (this.lineBuilder.vertices.length > 0) {
    this.lineMesh.draw(camera);
  }

  glu.enableAlphaBlending(true, true);
  this.roomsMesh.draw(camera);
  glu.enableBlending(false, false);

  this.wireCube.material.uniforms.color = this.normalColor;
  this.wireCube.drawInstances(camera, this.nodes.filter(function(node) { return !node.selected && this.isNodeVisible(node); }.bind(this) ));
  this.wireCube.material.uniforms.color = this.selectedColor;
  this.wireCube.drawInstances(camera, this.nodes.filter(function(node) { return node.selected && this.isNodeVisible(node); }.bind(this) ));
  if (this.hoverNode) this.wireCube.drawInstances(camera, [this.hoverNode]);
  //for node in this.nodes
  //  this.wireCube.position = node.position
  //  this.wireCube.draw(camera, this.nodes)

  var roomsOnThisLevel = this.rooms.filter(function(room) {
    if (!this.currentLayer || !this.isNodeVisible(room.nodes[0])) return false;
    return true;
  }.bind(this));

  this.textLabels.forEach(function(label, labelIndex) {
    var center = centroid3D(roomsOnThisLevel[labelIndex].nodes.map(prop('position')));
    var p2d = this.camera.getScreenPos(center, this.window.width, this.window.height);
    var p3d = new Vec3(p2d.x, this.window.height - p2d.y, 0.0);
    label.mesh.position = p3d;
    label.meshBg.position = p3d;
    label.draw();
  }.bind(this));
}


module.exports = NodesEditor;