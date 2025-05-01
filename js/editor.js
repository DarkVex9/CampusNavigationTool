/**
 * editor.js - Map editor functionality with enhanced UI
 */

// Editor settings
var editorMode = "none";
var editorSelectedNode;
var editorSelectedArea;
var editorMoveRange = 500; // Max range that the move tool can grab a node from
var tempConnectingNode;
var tempIsHintDrawn = false;
let rectStartPos = null;
let rectEndPos = null;
var isDraggingBgImage = false;
var bgImageDragStartX = 0;
var bgImageDragStartY = 0;
var nodeShiftStepSize = 1;

function createNodeShiftControls(){
  // Add position controls
  const nodeShiftControlsDiv = document.createElement('div');
  nodeShiftControlsDiv.className = 'grid grid-cols-2 gap-2 mb-2';
  nodeShiftControlsDiv.innerHTML = `
    <button id="nodeShiftLeftBtn" class="w-full p-1 bg-gray-200 rounded border border-gray-300 text-xs">←</button>
    <button id="nodeShiftRightBtn" class="w-full p-1 bg-gray-200 rounded border border-gray-300 text-xs">→</button>
    <button id="nodeShiftUpBtn" class="w-full p-1 bg-gray-200 rounded border border-gray-300 text-xs">↑</button>
    <button id="nodeShiftDownBtn" class="w-full p-1 bg-gray-200 rounded border border-gray-300 text-xs">↓</button>
  `;
  document.getElementById("editorTools").appendChild(document.createElement("p").appendChild(document.createTextNode("Shift all nodes in layer")))
  let stepSizeControl = document.createElement("input")
  stepSizeControl.type = "number";
  stepSizeControl.min = 1;
  stepSizeControl.step = 1;
  nodeShiftControlsDiv.appendChild(document.createElement("p").appendChild(document.createTextNode("Step Size")))
  nodeShiftControlsDiv.appendChild(stepSizeControl);
  document.getElementById("editorTools").appendChild(nodeShiftControlsDiv);
  stepSizeControl.value = nodeShiftStepSize;
  stepSizeControl.addEventListener('change',(event)=>{nodeShiftStepSize = parseInt(event.target.value);});

  document.getElementById("nodeShiftLeftBtn").addEventListener('click',()=>{shiftLayer(-1*nodeShiftStepSize,0);})
  document.getElementById("nodeShiftRightBtn").addEventListener('click',()=>{shiftLayer(nodeShiftStepSize,0);})
  document.getElementById("nodeShiftUpBtn").addEventListener('click',()=>{shiftLayer(0,-1*nodeShiftStepSize);})
  document.getElementById("nodeShiftDownBtn").addEventListener('click',()=>{shiftLayer(0,nodeShiftStepSize);})
}


// Handle key press events
function handleKeyPress(event) {
  // Skip if inside an input field
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT") {
    return;
  }

  console.log("Key Pressed - " + event.key);
  
  switch(event.key) {
    case "p":
      if (event.ctrlKey || event.metaKey) {
        // "Print" current layer data
        quantizeNodePositions();
        console.log(JSON.stringify({
          name: view.layer,
          metadata: layerData[view.layer],
          graph: nodeGraph[view.layer],
          namedNodes: namedNodes[view.layer],
          areas: areas[view.layer] || []
        }));
      } else {
        // "Polygon" editor mode
        setEditorMode("polygon");
      }
      break;
    case "a":
      // "Add" editor mode
      setEditorMode("add");
      break;
    case "m":
      // "Move" editor mode
      setEditorMode("move");
      break;
    case "e":
      // "Edit" editor mode
      setEditorMode("edit");
      break;
    case "c":
      // "Connect" editor mode
      setEditorMode("connect");
      break;
    case "r":
      // "Area" editor mode
      setEditorMode("area");
      break;
    case "Escape":
      // Exit editor mode
      if (editorMode === "none") {
        // Clear selection if already in none mode
        editorSelectedNode = null;
        editorSelectedArea = null;
        redraw();
      }
      // Cancel polygon drawing if active
      if (isDrawingPolygon) {
        isDrawingPolygon = false;
        polygonPoints = [];
      }
      setEditorMode("none");
      
      // Hide panels
      document.getElementById("nodePanel").style.display = "none";
      const areaPanel = document.getElementById("areaPanel");
      if (areaPanel) areaPanel.style.display = "none";
      break;
    case "Backspace":
    case "Delete":
      // Delete selected node or area
      if (editorSelectedNode) {
        deleteSelectedNode();
      } else if (editorSelectedArea && editorMode === "area") {
        deleteSelectedArea();
      }
      break;
    case "d":
      // Toggle "Draw" nodes
      drawNodes = !drawNodes;
      console.log("Draw Nodes " + (drawNodes ? "Enabled" : "Disabled"));
      redraw();
      break;
    case "z":
      // Auto-connect nearby area nodes
      if (event.ctrlKey || event.metaKey) {
        console.log("Auto-connecting area nodes");
        autoConnectAreaNodes();
        redraw();
      }
      break;
    case "x":
      // Export map data
      if (event.ctrlKey || event.metaKey) {
        console.log("Exporting map data");
        exportMapData();
      }
      break;
  }
}

