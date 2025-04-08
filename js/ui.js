/**
 * ui.js - Updated to match enhanced-navigation-ui.tsx functionality
 */

// DOM References
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const originField = document.getElementById("origin");
const destinationField = document.getElementById("destination");
const editorContainer = document.getElementById("editorTools");
const editorModeLabel = document.getElementById("editorMode");
const nodePanel = document.getElementById("nodePanel");
const layerSelect = document.getElementById("layerSelect");
const avoidStairsCheckbox = document.getElementById("avoidStairs");
const avoidElevatorsCheckbox = document.getElementById("avoidElevators");
const toggleEditorButton = document.getElementById("toggleEditor");
const areaTypeContainer = document.getElementById("areaTypeContainer");
const instructionPanel = document.getElementById("instructionPanel");

// View State
const view = {
  x: 0,
  y: 0,
  zoom: 1,
  layer: "outside",
  renderedLayer: ""
};

// UI States
let isDragging = false;
let drawNodes = false;
let tempConnectingNode;
let tempIsHintDrawn = false;
let isDrawingPolygon = false;
let polygonPoints = [];

// Area color mapping
const areaTypes = {
  classroom: { name: "Classroom", color: "#B3E5FC" },
  office: { name: "Office", color: "#C8E6C9" },
  elevator: { name: "Elevator", color: "#F8BBD0" },
  stairs: { name: "Stairs", color: "#FFE0B2" },
  hallway: { name: "Hallway", color: "#F5F5F5" },
  entrance: { name: "Entrance", color: "#BBDEFB" },
  restroom: { name: "Restroom", color: "#E1BEE7" }
};

// Editor styles
const editorStyle = {
  connectionHighlightColor: "#42F5C2",
  connectionHighlightWidth: 2,
  hintColor: "#42C2F5"
};

// Path drawing styles
const pathColor = "#ff3b30";
const pathWidth = 3;

// Initialize UI
function initUI() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  document.getElementById("go_button").addEventListener("click", handleSearch);
  document.addEventListener("keydown", handleKeyPress);
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("wheel", handleScroll);

  if (layerSelect) {
    layerSelect.addEventListener("change", handleLayerChange);
  }

  // Initialize toggle editor button
  if (toggleEditorButton) {
    toggleEditorButton.addEventListener("click", function() {
      const isVisible = editorContainer.style.display !== "none";
      editorContainer.style.display = isVisible ? "none" : "block";
      toggleEditorButton.textContent = isVisible ? "Show Editor Tools" : "Hide Editor Tools";
    });
  }

  // Setup editor mode buttons
  const editorButtons = document.querySelectorAll(".editor-buttons button");
  editorButtons.forEach(button => {
    button.addEventListener("click", function() {
      const mode = this.getAttribute("data-mode");
      setEditorMode(mode);
      
      // Highlight active button
      editorButtons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");
      
      // Show area type selector only for polygon mode
      areaTypeContainer.style.display = mode === "polygon" ? "block" : "none";
    });
  });

  // Setup node panel close button
  const closeNodePanelBtn = document.getElementById("closeNodePanel");
  if (closeNodePanelBtn) {
    closeNodePanelBtn.addEventListener("click", function() {
      nodePanel.style.display = "none";
    });
  }

  // Setup node save button
  const saveNodeDataBtn = document.getElementById("saveNodeData");
  if (saveNodeDataBtn) {
    saveNodeDataBtn.addEventListener("click", function() {
      saveNodeData();
    });
  }

  // Init zoom controls
  document.getElementById("zoomIn").addEventListener("click", function() {
    view.zoom = Math.min(view.zoom * 1.2, 5);
    redraw();
  });
  
  document.getElementById("zoomOut").addEventListener("click", function() {
    view.zoom = Math.max(view.zoom / 1.2, 0.2);
    redraw();
  });

  initNodePanel();

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  });

  populateSuggestions();
}

// Set editor mode function
function setEditorMode(mode) {
  console.log("Setting editor mode to:", mode);
  editorMode = mode;
  editorModeLabel.innerText = "Editor Mode: " + (mode.charAt(0).toUpperCase() + mode.slice(1));
  
  // Show/hide area type selector
  if (areaTypeContainer) {
    areaTypeContainer.style.display = mode === "polygon" ? "block" : "none";
  }
  
  // Reset drawing state if needed
  if (mode !== "polygon") {
    isDrawingPolygon = false;
    polygonPoints = [];
  } else {
    isDrawingPolygon = true;
  }
  
  // Hide node panel when switching modes (except in edit mode)
  if (mode !== "edit") {
    nodePanel.style.display = "none";
  }
  
  // Clear selection if switching to a non-selection mode
  if (mode !== "edit" && mode !== "move" && mode !== "connect") {
    editorSelectedNode = null;
  }
  
  redraw();
}

