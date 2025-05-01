/**
 * pathfinding.js - A* Pathfinding algorithm implementation
 */

// Main pathfinding function using A* algorithm
function findPath(sourceNode, destinationNode, userPreferences = {}) {
  console.log("Finding path from", sourceNode, "to", destinationNode, "with preferences:", userPreferences);
  
  // Ensure we have default preferences
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
  
  // Initialize scores for all nodes
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
    
    // If we've reached the destination, reconstruct the path
    if (current === destinationNode) {
      console.log("Path found! Reconstructing...");
      return reconstructPath(cameFrom, current);
    }
    
    // Mark this node as processed
    closedSet.add(getNodeKey(current));
    
    // Process each connection from the current node
    for (const connection of current.connections || []) {
      let neighbor;
      let weight;
      let isAvoidedType = false;
      
      // Handle cross-layer connections
      if (connection.layer !== undefined) {
        // This is a layer change connection
        neighbor = nodeGraph[connection.layer][connection.id];
        
        // FIX: Check connection flags properly
        // Check if the connection is stairs or elevator
        const isStairs = connection.flags && connection.flags.includes("stairs");
        const isElevator = connection.flags && connection.flags.includes("elevator");
        
        // FIX: Apply preference penalties more effectively
        if ((isStairs && preferences.avoidStairs) ||
            (isElevator && preferences.avoidElevators)) {
          weight = 2000; // Much higher penalty for avoided types
          isAvoidedType = true;
          console.log(`Applying high penalty for ${isStairs ? 'stairs' : 'elevator'}`);
        } else {
          weight = 10; // Normal layer change cost
        }
      } else {
        // Normal connection within the same layer
        neighbor = nodeGraph[current.layer][connection.id];
        weight = connection.distance || 1;
      }
      
      // Skip if neighbor is null or already in closed set
      if (!neighbor || closedSet.has(getNodeKey(neighbor))) {
        continue;
      }
      
      // Skip nodes with endpoint constraint (except the destination)
      if (neighbor !== destinationNode && 
          neighbor.constraints && 
          neighbor.constraints.includes("endpoint")) {
        continue;
      }
      
      // FIX: Enhanced checking of node types to respect preferences
      if (neighbor !== destinationNode) {
        // Apply penalties for node types being avoided
        if ((neighbor.type === "stairs" && preferences.avoidStairs) ||
            (neighbor.type === "elevator" && preferences.avoidElevators)) {
          weight += 1000; // Additional penalty for avoided node types
          isAvoidedType = true;
          console.log(`Applying node type penalty for ${neighbor.type}`);
        }
      }
      
      // Calculate tentative g score
      const tentativeGScore = gScore.get(getNodeKey(current)) + weight;
      
      // If this path is better than previous ones
      if (tentativeGScore < gScore.get(getNodeKey(neighbor))) {
        // Record the path
        cameFrom.set(getNodeKey(neighbor), current);
        gScore.set(getNodeKey(neighbor), tentativeGScore);
        
        // Calculate f score: g + h
        const neighborFScore = tentativeGScore + heuristic(neighbor, destinationNode);
        fScore.set(getNodeKey(neighbor), neighborFScore);
        
        // Add to open set if not already there
        if (!openSet.contains(neighbor)) {
          openSet.enqueue(neighbor, neighborFScore);
          
          // Debug log for avoided types
          if (isAvoidedType) {
            console.log(`Added avoided type node to open set with high penalty: ${neighbor.type || 'regular'}, fscore: ${neighborFScore}`);
          }
        }
      }
    }
  }
  
  console.log("No path found between nodes");
  return null;
}

// Improved heuristic function with better layer change costs
function heuristic(nodeA, nodeB) {
  // Calculate straight-line distance
  const dx = nodeA.x - nodeB.x;
  const dy = nodeA.y - nodeB.y;
  let distance = Math.sqrt(dx*dx + dy*dy);
  
  // Add penalty for layer changes
  if (nodeA.layer !== nodeB.layer) {
    distance += 100; // Base layer change penalty
    
    // In a real building, floors that are further apart take longer to navigate
    // For instance, going from floor 1 to floor 5 takes longer than floor 1 to floor 2
    // Try to estimate this if the layer names are formatted as "floor1", "floor2", etc.
    if (nodeA.layer.startsWith("floor") && nodeB.layer.startsWith("floor")) {
      try {
        const floorA = parseInt(nodeA.layer.substring(5));
        const floorB = parseInt(nodeB.layer.substring(5));
        if (!isNaN(floorA) && !isNaN(floorB)) {
          const floorDifference = Math.abs(floorA - floorB);
          distance += floorDifference * 50; // Additional penalty per floor difference
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
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

// Draw the path on the canvas with clickable transition points
function drawPath(path) {
  if (!path || path.includes(null)) return;
  
  // Clear any previous path transitions
  window.pathLayerTransitions = [];
  
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
  
  // Find layer transitions within the current layer
  for (i = 0; i < path.length - 1; i++) {
    if (path[i].layer === view.layer && path[i+1].layer !== view.layer) {
      // This is an exit point to another layer
      drawPathMarker(path[i], path[i+1].layer);
      
      // Draw text indicating direction and add clickable indicator
      const [x, y] = nodeToCanvasPos(path[i]);
      
      // Layer change text
      ctx.fillStyle = "#333";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      
      // Format display name
      let displayName = path[i+1].layer;
      if (displayName === "outside") {
        displayName = "Outside";
      } else if (displayName.startsWith("floor")) {
        displayName = "Floor " + displayName.substring(5);
      }
      
      ctx.fillText(`→ ${displayName}`, x, y - 15);
      
      // Add a clickable area for this transition point
      if (!window.pathLayerTransitions) {
        window.pathLayerTransitions = [];
      }
      
      window.pathLayerTransitions.push({
        x: x,
        y: y,
        radius: 15,
        fromNode: path[i],
        toNode: path[i+1],
        toLayer: path[i+1].layer
      });
    }
  }
  
  // Last node in current layer
  i = path.map(x => x.layer).lastIndexOf(view.layer);
  if (i !== -1 && i < path.length - 1) {
    drawPathMarker(path[i], "exit");
  } else if (i === path.length - 1) {
    drawPathMarker(path[i], "end");
  }
}

function handlePathTransitionClick(event) {
  if (!window.pathLayerTransitions || window.pathLayerTransitions.length === 0) {
    return false;
  }
  
  const mouseX = event.pageX;
  const mouseY = event.pageY;
  
  // Check if click is on a path transition point
  for (let i = 0; i < window.pathLayerTransitions.length; i++) {
    const transition = window.pathLayerTransitions[i];
    const dx = mouseX - transition.x;
    const dy = mouseY - transition.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance <= transition.radius) {
      // Change to the target layer and center on destination node
      view.layer = transition.toLayer;
      view.x = -transition.toNode.x;
      view.y = -transition.toNode.y;
      
      // Update the layer dropdown
      const layerSelect = document.getElementById("layerSelect");
      if (layerSelect) {
        layerSelect.value = transition.toLayer;
      }
      
      // Update the display
      redraw();
      return true;
    }
  }
  
  return false;
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