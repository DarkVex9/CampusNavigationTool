/**
 * ui.js - User interface components and interactions
 */

// UI Elements
var mapImgElement = document.getElementById("mainMapImg");
var canvas = document.getElementById("overlay");
var ctx = canvas.getContext("2d");
var originField = document.getElementById("origin");
var destinationField = document.getElementById("destination");
var editorContainer = document.getElementById("editorTools");
var editorLayerSelect = document.getElementById("layerSelect");
var editorModeLabel = document.getElementById("editorMode");
var nodePanel = document.getElementById("nodePanel");

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
    hintColor: "#C9C5A9",
    areaStrokeColor: "#666666",
    areaStrokeWidth: 1,
    areaSelectedStrokeColor: "#EDC618",
    areaSelectedStrokeWidth: 2
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
    // Initialize canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Add event listeners
    document.getElementById("go_button").addEventListener("click", handleGoButton);
    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("wheel", handleScroll);
    
    if (editorLayerSelect) {
        editorLayerSelect.addEventListener("change", handleLayerDropdown);
    }
    
    // Initialize node properties panel
    initNodePanel();
    
    // Show editor tools if enabled
    if (editorAllowed) {
        editorContainer.style.display = "inline-block";
        
        // Initialize editor if the function exists
        if (typeof initEditor === 'function') {
            initEditor();
        }
    }
    
    // Handle window resize
    window.addEventListener("resize", function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        redraw();
    });
}

// Handle Go button click
function handleGoButton() {
    console.log("Go Button Pressed");
    
    if (Object.keys(nodeGraph).length === 0 || loadingCount !== 0) {
        console.log("Search canceled - Something isn't ready yet. \nWaiting on " + loadingCount + " files");
        return;    // Abort search
    }
    
    let startNode = findByName(originField.value);
    let endNode = findByName(destinationField.value);
    
    if (!startNode || !endNode) {
        console.log("Search canceled - Couldn't find node by name. \nStart String:'" + originField.value.trim() + "'\nEnd String:'" + destinationField.value.trim() + "'\nStart Found:" + startNode + "\nEnd Found:" + endNode);
        return;    // Abort search
    }
    
    // Get user preferences
    const preferences = getUserPreferences();
    console.log("User preferences:", preferences);
    
    // Find path with preferences
    let path = findPath(startNode, endNode, preferences);

    if (!path) {
        console.log("Path not found");
        return;    // Search failed
    }
    
    currentPath = path;
    
    // Generate path instructions if function exists
    if (typeof generatePathInstructions === 'function') {
        const instructions = generatePathInstructions(path);
        if (typeof showPathInstructions === 'function') {
            showPathInstructions(instructions);
        }
    }
    
    redraw();
}

// Handle layer dropdown change
function handleLayerDropdown() {
    view.layer = editorLayerSelect.value;
    redraw();
}

// Update the map image transform based on view
function updateMapImageTransform() {
    mapImgElement.style.transform = `scale(${view.zoom}) translate(${view.x + canvas.width/2/view.zoom}px, ${view.y + canvas.height/2/view.zoom}px)`;
}

