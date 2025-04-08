/**
 * editor.js - Map editor functionality
 */

// Editor settings
var editorAllowed = true;
var editorMoveRange = 500;   // Max range that the move tool can grab a node from
var editorMode = "none";
var editorSelectedNode;
var editorSelectedArea;

// Polygon drawing state - moved to data.js to make sure it's accessible
// var polygonPoints = [];  
// var isDrawingPolygon = false;
var tempConnectingNode;
var tempIsHintDrawn = false;

// Handle key press events
function handleKeyPress(event) {
    console.log("Key Pressed - " + event.key);
    
    switch(event.key) {
        case "p":
            if (editorAllowed) {
                if (event.ctrlKey || event.metaKey) {
                    // "Print" current layer data with Ctrl+P
                    quantizeNodePositions();
                    console.log(JSON.stringify({
                        name: view.layer,
                        metadata: layerData[view.layer],
                        graph: nodeGraph[view.layer],
                        namedNodes: namedNodes[view.layer],
                        areas: areas[view.layer] || []
                    }));
                } else {
                    // "Polygon" editor mode with just P
                    console.log("Editor Mode - Polygon");
                    editorMode = "polygon";
                    editorModeLabel.innerText = "Editor Mode: Polygon";
                    polygonPoints = [];
                    isDrawingPolygon = true;
                    
                    // Clear selection
                    editorSelectedNode = null;
                    editorSelectedArea = null;
                }
            }
            break;
        case "u":
            // Quantize coordinates to save space in string form
            if (editorAllowed) {
                quantizeNodePositions();
            }
            break;
        case "a":
            // "Add" editor mode
            if (editorAllowed) {
                console.log("Editor Mode - Add");
                editorMode = "add";
                editorModeLabel.innerText = "Editor Mode: Add";
                editorSelectedArea = null;
            }
            break;
        case "m":
            // "Move" editor mode
            if (editorAllowed) {
                console.log("Editor Mode - Move");
                editorMode = "move";
                editorModeLabel.innerText = "Editor Mode: Move";
                editorSelectedArea = null;
            }
            break;
        case "e":
            // "Edit" editor mode
            if (editorAllowed) {
                console.log("Editor Mode - Edit");
                editorMode = "edit";
                editorModeLabel.innerText = "Editor Mode: Edit";
                
                // Show node panel if a node is already selected
                if (editorSelectedNode) {
                    console.log("Showing node panel for selected node");
                    showNodePanel(editorSelectedNode);
                    editorSelectedArea = null;
                } else {
                    console.log("No node selected yet");
                }
            }
            break;
        case "c":
            // "Connect" editor mode
            if (editorAllowed) {
                console.log("Editor Mode - Connect");
                editorMode = "connect";
                editorModeLabel.innerText = "Editor Mode: Connect";
                editorSelectedArea = null;
            }
            break;
        case "r":
            // "Area" editor mode - for selecting and editing areas
            if (editorAllowed) {
                console.log("Editor Mode - Area");
                editorMode = "area";
                editorModeLabel.innerText = "Editor Mode: Area";
                editorSelectedNode = null;
            }
            break;
        case "Escape":
            // Clear editor mode
            if (editorAllowed) {
                // Clear selected node if we are already in mode none
                if (editorMode == "none") {
                    editorSelectedNode = null;
                    editorSelectedArea = null;
                    redraw();
                }
                
                // Cancel polygon drawing if active
                if (isDrawingPolygon) {
                    isDrawingPolygon = false;
                    polygonPoints = [];
                }
                
                console.log("Editor Mode - None");
                editorMode = "none";
                editorModeLabel.innerText = "Editor Mode: None";
                
                // Hide node panel
                nodePanel.style.display = "none";
                
                // Hide area panel if it exists
                if (document.getElementById("areaPanel")) {
                    document.getElementById("areaPanel").style.display = "none";
                }
            }
            break;
        case "Backspace":
        case "Delete":
            // Delete selected node or area
            if (editorAllowed) {
                if (editorSelectedNode) {
                    while(editorSelectedNode.connections.length > 0) {
                        disconnectNodes(editorSelectedNode, nodeGraph[editorSelectedNode.layer][editorSelectedNode.connections[0].id]);
                    }
                    nodeGraph[editorSelectedNode.layer][editorSelectedNode.id] = null;
                    editorSelectedNode = null;
                    redraw();
                    
                    // Hide node panel
                    nodePanel.style.display = "none";
                } else if (editorSelectedArea && editorMode === "area") {
                    // Remove associated nodes first
                    if (editorSelectedArea.nodes && editorSelectedArea.nodes.length > 0) {
                        for (const nodeId of editorSelectedArea.nodes) {
                            const node = nodeGraph[editorSelectedArea.layer][nodeId];
                            if (node) {
                                // Disconnect node before removal
                                while(node.connections.length > 0) {
                                    disconnectNodes(node, nodeGraph[node.layer][node.connections[0].id]);
                                }
                                nodeGraph[node.layer][nodeId] = null;
                            }
                        }
                    }
                    
                    // Remove the area
                    const areaIndex = areas[view.layer].findIndex(a => a.id === editorSelectedArea.id);
                    if (areaIndex !== -1) {
                        areas[view.layer].splice(areaIndex, 1);
                    }
                    
                    editorSelectedArea = null;
                    redraw();
                    
                    // Hide area panel if it exists
                    if (document.getElementById("areaPanel")) {
                        document.getElementById("areaPanel").style.display = "none";
                    }
                }
            }
            break;
        case "d":
            // Toggle "Draw" nodes
            if (editorAllowed) {
                drawNodes = !drawNodes;
                console.log("Draw Nodes " + (drawNodes ? "Enabled" : "Disabled"));
                redraw();
            }
            break;
        case "z":
            // Auto-connect nearby area nodes
            if (editorAllowed && (event.ctrlKey || event.metaKey)) {
                console.log("Auto-connecting area nodes");
                autoConnectAreaNodes();
                redraw();
            }
            break;
    }
}

