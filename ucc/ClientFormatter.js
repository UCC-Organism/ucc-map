  function convertToClientFormat(nodesData) {
  var nextRoomId = 1;

  function logVec3(v) {
    return "{ " + Math.floor(v.x*1000)/1000 + ", " + Math.floor(v.y*1000)/1000 + ", " + Math.floor(v.z*1000)/1000 + " }";
  }

  var nodes = nodesData.nodes.map(function(node) {
    var data = {
      floor: node.layerId,
      room: '',
      //rotate not '90, for easier 3D -> 2D handling
      position: { x: node.position.x, y: node.position.z, z: node.position.y },
      neighbors: []
    }
    if (node.displacePoint) {
      data.displacePoint = node.displacePoint;
      data.displaceRadius = node.displaceRadius;
      data.displaceStrength = node.displaceStrength;
    }
    return data;
  });

  nodesData.connections.forEach(function(edge) {
    if (!nodes[edge[0]]) {
      console.log('Invalid edge', edge);
      return;
    }
    if (!nodes[edge[1]]) {
      console.log('Invalid edge', edge);
      return;
    }
    nodes[edge[0]].neighbors.push(edge[1]);
    nodes[edge[1]].neighbors.push(edge[0]);
  });

  nodesData.rooms.forEach(function(room) {
    var roomId = room.id

    if (room.id === 'undefined') {
      roomId = 'room_' + nextRoomId++;
      room.id = roomId;
      console.log('Room without id, generating new one', roomId);
    }

    room.nodes.forEach(function(nodeIndex) {
      nodes[nodeIndex].room = roomId;
    })
  });

  //remove free floating nodes

  var nodesToRemove = nodes.filter(function(node) {
    if (node.neighbors.length == 0 && !node.displacePoint) {
      console.log('Invalid node', 'floor:' + node.floor, 'position:' + logVec3(node.position));
      return true;
    }
    return false;
  });

  nodesToRemove.forEach(function(nodeToRemove) {
    var removedNodeIndex = nodes.indexOf(nodeToRemove);
    nodes.forEach(function(node) {
      node.neighbors = node.neighbors.map(function(i) {
        if (i > removedNodeIndex) return --i;
        else return i;
      })
    })
    nodes.splice(removedNodeIndex, 1);
  })

  nodes.forEach(function(node, nodeIndex) {
    node.id = nodeIndex;
  })

  var rooms = nodesData.rooms.map(function(room) {
    return {
      id: room.id,
      type: room.type
    }
  })

  var outData = {
    nodes: nodes,
    rooms: rooms
  }

  return outData;
}

module.exports = convertToClientFormat;