// Redraw the canvas
function redraw() {
    // Update map image if layer changed
    if (view.layer != view.renderedLayer) {
        mapImgElement.src = "map_images/" + layerData[view.layer].mapImage;
        view.renderedLayer = view.layer;
    }
    
    updateMapImageTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw areas first (underneath everything else)
    drawAreas();
    
    // Draw current path if one exists
    if (currentPath) {
        drawPath(currentPath);
    }
    
    // Draw nodes and connections if enabled
    if (drawNodes) {
        // Draw connections
        ctx.strokeStyle = editorStyle.connectionColor;
        ctx.lineWidth = editorStyle.connectionWidth;
        ctx.beginPath();
        
        for (let i = 0; i < nodeGraph[view.layer].length; i++) {
            if (!nodeGraph[view.layer][i]) {
                continue;
            }
            
            let node = nodeGraph[view.layer][i];
            for (let j = 0; j < node.connections.length; j++) {
                if (!node.connections[j].flags || !node.connections[j].flags.includes("layerChange")) {
                    let node2 = nodeGraph[view.layer][node.connections[j].id];
                    ctx.moveTo(...nodeToCanvasPos(node));
                    ctx.lineTo(...nodeToCanvasPos(node2));
                }
            }
        }
        
        ctx.stroke();
        
        // Draw nodes
        for (let i = 0; i < nodeGraph[view.layer].length; i++) {
            if (!nodeGraph[view.layer][i]) {
                continue;
            }
            
            let node = nodeGraph[view.layer][i];
            drawNodeWithType(node);
        }
        
        // Highlight selected node
        if (editorSelectedNode) {
            drawCircle(editorSelectedNode.x, editorSelectedNode.y, editorStyle.nodeRadius + 2, editorStyle.nodeHighlightColor);
            drawCircle(editorSelectedNode.x, editorSelectedNode.y, editorStyle.nodeRadius/2, editorStyle.nodeHighlightColor);
        }
    }
    
    // Draw polygon in progress if in polygon drawing mode
    if (typeof isDrawingPolygon !== 'undefined' && isDrawingPolygon && typeof drawPolygonInProgress === 'function') {
        drawPolygonInProgress();
    }
}

// Draw all areas on the current layer
function drawAreas() {
    if (!areas[view.layer]) return;
    
    for (const area of areas[view.layer]) {
        if (!area.points || area.points.length < 3) continue;
        
        // Determine if this is the selected area
        const isSelected = (typeof editorSelectedArea !== 'undefined' && editorSelectedArea && editorSelectedArea.id === area.id);
        
        // Set fill color based on area type
        ctx.fillStyle = getAreaColor(area.type);
        ctx.strokeStyle = isSelected ? editorStyle.areaSelectedStrokeColor : editorStyle.areaStrokeColor;
        ctx.lineWidth = isSelected ? editorStyle.areaSelectedStrokeWidth : editorStyle.areaStrokeWidth;
        
        // Draw the polygon
        ctx.beginPath();
        ctx.moveTo(...posToCanvasPos(area.points[0].x, area.points[0].y));
        
        for (let i = 1; i < area.points.length; i++) {
            ctx.lineTo(...posToCanvasPos(area.points[i].x, area.points[i].y));
        }
        
        ctx.closePath();
        ctx.globalAlpha = 0.7; // Make areas semi-transparent
        ctx.fill();
        ctx.globalAlpha = 1.0; // Reset alpha for the stroke
        ctx.stroke();
        
        // Draw area name
        // Calculate center point of the polygon
        const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
        const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        
        ctx.fillStyle = "#333";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(area.name || `Area ${area.id}`, ...posToCanvasPos(centerX, centerY));
        
        // Draw area icon if the function exists
        if (typeof drawAreaIcon === 'function') {
            drawAreaIcon(area);
        }
    }
}

