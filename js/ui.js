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
    console.log("Drawing node:", node.id, "at position:", node.x, node.y);
    
    // Use a larger node radius to make them more visible
    const nodeColor = node.type && nodeTypes[node.type] ? 
      nodeTypes[node.type].color : editorStyle.nodeColor;
    
    // Draw filled circle for the node
    ctx.fillStyle = nodeColor;
    const [x, y] = posToCanvasPos(node.x, node.y);
    ctx.beginPath();
    ctx.arc(x, y, editorStyle.nodeRadius * 1.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Draw node name if it exists
    if (node.name) {
      ctx.fillStyle = "#000000";
      ctx.font = "10px Arial";
      ctx.fillText(node.name, x + 8, y);
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
                    <input type="checkbox" id="modalIsStairs">
                    <label for="modalIsStairs">Stairs</label>
                </div>
                <div>
                    <input type="checkbox" id="modalIsElevator">
                    <label for="modalIsElevator">Elevator</label>
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
            nodeSelect.appendChild(option);
        }
    };
    
    // Initial population of node dropdown
    layerSelect.addEventListener("change", updateNodeDropdown);
    updateNodeDropdown();
    
    // Handle add connection button
    document.getElementById("confirmLayerChange").addEventListener("click", () => {
        const targetLayer = layerSelect.value;
        const targetNodeId = parseInt(document.getElementById("targetNode").value);
        const isStairs = document.getElementById("modalIsStairs").checked;
        const isElevator = document.getElementById("modalIsElevator").checked;
        
        if (!targetLayer || !nodeGraph[targetLayer]) {
            alert("Please select a valid target layer");
            return;
        }
        
        const targetNode = nodeGraph[targetLayer][targetNodeId];
        if (!targetNode) {
            alert("Please select a valid target node");
            return;
        }
        
        // Create connection with layer change
        const connection = {
            id: targetNodeId,
            layer: targetLayer,
            flags: ["layerChange"]
        };
        
        // Add stairs/elevator flags
        if (isStairs) connection.flags.push("stairs");
        if (isElevator) connection.flags.push("elevator");
        
        // Add connection to selected node
        editorSelectedNode.connections.push(connection);
        
        // Add reverse connection
        const reverseConnection = {
            id: editorSelectedNode.id,
            layer: editorSelectedNode.layer,
            flags: [...connection.flags]
        };
        
        targetNode.connections.push(reverseConnection);
        
        console.log("Added layer change connection from", editorSelectedNode, "to", targetNode);
        
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

// Toggle editor tools visibility
const toggleEditorBtn = document.getElementById('toggleEditor');
if (toggleEditorBtn) {
  toggleEditorBtn.addEventListener('click', function() {
    const editorTools = document.getElementById('editorTools');
    if (editorTools) {
      const isVisible = editorTools.style.display !== 'none';
      editorTools.style.display = isVisible ? 'none' : 'block';
      this.textContent = isVisible ? 'Show Editor Tools' : 'Hide Editor Tools';
    }
  });
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

// Add double-click event listener only if canvas exists
if (canvas) {
  canvas.addEventListener('dblclick', handleDoubleClick);
} else {
  console.warn("Canvas element not found for dblclick listener");
}

// Initialize drawing mode
drawNodes = true; // Start with nodes visible for easier editing

console.log("Extended UI initialization complete");