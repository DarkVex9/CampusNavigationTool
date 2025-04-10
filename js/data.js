/**
 * data.js - Data structures and loading functionality
 */

// Global data structures
var nodeGraph = {};      // Each loaded layer is a property containing an array of all nodes
var namedNodes = {};     // Each loaded layer is a property containing an array of all named nodes
var loadedLayers = [];   // Array of layers loaded stored in string form
var layerData = {};      // Each loaded layer is a property containing metadata about the layer
var areas = {};          // Each loaded layer is a property containing an array of all areas
var currentPath;         // Stores currently drawn path if there is one
var polygonPoints = [];  // Points for polygon drawing
var isDrawingPolygon = false; // Flag for polygon drawing state

// Area types with colors and properties
const areaTypes = {
  classroom: { name: "Classroom", color: "#B3E5FC" },
  office: { name: "Office", color: "#C8E6C9" },
  elevator: { name: "Elevator", color: "#F8BBD0" },
  stairs: { name: "Stairs", color: "#FFE0B2" },
  hallway: { name: "Hallway", color: "#F5F5F5" },
  entrance: { name: "Entrance", color: "#BBDEFB" },
  restroom: { name: "Restroom", color: "#E1BEE7" }
};

// Node types with colors and icons
const nodeTypes = {
  regular: { name: "Regular", color: "#666666" },
  entrance: { name: "Entrance", color: "#BBDEFB" },
  elevator: { name: "Elevator", color: "#F8BBD0" },
  stairs: { name: "Stairs", color: "#FFE0B2" },
  restroom: { name: "Restroom", color: "#E1BEE7" }
};

// Find a node by name
function findByName(searchString) {
  if (!searchString) return null;
  searchString = searchString.trim().toLowerCase();
  
  // First try exact match
  for (let i = 0; i < loadedLayers.length; i++) {
    const layer = loadedLayers[i];
    if (!namedNodes[layer]) continue;
    
    for (let j = 0; j < namedNodes[layer].length; j++) {
      const namedNode = namedNodes[layer][j];
      if (!namedNode) continue;
      const node = nodeGraph[layer][namedNode.id];
      
      if (node && namedNode.name && namedNode.name.toLowerCase() === searchString) {
        return node;
      }
    }
  }
  
  // Then try contains match
  for (let i = 0; i < loadedLayers.length; i++) {
    const layer = loadedLayers[i];
    if (!namedNodes[layer]) continue;
    
    for (let j = 0; j < namedNodes[layer].length; j++) {
      const namedNode = namedNodes[layer][j];
      if (!namedNode) continue;
      const node = nodeGraph[layer][namedNode.id];
      
      if (node && namedNode.name && namedNode.name.toLowerCase().includes(searchString)) {
        return node;
      }
    }
  }
  
  return null; // No match found
}

// Find the nearest node to a point
function findNearestNode(x, y, layer = view.layer) {
  if (!nodeGraph[layer] || nodeGraph[layer].length === 0) {
    return null;
  }
  
  let bestNode;
  let bestDistance = Number.MAX_VALUE;
  
  for (let i = 0; i < nodeGraph[layer].length; i++) {
    if (!nodeGraph[layer][i]) {
      continue;
    }
    
    let node = nodeGraph[layer][i];
    let workingDistance = Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2);
    
    if (workingDistance < bestDistance) {
      bestNode = node;
      bestDistance = workingDistance;
    }
  }
  
  return bestNode;
}

// Add a layer to the layer select dropdown
function addLayerToSelect(layerName) {
  const option = document.createElement("option");
  option.value = layerName;
  
  // Format display name (e.g., "floor1" -> "Floor 1")
  let displayName = layerName;
  if (layerName === "outside") {
    displayName = "Outside";
  } else if (layerName.startsWith("floor")) {
    displayName = "Floor " + layerName.substring(5);
  }
  
  option.appendChild(document.createTextNode(displayName));
  document.getElementById("layerSelect").appendChild(option);
}

// Define a new area
function createArea(layer, name, type, points) {
  if (!areas[layer]) {
    areas[layer] = [];
  }
  
  // Generate new ID
  const id = areas[layer].length > 0 ?
    Math.max(...areas[layer].map(a => a.id)) + 1 : 1;
  
  const area = {
    id: id,
    name: name,
    type: type,
    points: points,
    layer: layer,
    nodes: []  // IDs of nodes associated with this area
  };
  
  areas[layer].push(area);
  return area;
}