// Delete the selected node
function deleteSelectedNode() {
  if (!editorSelectedNode) return;
  
  // Disconnect all connections first
  while(editorSelectedNode.connections && editorSelectedNode.connections.length > 0) {
    const connNode = editorSelectedNode.connections[0].layer ?
      nodeGraph[editorSelectedNode.connections[0].layer][editorSelectedNode.connections[0].id] :
      nodeGraph[editorSelectedNode.layer][editorSelectedNode.connections[0].id];
    
    if (connNode) {
      disconnectNodes(editorSelectedNode, connNode);
    } else {
      // Handle invalid connection - just remove it
      editorSelectedNode.connections.splice(0, 1);
    }
  }
  
  // Remove the node from any areas it's associated with
  if (areas[editorSelectedNode.layer]) {
    areas[editorSelectedNode.layer].forEach(area => {
      if (area.nodes) {
        const index = area.nodes.indexOf(editorSelectedNode.id);
        if (index !== -1) {
          area.nodes.splice(index, 1);
        }
      }
    });
  }
  
  // Remove from node graph
  nodeGraph[editorSelectedNode.layer][editorSelectedNode.id] = null;
  
  // Remove from named nodes if it has a name
  if (editorSelectedNode.name) {
    const index = namedNodes[editorSelectedNode.layer].findIndex(
      n => n.id === editorSelectedNode.id
    );
    if (index !== -1) {
      namedNodes[editorSelectedNode.layer].splice(index, 1);
    }
    // Refresh suggestions
    populateSuggestions();
  }
  
  // Clear selection and hide panel
  editorSelectedNode = null;
  document.getElementById("nodePanel").style.display = "none";
  
  redraw();
}

// Delete the selected area
function deleteSelectedArea() {
  if (!editorSelectedArea) return;
  
  // Remove associated nodes first
  if (editorSelectedArea.nodes && editorSelectedArea.nodes.length > 0) {
    for (const nodeId of editorSelectedArea.nodes) {
      const node = nodeGraph[editorSelectedArea.layer][nodeId];
      if (node) {
        editorSelectedNode = node;
        deleteSelectedNode();
      }
    }
  }
  
  // Remove the area
  const areaIndex = areas[view.layer].findIndex(a => a.id === editorSelectedArea.id);
  if (areaIndex !== -1) {
    areas[view.layer].splice(areaIndex, 1);
  }
  
  // Clear selection and hide panel
  editorSelectedArea = null;
  const areaPanel = document.getElementById("areaPanel");
  if (areaPanel) areaPanel.style.display = "none";
  
  // Refresh suggestions as area names might be used
  populateSuggestions();
  
  redraw();
}

