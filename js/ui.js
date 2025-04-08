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
            drawCircle(editorSelectedNode.x, editorSelectedNode.y, editorStyle.nodeRadius, editorStyle.nodeHighlightColor);
            drawCircle(editorSelectedNode.x, editorSelectedNode.y, editorStyle.nodeRadius/2, editorStyle.nodeHighlightColor);
        }
    }
}

// Draw a node with its type-specific styling
function drawNodeWithType(node) {
    const nodeColor = node.type && nodeTypes[node.type] ? 
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
    if (!node) return;
    
    nodePanel.style.display = "block";
    
    // Set node name
    document.getElementById("nodeName").value = node.name || "";
    
    // Set node flags
    document.getElementById("isStairs").checked = node.flags && node.flags.includes("stairs");
    document.getElementById("isElevator").checked = node.flags && node.flags.includes("elevator");
    
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