// Handle mouse down events
function handleMouseDown(event) {
    console.log("Mouse Down - Button:", event.button, "Position:", event.pageX, event.pageY);
    
    if (event.button != 0) {
        return;     // don't need to do anything if it isn't a primary (left) click
    }
    
    if (event.target == canvas || event.target == document.body || event.target.tagName === "IMG") {
        if (!editorMode || editorMode == "none") {
            console.log("Starting drag (pan view)");
            isDragging = true;
        } else if (editorMode == "move" || editorMode == "edit" || editorMode == "connect") {
            isDragging = true;
            const worldPos = debugMousePosition(event, "select node");
            
            const nearestNode = findNearestNode(...worldPos);
            console.log("Nearest node:", nearestNode);
            
            if (!nearestNode) {
                console.warn("No nodes found in the current layer");
                return;
            }
            
            editorSelectedNode = nearestNode;
            
            if (editorMode == "move") {
                let distance = Math.sqrt(Math.pow(editorSelectedNode.x - worldPos[0], 2) + 
                                        Math.pow(editorSelectedNode.y - worldPos[1], 2));
                console.log("Distance to nearest node:", distance, "Max range:", editorMoveRange / Math.sqrt(view.zoom));
                
                if (distance > (editorMoveRange / Math.sqrt(view.zoom))) {
                    console.log("Node too far, deselecting");
                    editorSelectedNode = null;
                    return;     // nearest node is outside max move range
                }
            }
            
            console.log("Selected Node:", editorSelectedNode);
            
            // Show node panel in edit mode
            if (editorMode == "edit") {
                console.log("Edit mode - showing node panel");
                showNodePanel(editorSelectedNode);
            }
            
            redraw();
        } else if (editorMode == "add") {
            const worldPos = debugMousePosition(event, "add node");
            console.log("Adding node at world position:", worldPos);
            
            editorSelectedNode = createNode(view.layer, ...worldPos);
            console.log("Node added:", editorSelectedNode);
            
            redraw();
        } else if (editorMode == "polygon") {
            if (isDrawingPolygon) {
                const worldPos = canvasPosToPos(event.pageX, event.pageY);
                console.log("Adding polygon point at:", worldPos);
                polygonPoints.push({ x: worldPos[0], y: worldPos[1] });
                redraw();
                drawPolygonInProgress();
            }
        } else if (editorMode == "area") {
            // Select an area when in area mode
            const worldPos = canvasPosToPos(event.pageX, event.pageY);
            editorSelectedArea = findAreaAtPoint(worldPos[0], worldPos[1]);
            
            if (editorSelectedArea) {
                console.log("Selected area:", editorSelectedArea);
                showAreaPanel(editorSelectedArea);
            } else {
                console.log("No area found at click position");
                if (document.getElementById("areaPanel")) {
                    document.getElementById("areaPanel").style.display = "none";
                }
            }
            
            redraw();
        }
    } else {
        console.log("Click was on a UI element, not handling in editor");
    }
}