// Draw a node with its type-specific styling
function drawNodeWithType(node) {
    const nodeColor = node.type && nodeTypes[node.type] ? 
        nodeTypes[node.type].color : editorStyle.nodeColor;
    
    const isHighlighted = (typeof editorSelectedNode !== 'undefined' && 
                           editorSelectedNode && 
                           editorSelectedNode.id === node.id);
                           
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

// Draw an icon for a specific area type
function drawAreaIcon(area) {
    if (!area.type) return;
    
    // Skip if no special icon needed
    if (area.type === 'classroom' || area.type === 'office' || area.type === 'hallway') {
        return;
    }
    
    // Calculate position (top-left corner)
    const x = area.points[0].x;
    const y = area.points[0].y;
    const [canvasX, canvasY] = posToCanvasPos(x, y);
    
    // Draw icon background
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(canvasX + 12, canvasY + 12, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw icon based on type
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    
    switch (area.type) {
        case 'elevator':
            // Simple elevator icon
            ctx.beginPath();
            ctx.rect(canvasX + 7, canvasY + 7, 10, 10);
            ctx.moveTo(canvasX + 9, canvasY + 10);
            ctx.lineTo(canvasX + 15, canvasY + 10);
            ctx.moveTo(canvasX + 12, canvasY + 8);
            ctx.lineTo(canvasX + 12, canvasY + 16);
            ctx.stroke();
            break;
            
        case 'stairs':
            // Simple stairs icon
            ctx.beginPath();
            ctx.moveTo(canvasX + 7, canvasY + 17);
            ctx.lineTo(canvasX + 7, canvasY + 14);
            ctx.lineTo(canvasX + 10, canvasY + 14);
            ctx.lineTo(canvasX + 10, canvasY + 11);
            ctx.lineTo(canvasX + 13, canvasY + 11);
            ctx.lineTo(canvasX + 13, canvasY + 8);
            ctx.lineTo(canvasX + 17, canvasY + 8);
            ctx.stroke();
            break;
            
        case 'entrance':
            // Simple entrance icon
            ctx.beginPath();
            ctx.moveTo(canvasX + 7, canvasY + 12);
            ctx.lineTo(canvasX + 17, canvasY + 12);
            ctx.moveTo(canvasX + 14, canvasY + 8);
            ctx.lineTo(canvasX + 17, canvasY + 12);
            ctx.lineTo(canvasX + 14, canvasY + 16);
            ctx.stroke();
            break;
            
        case 'restroom':
            // Simple restroom icon
            ctx.beginPath();
            ctx.arc(canvasX + 10, canvasY + 9, 3, 0, 2 * Math.PI);
            ctx.moveTo(canvasX + 10, canvasY + 12);
            ctx.lineTo(canvasX + 10, canvasY + 15);
            ctx.moveTo(canvasX + 7, canvasY + 13);
            ctx.lineTo(canvasX + 13, canvasY + 13);
            ctx.stroke();
            break;
    }
}

// Initialize the node panel
function initNodePanel() {
    // Hide the panel initially
    nodePanel.style.display = "none";
    
    // Add event listeners for the node panel UI elements
    document.getElementById("nodeName").addEventListener("change", updateNodeName);
    document.getElementById("isStairs").addEventListener("change", updateNodeFlags);
    document.getElementById("isElevator").addEventListener("change", updateNodeFlags);
    document.getElementById("addLayerChangeConnection").addEventListener("click", showLayerChangeUI);
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
    
    // Position the panel in the top right corner
    nodePanel.style.position = "absolute";
    nodePanel.style.top = "20px";
    nodePanel.style.right = "20px";
    
    // Set node name
    const nameInput = document.getElementById("nodeName");
    if (nameInput) {
        nameInput.value = node.name || "";
    }
    
    // Set node flags
    const stairsCheckbox = document.getElementById("isStairs");
    const elevatorCheckbox = document.getElementById("isElevator");
    
    if (stairsCheckbox) {
        stairsCheckbox.checked = node.flags && node.flags.includes("stairs");
    }
    
    if (elevatorCheckbox) {
        elevatorCheckbox.checked = node.flags && node.flags.includes("elevator");
    }
    
    // Update connections list
    updateConnectionsList(node);
}

// Update the list of connections in the panel
function updateConnectionsList(node) {
    const connectionsDiv = document.getElementById("nodeConnections");
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
            ? nodeGraph[connection.layer][connection.id]
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
    
    const name = document.getElementById("nodeName").value;
    
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
    
    const isStairs = document.getElementById("isStairs").checked;
    const isElevator = document.getElementById("isElevator").checked;
    
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
    
    // Create a modal for selecting layer and node
    const modal = document.createElement("div");
    modal.className = "layer-change-modal";
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Add Layer Change Connection</h3>
            <div>
                <label for="targetLayer">Target Layer:</label>
                <select id="targetLayer"></select>
            </div>
            <div>
                <label for="targetNode">Target Node:</label>
                <select id="targetNode"></select>
            </div>
            <div>
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
            <div class="modal-buttons">
                <button id="confirmLayerChange">Add Connection</button>
                <button id="cancelLayerChange">Cancel</button>
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
        if (!selectedLayer) return;
        
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
        
        const targetNode = nodeGraph[targetLayer][targetNodeId];
        if (!targetNode) return;
        
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

// Generate and display path instructions
function generatePathInstructions(path) {
    if (!path || path.length < 2) return [];
    
    const instructions = [];
    let currentDirection = null;
    
    for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i+1];
        
        // Skip if not in the same layer (separate instruction for layer change)
        if (current.layer !== next.layer) {
            if (current.flags && current.flags.includes("elevator") || 
                (current.connections.some(c => c.id === next.id && c.flags && c.flags.includes("elevator")))) {
                instructions.push({
                    type: 'elevator',
                    text: `Take elevator to ${next.layer}`,
                    icon: 'elevator',
                    node: current.id
                });
            } else if (current.flags && current.flags.includes("stairs") || 
                      (current.connections.some(c => c.id === next.id && c.flags && c.flags.includes("stairs")))) {
                instructions.push({
                    type: 'stairs',
                    text: `Take stairs to ${next.layer}`,
                    icon: 'stairs',
                    node: current.id
                });
            } else {
                instructions.push({
                    type: 'layer-change',
                    text: `Change to ${next.layer}`,
                    icon: 'layer-change',
                    node: current.id
                });
            }
            continue;
        }
        
        // Calculate direction
        const angle = Math.atan2(next.y - current.y, next.x - current.x) * 180 / Math.PI;
        const direction = getDirectionFromAngle(angle);
        
        // Check if destination is a named location
        const isDestination = (i === path.length - 2);
        const destName = next.name || `Node ${next.id}`;
        
        if (currentDirection !== direction || isDestination) {
            instructions.push({
                type: direction.toLowerCase(),
                text: isDestination ? 
                    `Arrive at ${destName}` : 
                    `Go ${direction.toLowerCase()}`,
                icon: direction.toLowerCase(),
                node: current.id
            });
            currentDirection = direction;
        }
    }
    
    return instructions;
}

// Show path instructions in the UI
function showPathInstructions(instructions) {
    if (!instructions || instructions.length === 0) {
        if (document.getElementById('instructionPanel')) {
            document.getElementById('instructionPanel').style.display = 'none';
        }
        return;
    }
    
    // Create or get the instruction panel
    let panel = document.getElementById('instructionPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'instructionPanel';
        panel.className = 'ui_panel instruction-panel';
        document.body.appendChild(panel);
    }
    
    panel.style.display = 'block';
    
    // Show first instruction
    const currentInstruction = instructions[0];
    
    panel.innerHTML = `
        <div class="instruction-icon ${currentInstruction.icon || 'default'}"></div>
        <div class="instruction-text">
            <p class="instruction-main">${currentInstruction.text}</p>
            <p class="instruction-detail">${getInstructionDetail(currentInstruction)}</p>
        </div>
        <div class="instruction-step">Step 1/${instructions.length}</div>
    `;
    
    // Position at bottom center
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.left = '50%';
    panel.style.transform = 'translateX(-50%)';
    panel.style.zIndex = '1000';
}

// Get direction name from angle
function getDirectionFromAngle(angle) {
    // Convert angle to 0-360 range
    angle = (angle + 360) % 360;
    
    if (angle >= 337.5 || angle < 22.5) return 'East';
    if (angle >= 22.5 && angle < 67.5) return 'Northeast';
    if (angle >= 67.5 && angle < 112.5) return 'North';
    if (angle >= 112.5 && angle < 157.5) return 'Northwest';
    if (angle >= 157.5 && angle < 202.5) return 'West';
    if (angle >= 202.5 && angle < 247.5) return 'Southwest';
    if (angle >= 247.5 && angle < 292.5) return 'South';
    return 'Southeast';
}

// Get details for an instruction
function getInstructionDetail(instruction) {
    switch (instruction.type) {
        case 'elevator':
            return 'Use the elevator to change floors';
        case 'stairs':
            return 'Take the stairs to change floors';
        case 'layer-change':
            return 'Move to the next area';
        case 'north':
        case 'northeast':
        case 'east':
        case 'southeast':
        case 'south':
        case 'southwest':
        case 'west':
        case 'northwest':
            return `Continue ${instruction.type}`;
        default:
            return '';
    }
}