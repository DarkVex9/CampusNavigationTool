/**
 * ui.js - User interface components and interactions
 */

// UI Elements
var mapImgElement;
var canvas;
var ctx;
var originField;
var destinationField;
var editorContainer;
var editorLayerSelect;
var editorModeLabel;
var nodePanel;

// UI settings
var pathColor = "#ff0000";   // Path line color
var pathWidth = 4;           // Path line width in pixels
var editorStyle = {
    nodeColor: "#42F5C2",
    nodeRadius: 5,
    nodeHighlightColor: "#EDC618",
    connectionColor: "#888888",
    connectionWidth: 3,
    connectionHighlightColor: "#EDC618",
    connectionHighlightWidth: 5,
    hintColor: "#C9C5A9"
};

// View state
var view = {
    x: 0,
    y: 0,
    zoom: 1,
    layer: "outside",
    renderedLayer: ""
};

// UI interaction states
var isDragging = false;
var drawNodes = false;
var tempConnectingNode;
var tempIsHintDrawn = false;

// Initialize UI
function initUI() {
    console.log("Initializing UI components");
    
    // Get references to HTML elements
    mapImgElement = document.getElementById("mainMapImg");
    canvas = document.getElementById("overlay");
    ctx = canvas.getContext("2d");
    originField = document.getElementById("origin");
    destinationField = document.getElementById("destination");
    editorContainer = document.getElementById("editorTools");
    editorLayerSelect = document.getElementById("layerSelect");
    editorModeLabel = document.getElementById("editorMode");
    nodePanel = document.getElementById("nodePanel");
    
    // Initialize canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log("Canvas sized to:", canvas.width, "x", canvas.height);
    
    // Show editor tools if enabled
    if (editorAllowed) {
        editorContainer.style.display = "inline-block";
        console.log("Editor tools displayed");
    }
    
    console.log("UI initialization complete");
}

// Handle Go button click
function handleGoButton() {
    console.log("Go Button Pressed");
    
    if (Object.keys(nodeGraph).length === 0 || loadingCount !== 0) {
        console.log("Search canceled - Something isn't ready yet. \nWaiting on " + loadingCount + " files");
        alert("Map data is not fully loaded yet. Please try again in a moment.");
        return;    // Abort search
    }
    
    let startNode = findByName(originField.value);
    let endNode = findByName(destinationField.value);
    
    if (!startNode || !endNode) {
        console.log("Search canceled - Couldn't find node by name. \nStart String:'" + originField.value.trim() + "'\nEnd String:'" + destinationField.value.trim() + "'\nStart Found:" + startNode + "\nEnd Found:" + endNode);
        alert("Could not find one or both of the specified locations. Please check your input.");
        return;    // Abort search
    }
    
    // Get user preferences
    const preferences = getUserPreferences();
    console.log("User preferences:", preferences);
    
    // Find path with preferences
    let path = findPath(startNode, endNode, preferences);

    if (!path) {
        console.log("Path not found");
        alert("No path found between these locations.");
        return;    // Search failed
    }
    
    currentPath = path;
    console.log("Path found:", path);
    redraw();
}

// Handle layer dropdown change
function handleLayerDropdown() {
    view.layer = editorLayerSelect.value;
    console.log("Layer changed to:", view.layer);
    redraw();
}

// Update the map image transform based on view
function updateMapImageTransform() {
    if (!mapImgElement) return;
    mapImgElement.style.transform = `scale(${view.zoom}) translate(${view.x + canvas.width/2/view.zoom}px, ${view.y + canvas.height/2/view.zoom}px)`;
}