// Populate datalist suggestions for origin/destination
function populateSuggestions() {
  const suggestions = new Set();

  for (const layer of loadedLayers) {
    if (!namedNodes[layer]) continue;
    namedNodes[layer].forEach(node => {
      if (node && node.name) suggestions.add(node.name);
    });
  }

  // Add room names from areas
  for (const layer of loadedLayers) {
    if (!areas[layer]) continue;
    areas[layer].forEach(area => {
      if (area && area.name) suggestions.add(area.name);
    });
  }

  const originList = document.getElementById("originSuggestions");
  const destList = document.getElementById("destinationSuggestions");

  originList.innerHTML = "";
  destList.innerHTML = "";

  suggestions.forEach(name => {
    const opt1 = document.createElement("option");
    opt1.value = name;
    originList.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = name;
    destList.appendChild(opt2);
  });
}

// Handle layer dropdown change
function handleLayerChange() {
  view.layer = layerSelect.value;
  // Clear active path when changing layers
  currentPath = null;
  hideInstructions();
  redraw();
}

// Collect user preferences
function getUserPreferences() {
  return {
    avoidStairs: avoidStairsCheckbox?.checked || false,
    avoidElevators: avoidElevatorsCheckbox?.checked || false
  };
}

// Handle search button click
function handleSearch() {
  const origin = originField.value.trim();
  const destination = destinationField.value.trim();
  
  if (!origin || !destination) {
    alert("Please enter both origin and destination.");
    return;
  }
  
  // Find nodes by name or find nodes in areas with that name
  let startNode = findByName(origin);
  let endNode = findByName(destination);
  
  // If not found directly, try to find by area
  if (!startNode) {
    const startArea = findAreaByName(origin);
    if (startArea && startArea.nodes && startArea.nodes.length > 0) {
      startNode = nodeGraph[startArea.layer][startArea.nodes[0]];
    }
  }
  
  if (!endNode) {
    const endArea = findAreaByName(destination);
    if (endArea && endArea.nodes && endArea.nodes.length > 0) {
      endNode = nodeGraph[endArea.layer][endArea.nodes[0]];
    }
  }

  if (!startNode || !endNode) {
    alert("Could not find one or both locations. Please check the names and try again.");
    return;
  }

  const preferences = getUserPreferences();
  const path = findPath(startNode, endNode, preferences);

  if (!path || path.length === 0) {
    alert("No path found between these locations.");
    return;
  }

  currentPath = path;
  
  // If there are nodes in the path for the current layer, switch to that layer
  const nodesInCurrentLayer = path.filter(node => node.layer === view.layer);
  if (nodesInCurrentLayer.length === 0 && path.length > 0) {
    // Switch to the layer of the first node in the path
    view.layer = path[0].layer;
    if (layerSelect) {
      layerSelect.value = view.layer;
    }
  }

  // Show instructions
  showInstructions(path);
  
  redraw();
}

// Show navigation instructions
function showInstructions(path) {
  if (!path || path.length < 2) return;
  
  // Get the current segment of the path visible on this layer
  const currentLayerNodes = path.filter(node => node.layer === view.layer);
  if (currentLayerNodes.length < 1) return;
  
  const instructionPanel = document.getElementById("instructionPanel");
  const instructionMain = instructionPanel.querySelector(".instruction-main");
  const instructionDetail = instructionPanel.querySelector(".instruction-detail");
  
  // Determine what instruction to show based on the next node
  let instruction = "Continue straight";
  let detail = "Walk along the path";
  
  const firstNode = currentLayerNodes[0];
  
  if (currentLayerNodes.length > 1) {
    const nextNode = currentLayerNodes[1];
    
    // Check if we're headed to an elevator, stairs, or destination
    if (nextNode.type === "elevator") {
      instruction = "Head to elevator";
      detail = "Walk towards the elevator ahead";
    } else if (nextNode.type === "stairs") {
      instruction = "Head to stairs";
      detail = "Walk towards the staircase ahead";
    } else {
      // Try to get area info
      const areaInfo = getNodeAreaInfo(nextNode);
      if (areaInfo) {
        detail = `Walk along the path towards ${areaInfo.name || areaInfo.type}`;
      }
    }
  }
  
  // Update and show the instruction panel
  instructionMain.textContent = instruction;
  instructionDetail.textContent = detail;
  instructionPanel.style.display = "flex";
}

// Hide instructions
function hideInstructions() {
  const instructionPanel = document.getElementById("instructionPanel");
  if (instructionPanel) {
    instructionPanel.style.display = "none";
  }
}