// Handle mouse down events
function handleMouseDown(event) {
  if (event.button !== 0) {
    return; // Only handle left clicks
  }
  
  if (event.target === canvas || event.target === document.body || event.target.tagName === "IMG") {
    // Add this new condition for background image dragging
    if (editorMode === "bgmove" && backgroundImages[view.layer]) {
      isDraggingBgImage = true;
      bgImageDragStartX = event.pageX;
      bgImageDragStartY = event.pageY;
      canvas.style.cursor = "move";
      return; // Stop processing further
    }
    
    if (editorMode === "none") {
      // Start panning
      isDragging = true;
    } else if (editorMode === "move" || editorMode === "edit" || editorMode === "connect") {
      isDragging = true;
      const worldPos = canvasPosToPos(event.pageX, event.pageY);
      const nearestNode = findNearestNode(worldPos[0], worldPos[1]);
      
      if (!nearestNode) {
        console.warn("No nodes found in the current layer");
        return;
      }
      
      editorSelectedNode = nearestNode;
      
      if (editorMode === "move") {
        // Check if node is within range
        const distance = Math.sqrt(
          Math.pow(editorSelectedNode.x - worldPos[0], 2) + 
          Math.pow(editorSelectedNode.y - worldPos[1], 2)
        );
        if (distance > (editorMoveRange / Math.sqrt(view.zoom))) {
          console.log("Node too far, deselecting");
          editorSelectedNode = null;
          return; // nearest node is outside max move range
        }
      }
      
      // Show node panel in edit mode
      if (editorMode === "edit") {
        showNodePanel(editorSelectedNode);
      }
      
      redraw();
    } else if (editorMode === "add") {
      const worldPos = canvasPosToPos(event.pageX, event.pageY);
      editorSelectedNode = createNode(view.layer, worldPos[0], worldPos[1]);
      drawNodes = true;
      
      // Make nodes more visible by giving them a name by default
      editorSelectedNode.name = "Node " + editorSelectedNode.id;
      editorSelectedNode.constraints = [];
      
      // Add to named nodes
      if (!namedNodes[view.layer]) {
        namedNodes[view.layer] = [];
      }
      
      if (!loadedLayers.includes(view.layer)) {
        loadedLayers.push(view.layer);
      }
      namedNodes[view.layer].push({
        id: editorSelectedNode.id,
        name: editorSelectedNode.name
      });

      checkMapSetup();
      populateSuggestions();
      console.log("Node added:", editorSelectedNode);
      // Show the node panel immediately for editing
      showNodePanel(editorSelectedNode);    
      // Redraw to show the new node
      redraw();

    } else if (editorMode === "polygon") {
      rectStartPos = canvasPosToPos(event.pageX, event.pageY);
      rectEndPos = null;
      isDrawingPolygon = true;
    } else if (editorMode === "area") {
      // Select an area when in area mode
      const worldPos = canvasPosToPos(event.pageX, event.pageY);
      editorSelectedArea = findAreaAtPoint(worldPos[0], worldPos[1]);
      
      if (editorSelectedArea) {
        console.log("Selected area:", editorSelectedArea);
        showAreaPanel(editorSelectedArea);
      } else {
        console.log("No area found at click position");
        const areaPanel = document.getElementById("areaPanel");
        if (areaPanel) {
          areaPanel.style.display = "none";
        }
      }
      redraw();
    }
  }
}

// Handle mouse up events
function handleMouseUp(event) {
  if (event.button !== 0) {
    return; // Only handle left clicks
  }
  
  // Add this new condition for background image dragging
  if (isDraggingBgImage) {
    isDraggingBgImage = false;
    if (editorMode === "bgmove") {
      canvas.style.cursor = "move"; // Keep move cursor in bgmove mode
    } else {
      canvas.style.cursor = "default";
    }
    return;
  }
  
  if (editorMode === "polygon" && isDrawingPolygon && rectStartPos && rectEndPos) {
    const x1 = rectStartPos[0];
    const y1 = rectStartPos[1];
    const x2 = rectEndPos[0];
    const y2 = rectEndPos[1];
  
    const points = [
      { x: Math.min(x1, x2), y: Math.min(y1, y2) },
      { x: Math.max(x1, x2), y: Math.min(y1, y2) },
      { x: Math.max(x1, x2), y: Math.max(y1, y2) },
      { x: Math.min(x1, x2), y: Math.max(y1, y2) }
    ];
  
    isDrawingPolygon = false;
    rectStartPos = null;
    rectEndPos = null;
  
    showAreaPropertiesDialog(function(properties) {
      const area = createArea(view.layer, properties.name, properties.type, points);
      if (properties.createNode) {
        generateNodesForArea(area);
      }
      console.log("Created new area:", area);
      redraw();
      populateSuggestions();
    });
  }
  
  if (editorMode === "connect" && editorSelectedNode && event.target === canvas) {
    const worldPos = canvasPosToPos(event.pageX, event.pageY);
    let node2 = findNearestNode(worldPos[0], worldPos[1]);
  
    if (node2 && editorSelectedNode !== node2) {
      if (editorSelectedNode.connections.some(c => c.id === node2.id)) {
        disconnectNodes(editorSelectedNode, node2);
      } else {
        connectNodes(editorSelectedNode, node2);
      }
      redraw();
    }
  }
  
  isDragging = false;
}