// Associate a node with an area
function associateNodeWithArea(node, area) {
  if (!area.nodes) {
    area.nodes = [];
  }
  if (!area.nodes.includes(node.id)) {
    area.nodes.push(node.id);
  }
}

// Check if a point is inside a polygon
function isPointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Draw areas
function drawAreas() {
  if (!areas[view.layer]) return;
  
  for (const area of areas[view.layer]) {
    if (!area || !area.points || area.points.length < 3) continue;
    
    // Set fill color based on area type
    ctx.fillStyle = areaTypes[area.type]?.color || "#EEEEEE";
    ctx.globalAlpha = 0.8; // Semi-transparent
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    
    // Draw the polygon
    ctx.beginPath();
    ctx.moveTo(...posToCanvasPos(area.points[0].x, area.points[0].y));
    for (let i = 1; i < area.points.length; i++) {
      ctx.lineTo(...posToCanvasPos(area.points[i].x, area.points[i].y));
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1; // Reset alpha
    ctx.stroke();
    
    // Draw area name
    const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
    const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
    
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(area.name, ...posToCanvasPos(centerX, centerY));
    
    // Draw area icon if needed
    drawAreaIcon(area, centerX, centerY);
    
    // Highlight selected area
    if (editorSelectedArea && area.id === editorSelectedArea.id) {
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(...posToCanvasPos(area.points[0].x, area.points[0].y));
      for (let i = 1; i < area.points.length; i++) {
        ctx.lineTo(...posToCanvasPos(area.points[i].x, area.points[i].y));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// Draw area icon
function drawAreaIcon(area, centerX, centerY) {
  // Only draw icons for special types: elevator, stairs, entrance
  if (!["elevator", "stairs", "entrance"].includes(area.type)) return;
  
  const iconX = area.points[0].x + 10;
  const iconY = area.points[0].y + 10;
  const [canvasX, canvasY] = posToCanvasPos(iconX, iconY);
  
  // Create a small white circle background
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(canvasX, canvasY, 10, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw the icon
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  
  if (area.type === "elevator") {
    // Elevator icon
    ctx.beginPath();
    ctx.rect(canvasX - 6, canvasY - 6, 12, 12);
    ctx.moveTo(canvasX - 3, canvasY - 3);
    ctx.lineTo(canvasX + 3, canvasY - 3);
    ctx.moveTo(canvasX - 3, canvasY);
    ctx.lineTo(canvasX + 3, canvasY);
    ctx.moveTo(canvasX - 3, canvasY + 3);
    ctx.lineTo(canvasX + 3, canvasY + 3);
    ctx.stroke();
  } else if (area.type === "stairs") {
    // Stairs icon
    ctx.beginPath();
    ctx.moveTo(canvasX - 6, canvasY + 6);
    ctx.lineTo(canvasX - 6, canvasY + 2);
    ctx.lineTo(canvasX, canvasY + 2);
    ctx.lineTo(canvasX, canvasY - 2);
    ctx.lineTo(canvasX + 6, canvasY - 2);
    ctx.lineTo(canvasX + 6, canvasY - 6);
    ctx.stroke();
  } else if (area.type === "entrance") {
    // Entrance icon
    ctx.beginPath();
    ctx.moveTo(canvasX - 5, canvasY - 6);
    ctx.lineTo(canvasX + 5, canvasY - 6);
    ctx.lineTo(canvasX + 5, canvasY + 6);
    ctx.lineTo(canvasX - 5, canvasY + 6);
    ctx.closePath();
    ctx.moveTo(canvasX, canvasY - 6);
    ctx.lineTo(canvasX, canvasY + 6);
    ctx.stroke();
  }
}

// Example: Initialize with some test data if you like
function initializeTestData() {
  const layers = ['outside', 'floor1', 'floor2'];
  for (const layer of layers) {
    if (!loadedLayers.includes(layer)) {
      loadedLayers.push(layer);
      nodeGraph[layer] = [];
      namedNodes[layer] = [];
      areas[layer] = [];
      layerData[layer] = { 
        imgScale: 1, 
        mapImage: `${layer}.png` 
      };
    }
  }
}