// Get area info for a node
function getNodeAreaInfo(node) {
  if (!node) return null;
  
  // Check if node is directly associated with an area
  if (node.areaId !== undefined && areas[node.layer]) {
    const area = areas[node.layer].find(a => a.id === node.areaId);
    if (area) return area;
  }
  
  // Check if node is inside any area
  if (areas[node.layer]) {
    for (const area of areas[node.layer]) {
      if (isPointInPolygon(node.x, node.y, area.points)) {
        return area;
      }
    }
  }
  
  return null;
}

// Initialize node panel
function initNodePanel() {
  // No specific initialization needed currently
}

// Show node panel for editing
function showNodePanel(node) {
  if (!node) return;
  
  nodePanel.style.display = "block";
  
  const nameInput = document.getElementById("nodeName");
  const xInput = document.getElementById("nodeX");
  const yInput = document.getElementById("nodeY");
  const typeSelect = document.getElementById("nodeType");
  const connectionsDiv = document.getElementById("nodeConnections");
  
  nameInput.value = node.name || "";
  xInput.value = Math.round(node.x);
  yInput.value = Math.round(node.y);
  
  // Set type
  const options = typeSelect.options;
  for (let i = 0; i < options.length; i++) {
    if (options[i].value === node.type) {
      typeSelect.selectedIndex = i;
      break;
    }
  }
  
  // Show connections
  connectionsDiv.innerHTML = "";
  if (node.connections && node.connections.length > 0) {
    node.connections.forEach(conn => {
      const connNode = conn.layer ? 
        nodeGraph[conn.layer][conn.id] : 
        nodeGraph[node.layer][conn.id];
      
      if (!connNode) return;
      
      const connDiv = document.createElement("div");
      connDiv.className = "py-0.5";
      
      const connText = document.createTextNode(
        `#${conn.id}: ${connNode.name || 'Unnamed node'} ${conn.layer !== undefined && conn.layer !== node.layer ? `(${conn.layer})` : ''}`
      );
      connDiv.appendChild(connText);
      
      const removeBtn = document.createElement("button");
      removeBtn.className = "ml-1 text-red-600 text-xs";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", function() {
        disconnectNodes(node, connNode);
        showNodePanel(node); // Refresh panel
        redraw();
      });
      
      connDiv.appendChild(removeBtn);
      connectionsDiv.appendChild(connDiv);
    });
  } else {
    connectionsDiv.innerHTML = "<div>No connections</div>";
  }
}

// Save node data from panel
function saveNodeData() {
  if (!editorSelectedNode) return;
  
  const nameInput = document.getElementById("nodeName");
  const xInput = document.getElementById("nodeX");
  const yInput = document.getElementById("nodeY");
  const typeSelect = document.getElementById("nodeType");
  
  // Update name
  const oldName = editorSelectedNode.name;
  editorSelectedNode.name = nameInput.value;
  
  // Update named nodes array if name changed
  if (oldName !== editorSelectedNode.name) {
    // Remove old entry if it exists
    if (oldName) {
      const index = namedNodes[editorSelectedNode.layer].findIndex(
        n => n.id === editorSelectedNode.id && n.name === oldName
      );
      if (index !== -1) {
        namedNodes[editorSelectedNode.layer].splice(index, 1);
      }
    }
    
    // Add new entry if name is not empty
    if (editorSelectedNode.name) {
      namedNodes[editorSelectedNode.layer].push({
        id: editorSelectedNode.id,
        name: editorSelectedNode.name
      });
    }
    
    // Update suggestions
    populateSuggestions();
  }
  
  // Update position
  const newX = parseFloat(xInput.value);
  const newY = parseFloat(yInput.value);
  
  if (!isNaN(newX) && !isNaN(newY)) {
    moveNode(editorSelectedNode, newX, newY);
  }
  
  // Update type
  editorSelectedNode.type = typeSelect.value;
  
  // Refresh display
  redraw();
}

// Find area by name
function findAreaByName(name) {
  name = name.trim().toLowerCase();
  
  // Try exact match first
  for (const layer of loadedLayers) {
    if (!areas[layer]) continue;
    
    const area = areas[layer].find(a => a.name && a.name.toLowerCase() === name);
    if (area) return area;
  }
  
  // Then partial match
  for (const layer of loadedLayers) {
    if (!areas[layer]) continue;
    
    const area = areas[layer].find(a => a.name && a.name.toLowerCase().includes(name));
    if (area) return area;
  }
  
  return null;
}

// Check if point is inside polygon
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

// Get color for area type
function getAreaColor(type) {
  return areaTypes[type]?.color || "#EEEEEE";
}