// Handle mouse move events
function handleMouseMove(event) {
  // Add this new condition for background image dragging
  if (isDraggingBgImage && backgroundImages[view.layer]) {
    // Convert screen movement to world movement
    const worldMovementX = event.movementX / view.zoom;
    const worldMovementY = event.movementY / view.zoom;
    
    // Update background position in world coordinates
    backgroundImages[view.layer].x += worldMovementX;
    backgroundImages[view.layer].y += worldMovementY;
    
    // Redraw
    redraw();
    return;
  }

  updateSaveAreaButtonVisibility();

  if (isDragging) {
    if (editorMode === "move" && editorSelectedNode) {
      // Move the selected node
      const pos = canvasPosToPos(event.pageX, event.pageY);
      moveNode(editorSelectedNode, pos[0], pos[1]);
      redraw();
    } else if (editorMode === "connect" && editorSelectedNode) {
      // Draw rubber-band line to nearest node
      const worldPos = canvasPosToPos(event.pageX, event.pageY);
      let node2 = findNearestNode(worldPos[0], worldPos[1]);
      
      if (node2 && tempConnectingNode !== node2) {
        redraw();
        tempConnectingNode = node2;
        ctx.strokeStyle = editorStyle.connectionHighlightColor;
        ctx.lineWidth = editorStyle.connectionHighlightWidth;
        ctx.beginPath();
        ctx.moveTo(...posToCanvasPos(editorSelectedNode.x, editorSelectedNode.y));
        ctx.lineTo(...posToCanvasPos(node2.x, node2.y));
        ctx.stroke();
      }
    } else if (editorMode === "polygon" && isDrawingPolygon && rectStartPos) {
      rectEndPos = canvasPosToPos(event.pageX, event.pageY);
      redraw();
      drawRectanglePreview(rectStartPos, rectEndPos);
    } else {
      // Pan the view
      view.x += event.movementX / view.zoom;
      view.y += event.movementY / view.zoom;
      redraw();
    }
  } else {
    // Not dragging - show hints or previews
    if (editorMode === "move") {
      const cursorPos = canvasPosToPos(event.pageX, event.pageY);
      const node = findNearestNode(cursorPos[0], cursorPos[1]);
      if (node) {
        const distance = Math.sqrt(
          Math.pow(node.x - cursorPos[0], 2) +
          Math.pow(node.y - cursorPos[1], 2)
        );
        if (distance < (editorMoveRange / Math.sqrt(view.zoom))) {
          tempIsHintDrawn = true;
          redraw();
          ctx.strokeStyle = editorStyle.hintColor;
          ctx.lineWidth = editorStyle.connectionHighlightWidth;
          ctx.beginPath();
          ctx.moveTo(event.pageX, event.pageY);
          ctx.lineTo(...posToCanvasPos(node.x, node.y));
          ctx.stroke();
        } else if (tempIsHintDrawn) {
          tempIsHintDrawn = false;
          redraw();
        }
      }
    }
  }
}

// Handle scroll events for zooming
function handleScroll(event) {
  const mouseX = event.pageX;
  const mouseY = event.pageY;
  const worldPosBeforeZoom = canvasPosToPos(mouseX, mouseY);
  
  const zoomFactor = Math.pow(Math.E, -event.deltaY / 400);
  view.zoom = Math.min(Math.max(view.zoom * zoomFactor, 0.2), 5);
  
  const worldPosAfterZoom = canvasPosToPos(mouseX, mouseY);
  view.x += (worldPosAfterZoom[0] - worldPosBeforeZoom[0]);
  view.y += (worldPosAfterZoom[1] - worldPosBeforeZoom[1]);
  redraw();
}

// Draw the polygon currently being created
function drawPolygonInProgress() {
  if (polygonPoints.length === 0) return;
  ctx.fillStyle = "rgba(66, 245, 194, 0.3)";
  ctx.strokeStyle = "#42F5C2";
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(...posToCanvasPos(polygonPoints[0].x, polygonPoints[0].y));
  for (let i = 1; i < polygonPoints.length; i++) {
    ctx.lineTo(...posToCanvasPos(polygonPoints[i].x, polygonPoints[i].y));
  }
  if (polygonPoints.length >= 3) {
    ctx.closePath();
    ctx.fill();
  }
  ctx.stroke();
  
  // Draw points
  for (const point of polygonPoints) {
    drawCircle(point.x, point.y, 3, "#42F5C2", true);
  }
}

// Show dialog to set area properties when creating a new area
function showAreaPropertiesDialog(callback) {
  // Simple ephemeral dialog
  const dialog = document.createElement("div");
  dialog.className = "area-dialog";
  dialog.innerHTML = `
    <h3>Area Properties</h3>
    <div>
      <label for="area-name">Name:</label>
      <input type="text" id="area-name" placeholder="Room name">
    </div>
    <div>
      <label for="area-type">Type:</label>
      <select id="area-type">
        ${Object.keys(areaTypes).map(type =>
          `<option value="${type}">${areaTypes[type].name}</option>`
        ).join('')}
      </select>
    </div>
    <div>
      <input type="checkbox" id="create-node" checked>
      <label for="create-node">Create navigation node inside area</label>
    </div>
    <div class="buttons">
      <button id="cancel-area">Cancel</button>
      <button id="save-area">Save</button>
    </div>
  `;
  document.body.appendChild(dialog);
  
  document.getElementById("save-area").addEventListener("click", function() {
    const name = document.getElementById("area-name").value || "Untitled Area";
    const type = document.getElementById("area-type").value;
    const createNode = document.getElementById("create-node").checked;
    document.body.removeChild(dialog);
    callback({ name, type, createNode });
  });
  
  document.getElementById("cancel-area").addEventListener("click", function() {
    document.body.removeChild(dialog);
  });
}