// Redraw the canvas
function redraw() {
  console.log("Redrawing canvas. Current layer:", view.layer);
  console.log("Layer data:", layerData[view.layer]);
  console.log("Nodes in current layer:", nodeGraph[view.layer] ? nodeGraph[view.layer].filter(n => n !== null).length : 0);
  console.log("Areas in current layer:", areas[view.layer] ? areas[view.layer].length : 0);
  console.log("drawNodes flag:", drawNodes);
  console.log("View settings:", JSON.stringify(view));

  window.floorChangeIndicators = [];

  // Clear the canvas first
  if (!ctx || !canvas) {
    console.error("Canvas context or canvas not initialized");
    return;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set background color based on layer
  if (layerData[view.layer] && layerData[view.layer].backgroundColor) {
      ctx.fillStyle = layerData[view.layer].backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
      ctx.fillStyle = "#F0F0F0"; // Default background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw background image if present
  drawBackgroundImage();
  
  // Draw grid lines for reference
  drawGridLines();
  
  // Draw areas if they exist
  if (areas[view.layer]) {
      drawAreas();
  }
  
  // Draw current path if one exists
  if (currentPath) {
      drawPath(currentPath);
  }
  
  // Draw nodes and connections if enabled
  if (drawNodes && nodeGraph[view.layer]) {
      drawNodesAndConnections();
  }
  
  // Draw polygon in progress if in polygon mode
  if (isDrawingPolygon && polygonPoints.length > 0) {
      drawPolygonInProgress();
  }

  drawNodeDebugInfo();
}

function drawGridLines() {
  const gridSize = 50; // Size of grid squares in world units
  const gridColor = "#cccccc"; // Make grid more visible
  
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  
  // Calculate the visible area in world coordinates
  const visibleLeft = -view.x - (canvas.width / 2) / view.zoom;
  const visibleRight = -view.x + (canvas.width / 2) / view.zoom;
  const visibleTop = -view.y - (canvas.height / 2) / view.zoom;
  const visibleBottom = -view.y + (canvas.height / 2) / view.zoom;
  
  // Calculate grid start and end points
  const startX = Math.floor(visibleLeft / gridSize) * gridSize;
  const endX = Math.ceil(visibleRight / gridSize) * gridSize;
  const startY = Math.floor(visibleTop / gridSize) * gridSize;
  const endY = Math.ceil(visibleBottom / gridSize) * gridSize;
  
  // Draw vertical lines
  ctx.beginPath();
  for (let x = startX; x <= endX; x += gridSize) {
    const canvasX = posToCanvasPos(x, 0)[0];
    ctx.moveTo(canvasX, 0);
    ctx.lineTo(canvasX, canvas.height);
  }
  ctx.stroke();
  
  // Draw horizontal lines
  ctx.beginPath();
  for (let y = startY; y <= endY; y += gridSize) {
    const canvasY = posToCanvasPos(0, y)[1];
    ctx.moveTo(0, canvasY);
    ctx.lineTo(canvas.width, canvasY);
  }
  ctx.stroke();
  
  // Draw coordinate labels at major grid lines
  ctx.fillStyle = "#666";
  ctx.font = "10px Arial";
  for (let x = startX; x <= endX; x += gridSize * 5) {
    const [canvasX, canvasY] = posToCanvasPos(x, 0);
    ctx.fillText(x.toString(), canvasX + 2, 12);
  }
  
  for (let y = startY; y <= endY; y += gridSize * 5) {
    const [canvasX, canvasY] = posToCanvasPos(0, y);
    ctx.fillText(y.toString(), 2, canvasY - 2);
  }
  
  // Draw origin marker
  const [originX, originY] = posToCanvasPos(0, 0);
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(originX, originY, 3, 0, 2 * Math.PI);
  ctx.fill();
}

// Draw all nodes and connections for current layer
function drawNodesAndConnections() {
  // Check if there are nodes to draw
  if (!nodeGraph[view.layer] || nodeGraph[view.layer].length === 0) {
    console.log("No nodes to draw in layer:", view.layer);
    return;
  }
  
  console.log("Drawing nodes for layer:", view.layer, "- Count:", nodeGraph[view.layer].filter(n => n !== null).length);
  
  // Draw connections
  ctx.strokeStyle = editorStyle.connectionColor;
  ctx.lineWidth = editorStyle.connectionWidth;
  
  for (let i = 0; i < nodeGraph[view.layer].length; i++) {
    if (!nodeGraph[view.layer][i]) {
      continue;
    }
    
    let node = nodeGraph[view.layer][i];
    for (let j = 0; j < node.connections.length; j++) {
      if (!node.connections[j].flags || !node.connections[j].flags.includes("layerChange")) {
        let node2Id = node.connections[j].id;
        let node2 = nodeGraph[view.layer][node2Id];
        if (node2) {
          ctx.beginPath();
          ctx.moveTo(...posToCanvasPos(node.x, node.y));
          ctx.lineTo(...posToCanvasPos(node2.x, node2.y));
          ctx.stroke();
        }
      }
    }
  }
  
  // Draw nodes
  for (let i = 0; i < nodeGraph[view.layer].length; i++) {
    if (!nodeGraph[view.layer][i]) {
      continue;
    }
    
    let node = nodeGraph[view.layer][i];
    
    // Use a larger node radius to make them more visible
    const nodeColor = node.type && nodeTypes[node.type] ? 
      nodeTypes[node.type].color : editorStyle.nodeColor;
    
    // Draw filled circle for the node
    ctx.fillStyle = nodeColor;
    const [x, y] = posToCanvasPos(node.x, node.y);
    ctx.beginPath();
    ctx.arc(x, y, editorStyle.nodeRadius * 1.5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw border around node
    if (node.constraints && node.constraints.includes("endpoint")) {
      // Draw a thicker border for endpoint nodes in a distinct color
      ctx.strokeStyle = "#ff3b30"; // Use a bright red for endpoints
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
    }
    ctx.stroke();
    
    // Draw node name if it exists
    if (node.name) {
      ctx.fillStyle = "#000000";
      ctx.font = "10px Arial";
      ctx.fillText(node.name, x + 8, y);
    }
    
    // Draw endpoint indicator if applicable
    if (node.constraints && node.constraints.includes("endpoint")) {
      ctx.fillStyle = "#ff3b30";
      ctx.font = "bold 10px Arial";
      ctx.fillText("⊗", x - 12, y - 10); // Symbol for endpoint
    }

    // NEW CODE: Draw floor change indicators for nodes connected to other floors
    if (hasFloorChangeConnections(node)) {
      drawFloorChangeIndicator(node, x, y);
    }
  }
  
  // Highlight selected node
  if (editorSelectedNode) {
    const [x, y] = posToCanvasPos(editorSelectedNode.x, editorSelectedNode.y);
    ctx.strokeStyle = editorStyle.nodeHighlightColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, editorStyle.nodeRadius * 2, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

/**
 * Check if a node has connections to other floors
 */
function hasFloorChangeConnections(node) {
  if (!node.connections) return false;
  
  for (let i = 0; i < node.connections.length; i++) {
    const conn = node.connections[i];
    if (conn.layer && conn.layer !== node.layer) {
      return true;
    }
  }
  
  return false;
}

/**
 * Draw a floor change indicator for a node
 */
function drawFloorChangeIndicator(node, x, y) {
  // Get connected layers
  const connectedLayers = [];
  
  for (let i = 0; i < node.connections.length; i++) {
    const conn = node.connections[i];
    if (conn.layer && conn.layer !== node.layer && !connectedLayers.includes(conn.layer)) {
      connectedLayers.push(conn.layer);
    }
  }
  
  // Draw indicator icon based on node type (elevator or stairs)
  const isElevator = node.type === "elevator";
  const isStairs = node.type === "stairs";
  
  // Background for the indicator
  ctx.fillStyle = isElevator ? "#F8BBD0" : isStairs ? "#FFE0B2" : "#B3E5FC";
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  
  // Draw a small icon above the node
  const iconX = x;
  const iconY = y - 15;
  const iconSize = 12;
  
  // Background circle
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  
  // Icon symbol
  ctx.fillStyle = "#333";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  if (isElevator) {
    ctx.fillText("⇅", iconX, iconY); // Elevator symbol
  } else if (isStairs) {
    ctx.fillText("⥮", iconX, iconY); // Stairs symbol
  } else {
    ctx.fillText("⇵", iconX, iconY); // Generic floor change
  }
  
  // Store information for click handling
  if (!window.floorChangeIndicators) {
    window.floorChangeIndicators = [];
  }
  
  // Add this indicator to the tracking array for click detection
  window.floorChangeIndicators.push({
    x: iconX,
    y: iconY,
    radius: iconSize,
    node: node,
    connectedLayers: connectedLayers
  });
}

/**
 * Handle click events on floor change indicators
 * Add this to the handleMouseDown function in editor.js
 */
function handleFloorChangeIndicatorClick(event) {
  if (!window.floorChangeIndicators || window.floorChangeIndicators.length === 0) {
    return false;
  }
  
  const mouseX = event.pageX;
  const mouseY = event.pageY;
  
  // Check if click is on a floor change indicator
  for (let i = 0; i < window.floorChangeIndicators.length; i++) {
    const indicator = window.floorChangeIndicators[i];
    const dx = mouseX - indicator.x;
    const dy = mouseY - indicator.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance <= indicator.radius) {
      // Show floor change dialog
      showFloorChangeDialog(indicator.node, indicator.connectedLayers);
      return true; // Indicator was clicked
    }
  }
  
  return false; // No indicator was clicked
}

/**
 * Show a dialog for changing floors
 */
function showFloorChangeDialog(node, connectedLayers) {
  // Create modal dialog
  const dialog = document.createElement("div");
  dialog.className = "floor-change-dialog";
  dialog.style.position = "fixed";
  dialog.style.top = "50%";
  dialog.style.left = "50%";
  dialog.style.transform = "translate(-50%, -50%)";
  dialog.style.backgroundColor = "white";
  dialog.style.padding = "20px";
  dialog.style.borderRadius = "8px";
  dialog.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  dialog.style.zIndex = "1000";
  dialog.style.width = "300px";
  
  // Create dialog content
  dialog.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 15px;">Floor Change</h3>
    <p>${node.name || 'This location'} connects to:</p>
    <div id="floorOptions" style="margin-bottom: 15px;"></div>
    <div style="text-align: right;">
      <button id="cancelFloorChange" style="padding: 5px 10px; margin-right: 5px;">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Add connected layer options
  const floorOptions = document.getElementById("floorOptions");
  
  connectedLayers.forEach(layer => {
    // Find the destination node on that layer
    let destinationNode = null;
    for (let i = 0; i < node.connections.length; i++) {
      const conn = node.connections[i];
      if (conn.layer === layer) {
        destinationNode = nodeGraph[layer][conn.id];
        break;
      }
    }
    
    // Create a button for this layer
    const button = document.createElement("button");
    button.style.display = "block";
    button.style.width = "100%";
    button.style.padding = "8px";
    button.style.margin = "5px 0";
    button.style.textAlign = "left";
    button.style.backgroundColor = "#f0f0f0";
    button.style.border = "1px solid #ddd";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    
    // Format display name
    let displayName = layer;
    if (layer === "outside") {
      displayName = "Outside";
    } else if (layer.startsWith("floor")) {
      displayName = "Floor " + layer.substring(5);
    }
    
    button.innerHTML = `
      <strong>${displayName}</strong>
      ${destinationNode && destinationNode.name ? `<br><span style="font-size: 0.9em;">To: ${destinationNode.name}</span>` : ''}
    `;
    
    // Add click handler
    button.addEventListener("click", function() {
      // Change to the selected layer
      view.layer = layer;
      
      // Update the layer dropdown
      const layerSelect = document.getElementById("layerSelect");
      if (layerSelect) {
        layerSelect.value = layer;
      }
      
      // If we have a destination node, center view on it
      if (destinationNode) {
        view.x = -destinationNode.x;
        view.y = -destinationNode.y;
      }
      
      // Remove the dialog
      document.body.removeChild(dialog);
      
      // Update the display
      redraw();
    });
    
    floorOptions.appendChild(button);
  });
  
  // Add cancel button handler
  document.getElementById("cancelFloorChange").addEventListener("click", function() {
    document.body.removeChild(dialog);
  });
}

// Draw a node with its type-specific styling
function drawNodeWithType(node) {
    const nodeColor = node.type && nodeTypes && nodeTypes[node.type] ? 
        nodeTypes[node.type].color : editorStyle.nodeColor;
    
    const isHighlighted = (editorSelectedNode && editorSelectedNode.id === node.id);
    const color = isHighlighted ? editorStyle.nodeHighlightColor : nodeColor;
    
    // Draw circle for the node
    drawCircle(node.x, node.y, editorStyle.nodeRadius, color, node.type !== "regular");
    
    // Draw node name if it exists
    if (node.name) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px Arial";
        ctx.fillText(node.name, ...posToCanvasPos(node.x + 8, node.y));
    }
}

// Show the node panel when a node is selected
function showNodePanel(node) {
  if (!node) {
    console.log("Cannot show node panel: no node provided");
    return;
  }
  
  console.log("Showing node panel for node:", node);
  
  // Get the node panel element
  const nodePanel = document.getElementById("nodePanel");
  if (!nodePanel) {
    console.error("Node panel element not found in the DOM");
    return;
  }
  
  // Ensure the panel is visible
  nodePanel.style.display = "block";
  
  // Set node coordinates
  const xInput = document.getElementById("nodeX");
  const yInput = document.getElementById("nodeY");
  
  if (xInput) xInput.value = node.x;
  if (yInput) yInput.value = node.y;
  
  // Set node name
  const nameInput = document.getElementById("nodeName");
  if (nameInput) {
    nameInput.value = node.name || "";
  }
  
  // Set node type
  const typeSelect = document.getElementById("nodeType");
  if (typeSelect) {
    typeSelect.value = node.type || "regular";
  }
  
  // Add node constraints section
  const existingConstraintsDiv = document.getElementById("nodeConstraintsDiv");
  if (existingConstraintsDiv) {
    existingConstraintsDiv.remove();
  }
  
  const constraintsDiv = document.createElement("div");
  constraintsDiv.id = "nodeConstraintsDiv";
  constraintsDiv.className = "mb-2";
  
  // Create the constraints UI
  const constraintsLabel = document.createElement("label");
  constraintsLabel.className = "block text-xs font-medium";
  constraintsLabel.textContent = "Node Constraints:";
  constraintsDiv.appendChild(constraintsLabel);
  
  // Create endpoint checkbox
  const endpointDiv = document.createElement("div");
  endpointDiv.className = "flex items-center mt-1";
  
  const endpointCheckbox = document.createElement("input");
  endpointCheckbox.type = "checkbox";
  endpointCheckbox.id = "constraintEndpoint";
  endpointCheckbox.className = "mr-2";
  // Set checked state based on node constraints
  endpointCheckbox.checked = node.constraints && node.constraints.includes("endpoint");
  
  const endpointLabel = document.createElement("label");
  endpointLabel.htmlFor = "constraintEndpoint";
  endpointLabel.className = "text-xs";
  endpointLabel.textContent = "Endpoint Node (start/end only, no pass-through)";
  
  endpointDiv.appendChild(endpointCheckbox);
  endpointDiv.appendChild(endpointLabel);
  constraintsDiv.appendChild(endpointDiv);
  
  // Add the constraints div after node type
  if (typeSelect && typeSelect.parentNode) {
    typeSelect.parentNode.after(constraintsDiv);
  }
  
  // Add a button to add layer change connection
  const existingConnectBtn = document.getElementById("connectLayerBtn");
  if (existingConnectBtn) {
    existingConnectBtn.remove();
  }
  
  const connectLayerButton = document.createElement("button");
  connectLayerButton.id = "connectLayerBtn";
  connectLayerButton.textContent = "Connect to Other Layer";
  connectLayerButton.className = "w-full bg-blue-300 text-white text-xs p-1 rounded mt-2 mb-2";
  connectLayerButton.addEventListener("click", () => {
    showLayerChangeUI();
  });
  
  // Add the button after the constraints div
  constraintsDiv.after(connectLayerButton);

  // Handle delete button
  let existingDeleteBtn = document.getElementById("deleteNodeBtn");
  if (existingDeleteBtn) {
    existingDeleteBtn.remove();
  }

  const deleteButton = document.createElement("button");
  deleteButton.id = "deleteNodeBtn";
  deleteButton.textContent = "Delete Node";
  deleteButton.style.marginTop = "6px";

  // When clicked, set the global editorSelectedNode = this node, then call deleteSelectedNode()
  deleteButton.addEventListener("click", () => {
    editorSelectedNode = node;
    deleteSelectedNode();
  });

  // Append this button at the bottom of the panel
  nodePanel.appendChild(deleteButton);
  
  // Update connections list
  updateConnectionsList(node);
}


// Update the list of connections in the panel
function updateConnectionsList(node) {
    const connectionsDiv = document.getElementById("nodeConnections");
    if (!connectionsDiv) return;
    
    connectionsDiv.innerHTML = "";
    
    if (!node.connections || node.connections.length === 0) {
        connectionsDiv.innerHTML = "<p>No connections</p>";
        return;
    }
    
    // Create a table for connections
    const table = document.createElement("table");
    table.className = "connections-table";
    table.innerHTML = `
        <tr>
            <th>ID</th>
            <th>Layer</th>
            <th>Flags</th>
        </tr>
    `;
    
    for (const connection of node.connections) {
        const connectedNode = connection.flags && connection.flags.includes("layerChange") 
            ? (nodeGraph[connection.layer] ? nodeGraph[connection.layer][connection.id] : null)
            : nodeGraph[node.layer][connection.id];
        
        if (!connectedNode) continue;
        
        const row = document.createElement("tr");
        
        // ID cell
        const idCell = document.createElement("td");
        idCell.textContent = connectedNode.id;
        idCell.title = connectedNode.name || `Node ${connectedNode.id}`;
        row.appendChild(idCell);
        
        // Layer cell
        const layerCell = document.createElement("td");
        layerCell.textContent = connectedNode.layer;
        row.appendChild(layerCell);
        
        // Flags cell
        const flagsCell = document.createElement("td");
        flagsCell.textContent = connection.flags ? connection.flags.join(", ") : "";
        row.appendChild(flagsCell);
        
        table.appendChild(row);
    }
    
    connectionsDiv.appendChild(table);
}

// Update a node's name
function updateNodeName() {
    if (!editorSelectedNode) return;
    
    const nameInput = document.getElementById("nodeName");
    if (!nameInput) return;
    
    const name = nameInput.value;
    
    // Update the node
    editorSelectedNode.name = name;
    
    // Update in namedNodes array if not already there
    if (name) {
        let found = false;
        
        for (let i = 0; i < namedNodes[editorSelectedNode.layer].length; i++) {
            if (namedNodes[editorSelectedNode.layer][i].id === editorSelectedNode.id) {
                namedNodes[editorSelectedNode.layer][i].name = name;
                found = true;
                break;
            }
        }
        
        if (!found) {
            namedNodes[editorSelectedNode.layer].push({
                id: editorSelectedNode.id,
                name: name
            });
        }
    }
    
    console.log("Updated node name to:", name);
    redraw();
}

// Update node flags (stairs/elevator)
function updateNodeFlags() {
    if (!editorSelectedNode) return;
    
    // Initialize flags array if it doesn't exist
    if (!editorSelectedNode.flags) {
        editorSelectedNode.flags = [];
    }
    
    const stairsCheckbox = document.getElementById("isStairs");
    const elevatorCheckbox = document.getElementById("isElevator");
    
    if (!stairsCheckbox || !elevatorCheckbox) return;
    
    const isStairs = stairsCheckbox.checked;
    const isElevator = elevatorCheckbox.checked;
    
    // Update stairs flag
    const stairsIndex = editorSelectedNode.flags.indexOf("stairs");
    if (isStairs && stairsIndex === -1) {
        editorSelectedNode.flags.push("stairs");
    } else if (!isStairs && stairsIndex !== -1) {
        editorSelectedNode.flags.splice(stairsIndex, 1);
    }
    
    // Update elevator flag
    const elevatorIndex = editorSelectedNode.flags.indexOf("elevator");
    if (isElevator && elevatorIndex === -1) {
        editorSelectedNode.flags.push("elevator");
    } else if (!isElevator && elevatorIndex !== -1) {
        editorSelectedNode.flags.splice(elevatorIndex, 1);
    }
    
    console.log("Updated node flags:", editorSelectedNode.flags);
    redraw();
}

// Show UI for adding a layer change connection
function showLayerChangeUI() {
  if (!editorSelectedNode) return;
  
  console.log("Opening layer change UI for node:", editorSelectedNode);
  
  // Create a modal for selecting layer and node
  const modal = document.createElement("div");
  modal.className = "layer-change-modal";
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.backgroundColor = "white";
  modal.style.padding = "20px";
  modal.style.borderRadius = "10px";
  modal.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
  modal.style.zIndex = "1000";
  
  modal.innerHTML = `
      <div class="modal-content">
          <h3>Add Layer Change Connection</h3>
          <div>
              <label for="targetLayer">Target Layer:</label>
              <select id="targetLayer"></select>
          </div>
          <div style="margin-top: 10px;">
              <label for="targetNode">Target Node:</label>
              <select id="targetNode"></select>
          </div>
          <div style="margin-top: 10px;">
              <label>Connection Type:</label>
              <div>
                  <input type="radio" id="modalConnTypeAuto" name="connType" value="auto" checked>
                  <label for="modalConnTypeAuto">Automatic (based on node types)</label>
              </div>
              <div>
                  <input type="radio" id="modalConnTypeStairs" name="connType" value="stairs">
                  <label for="modalConnTypeStairs">Stairs</label>
              </div>
              <div>
                  <input type="radio" id="modalConnTypeElevator" name="connType" value="elevator">
                  <label for="modalConnTypeElevator">Elevator</label>
              </div>
              <div>
                  <input type="radio" id="modalConnTypeRegular" name="connType" value="regular">
                  <label for="modalConnTypeRegular">Regular</label>
              </div>
          </div>
          <div style="margin-top: 15px; text-align: center;">
              <button id="confirmLayerChange" style="margin-right: 10px; padding: 5px 10px;">Add Connection</button>
              <button id="cancelLayerChange" style="padding: 5px 10px;">Cancel</button>
          </div>
      </div>
  `;
  
  document.body.appendChild(modal);
  
  // Populate layer dropdown
  const layerSelect = document.getElementById("targetLayer");
  for (const layer of loadedLayers) {
      if (layer !== editorSelectedNode.layer) {
          const option = document.createElement("option");
          option.value = layer;
          option.textContent = layer;
          layerSelect.appendChild(option);
      }
  }
  
  // Function to update node dropdown when layer changes
  const updateNodeDropdown = () => {
      const nodeSelect = document.getElementById("targetNode");
      nodeSelect.innerHTML = "";
      
      const selectedLayer = layerSelect.value;
      if (!selectedLayer || !nodeGraph[selectedLayer]) return;
      
      for (let i = 0; i < nodeGraph[selectedLayer].length; i++) {
          const node = nodeGraph[selectedLayer][i];
          if (!node) continue;
          
          const option = document.createElement("option");
          option.value = node.id;
          option.textContent = node.name ? `${node.id}: ${node.name}` : `Node ${node.id}`;
          // Highlight stairs/elevator nodes in the dropdown
          if (node.type === "stairs" || node.type === "elevator") {
              option.textContent += ` (${node.type})`;
              option.style.fontWeight = "bold";
          }
          nodeSelect.appendChild(option);
      }
      
      // Auto-select a matching stairs/elevator node if possible
      if (editorSelectedNode.type === "stairs" || editorSelectedNode.type === "elevator") {
          for (let i = 0; i < nodeSelect.options.length; i++) {
              const node = nodeGraph[selectedLayer][nodeSelect.options[i].value];
              if (node && node.type === editorSelectedNode.type) {
                  nodeSelect.selectedIndex = i;
                  break;
              }
          }
      }
  };
  
  // Initial population of node dropdown
  layerSelect.addEventListener("change", updateNodeDropdown);
  updateNodeDropdown();
  
  // Handle add connection button
  document.getElementById("confirmLayerChange").addEventListener("click", () => {
      const targetLayer = layerSelect.value;
      const targetNodeId = parseInt(document.getElementById("targetNode").value);
      const connType = document.querySelector('input[name="connType"]:checked').value;
      
      if (!targetLayer || !nodeGraph[targetLayer]) {
          alert("Please select a valid target layer");
          return;
      }
      
      const targetNode = nodeGraph[targetLayer][targetNodeId];
      if (!targetNode) {
          alert("Please select a valid target node");
          return;
      }
      
      // Determine connection type based on selected option or node types
      let connectionFlags = ["layerChange"];
      if (connType === "stairs" || (connType === "auto" && 
          (editorSelectedNode.type === "stairs" || targetNode.type === "stairs"))) {
          connectionFlags.push("stairs");
      } else if (connType === "elevator" || (connType === "auto" && 
          (editorSelectedNode.type === "elevator" || targetNode.type === "elevator"))) {
          connectionFlags.push("elevator");
      }
      
      // Add connection to selected node
      editorSelectedNode.connections.push({
          id: targetNodeId,
          layer: targetLayer,
          flags: connectionFlags
      });
      
      // Add reverse connection
      targetNode.connections.push({
          id: editorSelectedNode.id,
          layer: editorSelectedNode.layer,
          flags: connectionFlags
      });
      
      console.log("Added layer change connection from", editorSelectedNode, "to", targetNode, 
                  "with flags:", connectionFlags.join(", "));
      
      // Update UI and remove modal
      updateConnectionsList(editorSelectedNode);
      document.body.removeChild(modal);
      redraw();
  });
  
  // Handle cancel button
  document.getElementById("cancelLayerChange").addEventListener("click", () => {
      document.body.removeChild(modal);
  });
}


// Set up editor buttons
const editorButtons = document.querySelectorAll('.editor-buttons button');
if (editorButtons.length > 0) {
  editorButtons.forEach(button => {
    button.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      setEditorMode(mode);
    });
  });
  console.log("Editor buttons initialized");
} else {
  console.warn("Editor buttons not found");
}

// Set up zoom controls
const zoomInBtn = document.getElementById('zoomIn');
if (zoomInBtn) {
  zoomInBtn.addEventListener('click', function() {
    view.zoom = Math.min(view.zoom * 1.2, 5);
    redraw();
  });
}

const zoomOutBtn = document.getElementById('zoomOut');
if (zoomOutBtn) {
  zoomOutBtn.addEventListener('click', function() {
    view.zoom = Math.max(view.zoom / 1.2, 0.2);
    redraw();
  });
}

// Close node panel button
const closeNodePanelBtn = document.getElementById('closeNodePanel');
if (closeNodePanelBtn) {
  closeNodePanelBtn.addEventListener('click', function() {
    const nodePanel = document.getElementById('nodePanel');
    if (nodePanel) {
      nodePanel.style.display = 'none';
      editorSelectedNode = null;
      redraw();
    }
  });
}

// Save node data button
const saveNodeDataBtn = document.getElementById('saveNodeData');
if (saveNodeDataBtn) {
  saveNodeDataBtn.addEventListener('click', function() {
    if (!editorSelectedNode) return;
    
    // Update node properties
    const nameInput = document.getElementById('nodeName');
    const xInput = document.getElementById('nodeX');
    const yInput = document.getElementById('nodeY');
    const typeSelect = document.getElementById('nodeType');
    
    if (nameInput) editorSelectedNode.name = nameInput.value;
    if (xInput) editorSelectedNode.x = parseFloat(xInput.value);
    if (yInput) editorSelectedNode.y = parseFloat(yInput.value);
    if (typeSelect) editorSelectedNode.type = typeSelect.value;
    
    // Update constraints
    if (!editorSelectedNode.constraints) {
      editorSelectedNode.constraints = [];
    }
    
    const endpointCheckbox = document.getElementById('constraintEndpoint');
    if (endpointCheckbox) {
      const isEndpoint = endpointCheckbox.checked;
      const constraintIndex = editorSelectedNode.constraints.indexOf("endpoint");
      
      if (isEndpoint && constraintIndex === -1) {
        editorSelectedNode.constraints.push("endpoint");
      } else if (!isEndpoint && constraintIndex !== -1) {
        editorSelectedNode.constraints.splice(constraintIndex, 1);
      }
    }
    
    // Update named nodes array
    if (editorSelectedNode.name) {
      let foundNamedNode = false;
      for (let i = 0; i < namedNodes[editorSelectedNode.layer].length; i++) {
        if (namedNodes[editorSelectedNode.layer][i].id === editorSelectedNode.id) {
          namedNodes[editorSelectedNode.layer][i].name = editorSelectedNode.name;
          foundNamedNode = true;
          break;
        }
      }
      
      if (!foundNamedNode) {
        namedNodes[editorSelectedNode.layer].push({
          id: editorSelectedNode.id,
          name: editorSelectedNode.name
        });
      }
      
      // Update suggestions
      populateSuggestions();
    }
    
    // Hide panel
    document.getElementById('nodePanel').style.display = 'none';
    
    redraw();
  });
}

function drawBackgroundImage() {
  const bg = backgroundImages[view.layer];
  if (!bg || !bg.image) return;

  const [canvasX, canvasY] = posToCanvasPos(bg.x, bg.y);
  
  // Apply zoom to width and height
  const width = bg.width * view.zoom;
  const height = bg.height * view.zoom;

  ctx.globalAlpha = bg.opacity ?? 0.5;
  ctx.drawImage(bg.image, canvasX, canvasY, width, height);
  ctx.globalAlpha = 1.0;
}

function alignBackgroundToGrid() {
  if (!backgroundImages[view.layer]) return;
  
  const gridSize = 50; // Make sure this matches your grid size
  
  // Snap to grid
  backgroundImages[view.layer].x = Math.round(backgroundImages[view.layer].x / gridSize) * gridSize;
  backgroundImages[view.layer].y = Math.round(backgroundImages[view.layer].y / gridSize) * gridSize;
  
  console.log(`Background aligned to grid at (${backgroundImages[view.layer].x}, ${backgroundImages[view.layer].y})`);
  redraw();
}

// Update background image UI
function updateBackgroundImageUI() {
  const bgControls = document.getElementById('backgroundControls');
  const hasImage = !!backgroundImages[view.layer];
  
  if (bgControls) {
    // Show/hide controls based on whether there's an image
    document.getElementById('backgroundControls').style.display = hasImage ? 'block' : 'none';
    
    if (hasImage) {
      // Update opacity slider
      const opacitySlider = document.getElementById('bgOpacity');
      if (opacitySlider) {
        opacitySlider.value = backgroundImages[view.layer].opacity * 100;
      }
    }
  }
}

// Initialize drawing mode
drawNodes = true; // Start with nodes visible for easier editing

console.log("Extended UI initialization complete");