// Draw node with appropriate styling based on type
function drawNodeWithType(node) {
  if (!node) return;
  
  let color = "#666666";
  let radius = 4;
  
  // Highlight selected node
  if (editorSelectedNode && editorSelectedNode.id === node.id) {
    radius = 6;
    color = "#ff3b30";
  } 
  // Highlight node if it's part of the current path
  else if (currentPath && currentPath.includes(node)) {
    radius = 6;
    color = "#ff3b30";
  } 
  // Otherwise use type-specific styling
  else if (node.type) {
    switch(node.type) {
      case "elevator":
        color = "#F8BBD0";
        break;
      case "stairs":
        color = "#FFE0B2";
        break;
      case "entrance":
        color = "#BBDEFB";
        break;
      default:
        color = "#666666";
    }
  }
  
  // Draw the node
  ctx.beginPath();
  ctx.arc(...posToCanvasPos(node.x, node.y), radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  
  // In editor mode, draw node IDs
  if ((editorMode === "edit" || editorMode === "node") && radius > 0) {
    ctx.fillStyle = "#333333";
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.fillText(node.id.toString(), posToCanvasPos(node.x, node.y)[0] + 8, posToCanvasPos(node.x, node.y)[1] - 8);
  }
}

// Redraw the canvas
function redraw() {
  if (view.layer !== view.renderedLayer) {
    // Layer change logic if needed
    view.renderedLayer = view.layer;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw areas if available
  if (typeof drawAreas === "function") {
    drawAreas();
  }
  
  // Draw connections between nodes
  drawNodeConnections();
  
  // Draw the current path if there is one
  if (currentPath && typeof drawPath === "function") {
    drawPath(currentPath);
  }
  
  // Draw nodes
  if (drawNodes) {
    for (const node of (nodeGraph[view.layer] || [])) {
      if (node) drawNodeWithType(node);
    }
  }

  // Draw polygon in progress if we're in that mode
  if (isDrawingPolygon && typeof drawPolygonInProgress === "function") {
    drawPolygonInProgress();
  }
}

// Draw connections between nodes
function drawNodeConnections() {
  if (!nodeGraph[view.layer]) return;
  
  ctx.strokeStyle = "#AAAAAA";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 3]);
  
  for (const node of nodeGraph[view.layer]) {
    if (!node || !node.connections) continue;
    
    for (const conn of node.connections) {
      // Only draw connections within the same layer - layer change connections are handled differently
      if (conn.layer && conn.layer !== view.layer) continue;
      
      const targetNode = nodeGraph[view.layer][conn.id];
      if (!targetNode) continue;
      
      // Draw line between nodes
      ctx.beginPath();
      ctx.moveTo(...posToCanvasPos(node.x, node.y));
      ctx.lineTo(...posToCanvasPos(targetNode.x, targetNode.y));
      ctx.stroke();
    }
  }
  
  ctx.setLineDash([]);
}

// Generate nodes for an area
function generateNodesForArea(area) {
  if (!area) return null;
  
  // Calculate center point
  const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
  const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
  
  // Create a node at the center
  const node = createNode(area.layer, centerX, centerY, area.name);
  
  // Associate node with area
  area.nodes = area.nodes || [];
  area.nodes.push(node.id);
  
  return node;
}

// Auto-connect nodes between nearby areas
function autoConnectAreaNodes() {
  if (!areas[view.layer]) return;
  
  const maxDistance = 100; // Maximum distance for auto-connection
  
  // Get all nodes from areas
  const areaNodes = [];
  areas[view.layer].forEach(area => {
    if (area.nodes) {
      area.nodes.forEach(nodeId => {
        const node = nodeGraph[view.layer][nodeId];
        if (node) {
          areaNodes.push({ 
            node, 
            areaId: area.id, 
            areaType: area.type 
          });
        }
      });
    }
  });
  
  // Connect nodes if they are close and not already connected
  for (let i = 0; i < areaNodes.length; i++) {
    for (let j = i + 1; j < areaNodes.length; j++) {
      const node1 = areaNodes[i].node;
      const node2 = areaNodes[j].node;
      
      // Skip if they're in the same area
      if (areaNodes[i].areaId === areaNodes[j].areaId) continue;
      
      // Calculate distance
      const dx = node1.x - node2.x;
      const dy = node1.y - node2.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Connect if close enough and not already connected
      if (distance <= maxDistance && 
          !node1.connections.some(c => c.id === node2.id) &&
          !node2.connections.some(c => c.id === node1.id)) {
        connectNodes(node1, node2);
        console.log(`Auto-connected nodes: ${node1.id} to ${node2.id}`);
      }
    }
  }
}