// Handle mouse up events
function handleMouseUp(event) {
    if (event.button != 0) {
        return;     // don't need to do anything if it isn't a primary (left) click
    }
    
    if (editorMode == "connect") {
        let node2 = findNearestNode(...canvasPosToPos(event.pageX, event.pageY));
        if (editorSelectedNode && node2 && editorSelectedNode != node2) {
            if (editorSelectedNode.connections.map((x) => x.id).includes(node2.id)) {
                console.log("Disconnected Nodes", editorSelectedNode, node2);
                disconnectNodes(editorSelectedNode, node2);
                redraw();
            } else {
                console.log("Connected Nodes", editorSelectedNode, node2);
                connectNodes(editorSelectedNode, node2);
                redraw();
            }
        } else {
            console.log("Cannot connect node to itself or no nodes available.");
        }
    }
    isDragging = false;
}

// Handle mouse move events
function handleMouseMove(event) {
    if (isDragging) {
        if (editorMode == "move" && editorSelectedNode) {
            let pos = canvasPosToPos(event.pageX, event.pageY);
            moveNode(editorSelectedNode, ...pos);
            redraw();
        } else if (editorMode == "connect" && editorSelectedNode) {
            let node2 = findNearestNode(...canvasPosToPos(event.pageX, event.pageY));
            if (node2 && tempConnectingNode != node2) {
                redraw();
                tempConnectingNode = node2;
                ctx.strokeStyle = editorStyle.connectionHighlightColor;
                ctx.lineWidth = editorStyle.connectionHighlightWidth;
                ctx.beginPath();
                ctx.moveTo(...posToCanvasPos(editorSelectedNode.x, editorSelectedNode.y));
                ctx.lineTo(...posToCanvasPos(node2.x, node2.y));
                ctx.stroke();
            } 
        } else if (editorMode == "polygon" && isDrawingPolygon && polygonPoints.length > 0) {
            // Draw a rubber-band line from the last point to current mouse position
            redraw();
            drawPolygonInProgress();
            
            // Draw the line to cursor
            const lastPoint = polygonPoints[polygonPoints.length - 1];
            const cursorPos = canvasPosToPos(event.pageX, event.pageY);
            
            ctx.strokeStyle = "#42F5C2";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(...posToCanvasPos(lastPoint.x, lastPoint.y));
            ctx.lineTo(event.pageX, event.pageY);
            ctx.stroke();
        } else {
            view.x = view.x + event.movementX / view.zoom;
            view.y = view.y + event.movementY / view.zoom;
            redraw();
        }
    } else {
        if (editorMode == "move") {
            let cursorPos = canvasPosToPos(event.pageX, event.pageY);
            let node = findNearestNode(...cursorPos);
            if (node) {
                let distance = Math.sqrt(Math.pow(node.x - cursorPos[0], 2) + Math.pow(node.y - cursorPos[1], 2));
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

// Handle double click for completing polygons
function handleDoubleClick(event) {
    if (editorMode == "polygon" && isDrawingPolygon && polygonPoints.length >= 3) {
        console.log("Completing polygon with", polygonPoints.length, "points");
        isDrawingPolygon = false;
        showAreaPropertiesDialog(function(properties) {
            // Create the area
            const area = createArea(
                view.layer, 
                properties.name, 
                properties.type, 
                polygonPoints
            );
            
            // Optionally create a node inside the polygon
            if (properties.createNode) {
                generateNodesForArea(area);
            }
            
            console.log("Created new area:", area);
            polygonPoints = [];
            redraw();
        });
    }
}

// Handle scroll events for zooming
function handleScroll(event) {
    view.zoom = view.zoom * Math.pow(Math.E, -1 * event.deltaY / 400);
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
    // Create a basic dialog
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
                <option value="classroom">Classroom</option>
                <option value="office">Office</option>
                <option value="hallway">Hallway</option>
                <option value="elevator">Elevator</option>
                <option value="stairs">Stairs</option>
                <option value="entrance">Entrance</option>
                <option value="restroom">Restroom</option>
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
    
    // Handle save button
    document.getElementById("save-area").addEventListener("click", function() {
        const properties = {
            name: document.getElementById("area-name").value || "Unnamed Area",
            type: document.getElementById("area-type").value,
            createNode: document.getElementById("create-node").checked
        };
        
        document.body.removeChild(dialog);
        callback(properties);
    });
    
    // Handle cancel
    document.getElementById("cancel-area").addEventListener("click", function() {
        document.body.removeChild(dialog);
        polygonPoints = [];
        redraw();
    });
}

// Find an area that contains a point
function findAreaAtPoint(x, y, layer = view.layer) {
    if (!areas[layer]) return null;
    
    for (const area of areas[layer]) {
        if (isPointInPolygon(x, y, area.points)) {
            return area;
        }
    }
    
    return null;
}

// Show area properties panel
function showAreaPanel(area) {
    let areaPanel = document.getElementById("areaPanel");
    
    // Create the panel if it doesn't exist
    if (!areaPanel) {
        areaPanel = document.createElement("div");
        areaPanel.id = "areaPanel";
        areaPanel.className = "ui_panel";
        areaPanel.style.position = "absolute";
        areaPanel.style.top = "20px";
        areaPanel.style.right = "20px";
        document.body.appendChild(areaPanel);
    }
    
    // Show the panel
    areaPanel.style.display = "block";
    
    // Update panel contents
    areaPanel.innerHTML = `
        <p>Area Properties</p>
        <hr>
        <label for="areaName">Name:</label>
        <input type="text" id="areaName" value="${area.name || ''}">
        <hr>
        <label for="areaType">Type:</label>
        <select id="areaType">
            ${Object.keys(areaTypes).map(type => 
                `<option value="${type}" ${area.type === type ? 'selected' : ''}>${areaTypes[type].name}</option>`
            ).join('')}
        </select>
        <hr>
        <p>Associated Nodes:</p>
        <div id="areaNodes">
            ${area.nodes && area.nodes.length > 0 ? 
                area.nodes.map(nodeId => {
                    const node = nodeGraph[area.layer][nodeId];
                    return node ? 
                        `<div>Node ${nodeId}${node.name ? ': ' + node.name : ''}</div>` : 
                        '';
                }).join('') : 
                '<div>No nodes associated with this area</div>'
            }
        </div>
        <hr>
        <button id="generateNode">Generate Center Node</button>
        <button id="updateArea">Update</button>
    `;
    
    // Add event listeners
    document.getElementById("areaName").addEventListener("change", function() {
        area.name = this.value;
    });
    
    document.getElementById("areaType").addEventListener("change", function() {
        area.type = this.value;
        redraw();
    });
    
    document.getElementById("generateNode").addEventListener("click", function() {
        generateNodesForArea(area);
        showAreaPanel(area); // Refresh panel
        redraw();
    });
    
    document.getElementById("updateArea").addEventListener("click", function() {
        area.name = document.getElementById("areaName").value;
        area.type = document.getElementById("areaType").value;
        redraw();
    });
}

// Create a new node
function createNode(layer, x, y, name = "", type = "regular") {
    console.log("Creating new node at:", x, y, "on layer:", layer);
    
    let id;
    if (loadedLayers.includes(layer)) {
        id = nodeGraph[layer].length;
    } else {
        id = 0;
        loadedLayers.push(layer);
        nodeGraph[layer] = [];
        namedNodes[layer] = [];
        areas[layer] = [];
        layerData[layer] = { imgScale: 1, mapImage: "outside.png" }; // Set a default map image
        
        // Add to layer select in UI
        addLayerToSelect(layer);
    }
    
    let node = { 
        id: id, 
        x: x, 
        y: y, 
        layer: layer, 
        connections: [], 
        type: type,
        flags: [] // Initialize flags array
    };
    
    if (name) {
        node.name = name;
        // Add to named nodes
        namedNodes[layer].push({
            id: id,
            name: name
        });
    }
    
    nodeGraph[layer][id] = node;
    console.log("Node created:", node);
    
    // If in edit mode, show the node panel
    if (editorMode === "edit") {
        editorSelectedNode = node;
        showNodePanel(node);
    }
    
    return node;
}

// Connect two nodes
function connectNodes(node1, node2, flags = []) {
    if (node1 == node2) {
        return;     // cannot connect a node to itself
    }
    
    if (node1.connections.some((x) => x.id == node2.id) || node2.connections.some((x) => x.id == node1.id)) {
        return;     // already connected
    }
    
    if (node1.layer == node2.layer) {
        let distance = Math.sqrt(Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2));
        node1.connections.push({ id: node2.id, distance: distance, flags: [...flags] });
        node2.connections.push({ id: node1.id, distance: distance, flags: [...flags] });
    } else {
        node1.connections.push({ id: node2.id, layer: node2.layer, flags: ["layerChange", ...flags] });
        node2.connections.push({ id: node1.id, layer: node1.layer, flags: ["layerChange", ...flags] });
    }
}

// Disconnect two nodes
function disconnectNodes(node1, node2) {
    if (node1 == node2) {
        return;     // cannot disconnect a node from itself
    }
    
    let node1Index = node1.connections.findIndex(c => c.id === node2.id);
    let node2Index = node2.connections.findIndex(c => c.id === node1.id);
    
    if (node1Index != -1 && node2Index != -1) {
        node1.connections.splice(node1Index, 1);
        node2.connections.splice(node2Index, 1);
    }
}

// Move a node to a new position
function moveNode(node, x, y) {
    node.x = x;
    node.y = y;
    
    // Update distances for all connections
    for (let i = 0; i < node.connections.length; i++) {
        if (!node.connections[i].flags || !node.connections[i].flags.includes("layerChange")) {
            let node2 = nodeGraph[node.layer][node.connections[i].id];
            if (node2) {
                let distance = Math.sqrt(Math.pow(node.x - node2.x, 2) + Math.pow(node.y - node2.y, 2));
                let foundIndex = node2.connections.findIndex(c => c.id === node.id);
                
                if (foundIndex != -1) {
                    node.connections[i].distance = distance;
                    node2.connections[foundIndex].distance = distance;
                } else {
                    console.log("One sided connection found when moving, move canceled.", node, node2);
                }
            }
        }
    }
}

// Quantize node positions to save space
function quantizeNodePositions(layer = view.layer) {
    for (let i = 0; i < nodeGraph[layer].length; i++) {
        let node = nodeGraph[layer][i];
        if (!node) {
            continue;
        }
        moveNode(node, Math.round(node.x), Math.round(node.y));
    }
    redraw();
}

// Initialize editor
function initEditor() {
    document.addEventListener("dblclick", handleDoubleClick);
    
    // Add editor mode buttons if they don't exist in the HTML
    if (editorAllowed && !document.getElementById("editorButtons")) {
        const buttonContainer = document.createElement("div");
        buttonContainer.id = "editorButtons";
        buttonContainer.className = "editor-buttons";
        buttonContainer.innerHTML = `
            <button data-mode="add">Add Node</button>
            <button data-mode="polygon">Add Area</button>
            <button data-mode="move">Move</button>
            <button data-mode="edit">Edit</button>
            <button data-mode="connect">Connect</button>
            <button data-mode="area">Select Area</button>
        `;
        document.body.appendChild(buttonContainer);
        
        // Add event listeners for buttons
        const buttons = buttonContainer.querySelectorAll("button");
        buttons.forEach(button => {
            button.addEventListener("click", function() {
                const mode = this.getAttribute("data-mode");
                
                // Simulate key press to activate the mode
                const keyMap = {
                    "add": "a",
                    "polygon": "p", 
                    "move": "m",
                    "edit": "e",
                    "connect": "c",
                    "area": "r"
                };
                
                if (keyMap[mode]) {
                    handleKeyPress({ key: keyMap[mode] });
                    
                    // Highlight the active button
                    buttons.forEach(btn => btn.classList.remove("active"));
                    this.classList.add("active");
                }
            });
        });
    }
    
    // Add zoom controls if they don't exist
    if (!document.getElementById("mapControls")) {
        const mapControls = document.createElement("div");
        mapControls.id = "mapControls";
        mapControls.className = "map-controls";
        mapControls.innerHTML = `
            <button id="zoomIn" class="map-control-btn">+</button>
            <button id="zoomOut" class="map-control-btn">−</button>
        `;
        document.body.appendChild(mapControls);
        
        // Add event listeners
        document.getElementById("zoomIn").addEventListener("click", function() {
            view.zoom = Math.min(view.zoom * 1.2, 5);
            redraw();
        });
        
        document.getElementById("zoomOut").addEventListener("click", function() {
            view.zoom = Math.max(view.zoom / 1.2, 0.2);
            redraw();
        });
    }
}

// *** FOR DEBUGGING PURPOSES ONLY ***
function debugMousePosition(event, mode) {
    const canvasPos = { x: event.pageX, y: event.pageY };
    const worldPos = canvasPosToPos(event.pageX, event.pageY);
    
    console.log(`Mouse Position (${mode}):`, {
        canvas: canvasPos,
        world: worldPos,
        view: { x: view.x, y: view.y, zoom: view.zoom, layer: view.layer }
    });
    
    return worldPos;
}