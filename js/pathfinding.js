/**
 * pathfinding.js - A* Pathfinding algorithm implementation
 */

// Main pathfinding function using A* algorithm
function findPath(sourceNode, destinationNode, userPreferences = {}) {
    console.log("Finding path from", sourceNode, "to", destinationNode, "with preferences:", userPreferences);
    
    const preferences = {
      avoidStairs: userPreferences.avoidStairs || false,
      avoidElevators: userPreferences.avoidElevators || false,
      ...userPreferences
    };
    
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    
    for (const layerName of loadedLayers) {
      if (!nodeGraph[layerName]) continue;
      for (const node of nodeGraph[layerName]) {
        if (node) {
          gScore.set(getNodeKey(node), Infinity);
          fScore.set(getNodeKey(node), Infinity);
        }
      }
    }
    
    gScore.set(getNodeKey(sourceNode), 0);
    fScore.set(getNodeKey(sourceNode), heuristic(sourceNode, destinationNode));
    openSet.enqueue(sourceNode, fScore.get(getNodeKey(sourceNode)));
    
    while (!openSet.isEmpty()) {
      const current = openSet.dequeue();
      if (current === destinationNode) {
        return reconstructPath(cameFrom, current);
      }
      closedSet.add(getNodeKey(current));
      
      for (const connection of current.connections || []) {
        let neighbor;
        let weight;
        if (connection.flags && connection.flags.includes("layerChange")) {
          neighbor = nodeGraph[connection.layer][connection.id];
          if ((connection.flags.includes("stairs") && preferences.avoidStairs) ||
              (connection.flags.includes("elevator") && preferences.avoidElevators)) {
            weight = 1000;
          } else {
            weight = 10;
          }
        } else {
          neighbor = nodeGraph[current.layer][connection.id];
          weight = connection.distance;
        }
        if (!neighbor || closedSet.has(getNodeKey(neighbor))) {
          continue;
        }
        const tentativeGScore = gScore.get(getNodeKey(current)) + weight;
        if (tentativeGScore < gScore.get(getNodeKey(neighbor))) {
          cameFrom.set(getNodeKey(neighbor), current);
          gScore.set(getNodeKey(neighbor), tentativeGScore);
          fScore.set(getNodeKey(neighbor), tentativeGScore + heuristic(neighbor, destinationNode));
          if (!openSet.contains(neighbor)) {
            openSet.enqueue(neighbor, fScore.get(getNodeKey(neighbor)));
          }
        }
      }
    }
    
    console.log("No path found between nodes");
    return null;
  }
  
  function heuristic(nodeA, nodeB) {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    let distance = Math.sqrt(dx*dx + dy*dy);
    if (nodeA.layer !== nodeB.layer) {
      distance += 100;
    }
    return distance;
  }
  
  function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    while (cameFrom.has(getNodeKey(current))) {
      current = cameFrom.get(getNodeKey(current));
      totalPath.unshift(current);
    }
    return totalPath;
  }
  
  // Draw the path on the canvas
  function drawPath(path) {
    if (!path || path.includes(null)) return;
    
    // Wide, semi-transparent path first
    ctx.strokeStyle = "rgba(255, 0, 0, 0.3)";
    ctx.lineWidth = pathWidth + 4;
    ctx.beginPath();
    let i = 0;
    while (i < path.length && i !== -1) {
      i = path.map(x => x.layer).indexOf(view.layer, i);
      if (i === -1) break;
      ctx.moveTo(...nodeToCanvasPos(path[i]));
      i++;
      while (i < path.length && path[i].layer === view.layer) {
        ctx.lineTo(...nodeToCanvasPos(path[i]));
        i++;
      }
    }
    ctx.stroke();
    
    // Main path
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = pathWidth;
    ctx.beginPath();
    i = 0;
    while (i < path.length && i !== -1) {
      i = path.map(x => x.layer).indexOf(view.layer, i);
      if (i === -1) break;
      ctx.moveTo(...nodeToCanvasPos(path[i]));
      i++;
      while (i < path.length && path[i].layer === view.layer) {
        ctx.lineTo(...nodeToCanvasPos(path[i]));
        i++;
      }
    }
    ctx.stroke();
    
    // Direction arrows
    i = 0;
    while (i < path.length - 1 && i !== -1) {
      i = path.map(x => x.layer).indexOf(view.layer, i);
      if (i === -1 || i >= path.length - 1) break;
      if (path[i+1].layer === view.layer) {
        drawDirectionArrow(path[i], path[i+1]);
      }
      i++;
    }
    
    // Start/end markers
    i = path.map(x => x.layer).indexOf(view.layer);
    if (i !== -1) {
      drawPathMarker(path[i], "start");
    }
    i = path.map(x => x.layer).lastIndexOf(view.layer);
    if (i !== -1 && i < path.length - 1) {
      drawPathMarker(path[i], "exit");
    } else if (i === path.length - 1) {
      drawPathMarker(path[i], "end");
    }
  }
  
  function drawDirectionArrow(fromNode, toNode) {
    const fromPos = nodeToCanvasPos(fromNode);
    const toPos = nodeToCanvasPos(toNode);
    const angle = Math.atan2(toPos[1] - fromPos[1], toPos[0] - fromPos[0]);
    const arrowLength = 12;
    
    const midX = (fromPos[0] + toPos[0]) / 2;
    const midY = (fromPos[1] + toPos[1]) / 2;
    
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-arrowLength / 2, 0);
    ctx.lineTo(arrowLength / 2, 0);
    ctx.lineTo(arrowLength / 2 - 4, -4);
    ctx.moveTo(arrowLength / 2, 0);
    ctx.lineTo(arrowLength / 2 - 4, 4);
    ctx.stroke();
    ctx.restore();
  }
  
  function drawPathMarker(node, type) {
    const [cx, cy] = nodeToCanvasPos(node);
    ctx.fillStyle = (type === "start") ? "#4ade80" : 
                    (type === "end") ? "#ef4444" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  