// Set the editor mode function - critical missing piece
function setEditorMode(mode) {
  console.log("Changing editor mode to:", mode);
  
  // Set the current mode
  editorMode = mode;
  
  // Update UI to reflect current mode
  document.getElementById("editorMode").textContent = "Editor Mode: " + 
    mode.charAt(0).toUpperCase() + mode.slice(1);
  
  // Add this new condition for background image mode
  if (mode === "bgmove") {
    // Set cursor to move if there's a background image
    if (backgroundImages[view.layer]) {
      canvas.style.cursor = "move";
    } else {
      canvas.style.cursor = "default";
      alert("No background image in the current layer.");
    }
  } else {
    canvas.style.cursor = "default";
  }
  
  // Toggle area type selector visibility
  const areaTypeContainer = document.getElementById("areaTypeContainer");
  if (areaTypeContainer) {
    areaTypeContainer.style.display = (mode === "polygon") ? "block" : "none";
  }

  // Toggle save area button visibility
  const saveAreaButton = document.getElementById("saveAreaButton");
  if (saveAreaButton) {
    saveAreaButton.style.display = (mode === "polygon") ? "block" : "none";
  }
  
  // Update button states
  const buttons = document.querySelectorAll(".editor-buttons button");
  buttons.forEach(button => {
    if (button.dataset.mode === mode) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
  
  // Handle polygon mode specially
  if (mode === "polygon") {
    isDrawingPolygon = true;
    polygonPoints = [];
    console.log("Started polygon drawing");
  }
  
  // Deselect nodes if changing mode
  if (mode !== "edit" && mode !== "move" && mode !== "connect") {
    editorSelectedNode = null;
    document.getElementById("nodePanel").style.display = "none";
  }
  
  // Reset temporary connection display
  tempConnectingNode = null;
  
  // Refresh display
  redraw();
}

function updateSaveAreaButtonVisibility() {
  const saveAreaButton = document.getElementById("saveAreaButton");
  if (saveAreaButton && editorMode === "polygon" && isDrawingPolygon) {
    saveAreaButton.style.display = (polygonPoints.length >= 3) ? "block" : "none";
  }
}

// Create a node
function createNode(layer, x, y, type = "regular", constraints = []) {
  // If the layer doesn't exist yet, initialize it
  if (!nodeGraph[layer]) {
    nodeGraph[layer] = [];
    namedNodes[layer] = [];
  }
  
  // Find a free ID
  let id = 0;
  while (id < nodeGraph[layer].length && nodeGraph[layer][id] !== null) {
    id++;
  }
  
  const node = {
    id: id,
    x: x,
    y: y,
    layer: layer,
    connections: [],
    type: type,
    constraints: constraints  // Add constraints array
  };
  
  // Add to nodegraph array
  if (id < nodeGraph[layer].length) {
    nodeGraph[layer][id] = node;
  } else {
    nodeGraph[layer].push(node);
  }
  
  return node;
}

// Connect two nodes
function connectNodes(node1, node2) {
  // Check if nodes are on different layers
  if (node1.layer !== node2.layer) {
    // Determine if this is a stairs or elevator connection
    const isStairs = node1.type === "stairs" || node2.type === "stairs";
    const isElevator = node1.type === "elevator" || node2.type === "elevator";
    
    // Create flags array based on node types
    const flags = ["layerChange"];
    if (isStairs) flags.push("stairs");
    if (isElevator) flags.push("elevator");
    
    // Add connection to first node
    node1.connections.push({
      id: node2.id,
      layer: node2.layer,
      flags: flags
    });
    
    // Add connection to second node
    node2.connections.push({
      id: node1.id,
      layer: node1.layer,
      flags: flags
    });
    
    console.log(`Created ${isStairs ? 'stairs' : isElevator ? 'elevator' : 'layer change'} connection between layers ${node1.layer} and ${node2.layer}`);
  } else {
    // Calculate distance
    const dx = node1.x - node2.x;
    const dy = node1.y - node2.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Normal connection
    node1.connections.push({
      id: node2.id,
      distance: distance
    });
    
    node2.connections.push({
      id: node1.id,
      distance: distance
    });
  }
}

// Disconnect two nodes
function disconnectNodes(node1, node2) {
  // Remove node2 from node1's connections
  for (let i = 0; i < node1.connections.length; i++) {
    if ((node1.connections[i].layer && node1.connections[i].layer === node2.layer && 
         node1.connections[i].id === node2.id) ||
        (!node1.connections[i].layer && node1.connections[i].id === node2.id)) {
      node1.connections.splice(i, 1);
      break;
    }
  }
  
  // Remove node1 from node2's connections
  for (let i = 0; i < node2.connections.length; i++) {
    if ((node2.connections[i].layer && node2.connections[i].layer === node1.layer && 
         node2.connections[i].id === node1.id) ||
        (!node2.connections[i].layer && node2.connections[i].id === node1.id)) {
      node2.connections.splice(i, 1);
      break;
    }
  }
}

// Move a node to a new position
function moveNode(node, x, y) {
  node.x = x;
  node.y = y;
  
  // Update distances for all connections
  for (let i = 0; i < node.connections.length; i++) {
    if (!node.connections[i].layer) {
      const connectedNode = nodeGraph[node.layer][node.connections[i].id];
      if (connectedNode) {
        const dx = node.x - connectedNode.x;
        const dy = node.y - connectedNode.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        node.connections[i].distance = distance;
        
        // Find and update the reverse connection too
        for (let j = 0; j < connectedNode.connections.length; j++) {
          if (connectedNode.connections[j].id === node.id) {
            connectedNode.connections[j].distance = distance;
            break;
          }
        }
      }
    }
  }
}

// Generate nodes for an area
function generateNodesForArea(area) {
  if (!area || !area.points || area.points.length < 3) return null;
  
  // Calculate centroid
  const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
  const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
  
  // Create a node at the center
  const node = createNode(area.layer, centerX, centerY, area.type === "elevator" ? "elevator" : 
                                               area.type === "stairs" ? "stairs" : 
                                               area.type === "restroom" ? "restroom" : 
                                               area.type === "entrance" ? "entrance" : "regular");
  
  // Set the name if area has one
  if (area.name) {
    node.name = area.name;
    namedNodes[area.layer].push({
      id: node.id,
      name: area.name
    });
    
    // Update UI suggestions
    populateSuggestions();
  }
  
  // Add node to area
  associateNodeWithArea(node, area);
  
  return node;
}

// Find area at point
function findAreaAtPoint(x, y, layer = view.layer) {
  if (!areas[layer]) return null;
  
  for (const area of areas[layer]) {
    if (isPointInPolygon(x, y, area.points)) {
      return area;
    }
  }
  
  return null;
}

// Show area panel
function showAreaPanel(area) {
  // Check if panel already exists
  let areaPanel = document.getElementById("areaPanel");
  if (existingDeleteBtn) {
    existingDeleteBtn.remove();
  }
  
  const deleteButton = document.createElement("button");
  deleteButton.id = "deleteAreaBtn";
  deleteButton.textContent = "Delete Area";
  deleteButton.style.marginTop = "6px";

  deleteButton.addEventListener("click", () => {
    // Mark this area as selected, then call the built-in delete function
    editorSelectedArea = area;
    deleteSelectedArea();
  });

  // Insert the button into the area panel
  areaPanel.appendChild(deleteButton);

  // Create panel if it doesn't exist
  if (!areaPanel) {
    areaPanel = document.createElement("div");
    areaPanel.id = "areaPanel";
    areaPanel.className = "node-panel";
    areaPanel.style.right = "10px";
    areaPanel.style.left = "auto";
    
    document.body.appendChild(areaPanel);
  }
  
  // Populate panel
  areaPanel.innerHTML = `
    <div class="flex justify-between mb-2">
      <h3 class="text-sm font-medium">Area Properties</h3>
      <button id="closeAreaPanel" class="text-xs">×</button>
    </div>
    <div class="mb-2">
      <label for="areaName" class="block text-xs font-medium">Name</label>
      <input type="text" id="areaName" class="w-full p-1 border rounded text-xs" value="${area.name || ''}">
    </div>
    <div class="mb-2">
      <label for="areaType" class="block text-xs font-medium">Type</label>
      <select id="areaType" class="w-full p-1 border rounded text-xs">
        ${Object.keys(areaTypes).map(type => 
          `<option value="${type}" ${area.type === type ? 'selected' : ''}>${areaTypes[type].name}</option>`
        ).join('')}
      </select>
    </div>
    <div class="mt-2">
      <button id="createNodeInArea" class="text-xs p-1 bg-blue-100 rounded border w-full mb-1">Create Node</button>
      <button id="saveAreaData" class="w-full bg-blue-500 text-white text-xs p-1 rounded">Save</button>
    </div>
  `;
  
  // Show panel
  areaPanel.style.display = "block";
  
  // Add event listeners
  document.getElementById("closeAreaPanel").addEventListener("click", () => {
    areaPanel.style.display = "none";
  });
  
  document.getElementById("saveAreaData").addEventListener("click", () => {
    // Save area data
    area.name = document.getElementById("areaName").value;
    area.type = document.getElementById("areaType").value;
    
    // Update any nodes associated with this area
    if (area.nodes) {
      for (const nodeId of area.nodes) {
        const node = nodeGraph[area.layer][nodeId];
        if (node) {
          // Update node type based on area type
          if (area.type === "elevator") node.type = "elevator";
          else if (area.type === "stairs") node.type = "stairs";
          else if (area.type === "restroom") node.type = "restroom";
          else if (area.type === "entrance") node.type = "entrance";
          
          // Update node name if it matches area name
          if (node.name === area.name) {
            node.name = area.name;
          }
        }
      }
    }
    
    redraw();
  });
  
  document.getElementById("createNodeInArea").addEventListener("click", () => {
    const node = generateNodesForArea(area);
    if (node) {
      console.log("Created node in area:", node);
      editorSelectedNode = node;
      showNodePanel(node);
      redraw();
    }
  });
}

// Auto-connect area nodes
function autoConnectAreaNodes() {
  if (!areas[view.layer]) return;
  
  // Get all nodes that are in this layer
  const layerNodes = nodeGraph[view.layer].filter(node => node !== null);
  
  // For each area
  for (const area of areas[view.layer]) {
    if (!area.nodes || area.nodes.length === 0) continue;
    
    // Get nodes in this area
    const areaNodeIds = area.nodes;
    const areaNodes = areaNodeIds.map(id => nodeGraph[view.layer][id]).filter(node => node !== null);
    
    if (areaNodes.length === 0) continue;
    
    // Find nearest node outside the area
    for (const areaNode of areaNodes) {
      let nearestNode = null;
      let minDistance = Infinity;
      
      for (const node of layerNodes) {
        if (areaNodeIds.includes(node.id)) continue; // Skip nodes in this area
        
        const dx = areaNode.x - node.x;
        const dy = areaNode.y - node.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestNode = node;
        }
      }
      
      // Connect to nearest node if found and not already connected
      if (nearestNode && minDistance < 200) {
        // Check if already connected
        const isConnected = areaNode.connections.some(conn => 
          conn.id === nearestNode.id && (!conn.layer || conn.layer === nearestNode.layer)
        );
        
        if (!isConnected) {
          console.log(`Connecting area node ${areaNode.id} to ${nearestNode.id}`);
          connectNodes(areaNode, nearestNode);
        }
      }
    }
  }
}

// Quantize node positions to make the data cleaner
function quantizeNodePositions() {
  if (!nodeGraph[view.layer]) return;
  
  for (const node of nodeGraph[view.layer]) {
    if (!node) continue;
    
    // Round to nearest 5 pixels
    node.x = Math.round(node.x / 5) * 5;
    node.y = Math.round(node.y / 5) * 5;
  }
  
  console.log("Quantized all node positions");
  redraw();
}

// Export map data
function exportMapData() {
  // Prepare data for export
  const exportData = {
    layers: {},
    backgroundImages: {} 
  };
  
  
  for (const layer of loadedLayers) {
    if (nodeGraph[layer] && nodeGraph[layer].length > 0) {
      // Clean up the data by removing nulls
      const cleanNodes = nodeGraph[layer].filter(node => node !== null);
      
      exportData.layers[layer] = {
        metadata: layerData[layer] || {},
        nodes: cleanNodes,
        namedNodes: namedNodes[layer] || [],
        areas: areas[layer] || []
      };
    }

    if (backgroundImages[layer])  {
      const {image, ...rest} = backgroundImages[layer];
      exportData.backgroundImages[layer] = rest;
    }
  }
  
  // Convert to JSON
  const jsonData = JSON.stringify(exportData, null, 2);
  
  // Create download link
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'map_data.json';
  a.click();
  URL.revokeObjectURL(url);
  
  console.log("Map data exported");
}

// Helper function to populate search suggestions
function populateSuggestions() {
  const originSuggestions = document.getElementById("originSuggestions");
  const destinationSuggestions = document.getElementById("destinationSuggestions");
  
  if (!originSuggestions || !destinationSuggestions) return;
  
  // Clear existing options
  originSuggestions.innerHTML = "";
  destinationSuggestions.innerHTML = "";
  
  // Add all named nodes to suggestions
  for (const layer of loadedLayers) {
    if (!namedNodes[layer]) continue;
    
    for (const namedNode of namedNodes[layer]) {
      if (!namedNode || !namedNode.name) continue;
      
      // Create option elements
      const originOption = document.createElement("option");
      originOption.value = namedNode.name;
      
      const destinationOption = document.createElement("option");
      destinationOption.value = namedNode.name;
      
      // Add to datalists
      originSuggestions.appendChild(originOption);
      destinationSuggestions.appendChild(destinationOption);
    }
  }
  
  // Add area names to suggestions if they don't already have a node with the same name
  for (const layer of loadedLayers) {
    if (!areas[layer]) continue;
    
    for (const area of areas[layer]) {
      if (!area || !area.name) continue;
      
      // Check if this name is already in the suggestions
      let nameExists = false;
      for (const option of originSuggestions.options) {
        if (option.value === area.name) {
          nameExists = true;
          break;
        }
      }
      
      if (!nameExists) {
        // Create option elements
        const originOption = document.createElement("option");
        originOption.value = area.name;
        
        const destinationOption = document.createElement("option");
        destinationOption.value = area.name;
        
        // Add to datalists
        originSuggestions.appendChild(originOption);
        destinationSuggestions.appendChild(destinationOption);
      }
    }
  }
  
  console.log("Updated search suggestions");
}

// Function to get user preferences
function getUserPreferences() {
  return {
    avoidStairs: document.getElementById("avoidStairs")?.checked || false,
    avoidElevators: document.getElementById("avoidElevators")?.checked || false
  };
}

// Check map setup
function checkMapSetup() {
  console.log("Checking map setup...");
  
  // Check if any layers are loaded
  if (loadedLayers.length === 0) {
    console.warn("No layers loaded!");
    return;
  }
  
  // Log information about loaded layers
  console.log(`${loadedLayers.length} layers loaded:`);
  for (const layer of loadedLayers) {
    const nodeCount = nodeGraph[layer] ? nodeGraph[layer].filter(n => n !== null).length : 0;
    console.log(`- ${layer}: ${nodeCount} nodes`);
  }
  
  // Populate layer select dropdown
  const layerSelect = document.getElementById("layerSelect");
  if (layerSelect) {
    layerSelect.innerHTML = ""; // Clear existing options
    for (const layer of loadedLayers) {
      addLayerToSelect(layer);
    }
  }
  
  // Set current layer if not already set
  if (!view.layer || !loadedLayers.includes(view.layer)) {
    view.layer = loadedLayers[0];
    console.log(`Set current layer to ${view.layer}`);
  }
  
  // Populate search suggestions
  populateSuggestions();
}

function drawRectanglePreview(start, end) {
  if (!start || !end) return;
  ctx.strokeStyle = "#42F5C2";
  ctx.fillStyle = "rgba(66, 245, 194, 0.3)";
  ctx.lineWidth = 2;

  const [x1, y1] = posToCanvasPos(start[0], start[1]);
  const [x2, y2] = posToCanvasPos(end[0], end[1]);

  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);

  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.fill();
  ctx.stroke();
}

document.getElementById("addFloorBtn").addEventListener("click", () => {
  const newLayerName = prompt("Enter name for new floor/layer (e.g., floor2, rooftop, outside-west):");
  if (!newLayerName) return;

  // Prevent duplicate layer names
  if (loadedLayers.includes(newLayerName)) {
    alert("A floor/layer with that name already exists.");
    return;
  }

  // Initialize the new layer
  nodeGraph[newLayerName] = [];
  namedNodes[newLayerName] = [];
  areas[newLayerName] = [];
  loadedLayers.push(newLayerName);

  console.log("New layer created:", newLayerName);

  // Update UI
  checkMapSetup();
  view.layer = newLayerName;
  redraw();
});

// Enable image to Base64 conversion when user uploads background image
document.getElementById("uploadBgImage").addEventListener("change", async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    const dataURL = reader.result;

    const img = new Image();
    img.onload = () => {
      backgroundImages[view.layer] = {
        image: img,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        opacity: 0.5,
        dataURL: dataURL // Store the Base64 data URL for saving
      };
      
      console.log("Background image loaded with dimensions:", img.width, "x", img.height);
      
      // Show background image controls
      const bgControls = document.getElementById("backgroundControls");
      if (bgControls) {
        bgControls.style.display = "block";
      }
      
      redraw();
    };
    img.src = dataURL;
  };
  reader.readAsDataURL(file);
});