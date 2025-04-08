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
    while(editorSelectedNode.connections.length > 0) {
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
                // Make node the selected node and delete it
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
            console.log("Node added:", editorSelectedNode);
            
            // If in edit mode, show the node panel immediately
            if (editorMode === "edit") {
                showNodePanel(editorSelectedNode);
            }
            
            redraw();
        } else if (editorMode === "polygon") {
            if (isDrawingPolygon) {
                const worldPos = canvasPosToPos(event.pageX, event.pageY);
                console.log("Adding polygon point at:", worldPos);
                polygonPoints.push({ x: worldPos[0], y: worldPos[1] });
                redraw();
                drawPolygonInProgress();
            }
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
    
    if (editorMode === "connect" && editorSelectedNode) {
        const worldPos = canvasPosToPos(event.pageX, event.pageY);
        let node2 = findNearestNode(worldPos[0], worldPos[1]);
        
        if (node2 && editorSelectedNode !== node2) {
            if (editorSelectedNode.connections.some(c => c.id === node2.id)) {
                console.log("Disconnected Nodes", editorSelectedNode, node2);
                disconnectNodes(editorSelectedNode, node2);
            } else {
                console.log("Connected Nodes", editorSelectedNode, node2);
                connectNodes(editorSelectedNode, node2);
            }
            redraw();
        }
    }
    
    isDragging = false;
}

// Handle mouse move events
function handleMouseMove(event) {
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
                
                // Draw potential connection line
                ctx.strokeStyle = editorStyle.connectionHighlightColor;
                ctx.lineWidth = editorStyle.connectionHighlightWidth;
                ctx.beginPath();
                ctx.moveTo(...posToCanvasPos(editorSelectedNode.x, editorSelectedNode.y));
                ctx.lineTo(...posToCanvasPos(node2.x, node2.y));
                ctx.stroke();
            }
        } else if (editorMode === "polygon" && isDrawingPolygon && polygonPoints.length > 0) {
            // Draw rubber-band line from last point to cursor
            redraw();
            drawPolygonInProgress();
            
            // Draw line to cursor
            const lastPoint = polygonPoints[polygonPoints.length - 1];
            
            ctx.strokeStyle = "#42F5C2";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(...posToCanvasPos(lastPoint.x, lastPoint.y));
            ctx.lineTo(event.pageX, event.pageY);
            ctx.stroke();
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
                    
                    // Draw hint line
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
    if (editorMode === "polygon" && isDrawingPolygon && polygonPoints.length >= 3) {
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
            
            // Refresh suggestions as area names might be used
            populateSuggestions();
        });
    }
}

// Handle scroll events for zooming
function handleScroll(event) {
    // Calculate zoom center based on mouse position
    const mouseX = event.pageX;
    const mouseY = event.pageY;
    const worldPosBeforeZoom = canvasPosToPos(mouseX, mouseY);
    
    // Apply zoom
    const zoomFactor = Math.pow(Math.E, -event.deltaY / 400);
    view.zoom = Math.min(Math.max(view.zoom * zoomFactor, 0.2), 5); // Limit zoom range
    
    // Adjust position to keep mouse over same world point
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
        areaPanel.style.width = "300px";
        areaPanel.style.height = "auto";
        document.body.appendChild(areaPanel);
    }
    
    // Show the panel
    areaPanel.style.display = "block";
    
    // Update panel contents
    areaPanel.innerHTML = `
        <h3 class="font-bold mb-2">Area Properties</h3>
        <div class="mb-2">
            <label class="block text-xs mb-1">Name:</label>
            <input type="text" id="areaName" class="w-full p-1 text-sm border rounded" value="${area.name || ''}">
        </div>
        <div class="mb-2">
            <label class="block text-xs mb-1">Type:</label>
            <select id="areaType" class="w-full p-1 text-sm border rounded">
                ${Object.keys(areaTypes).map(type => 
                    `<option value="${type}" ${area.type === type ? 'selected' : ''}>${areaTypes[type].name}</option>`
                ).join('')}
            </select>
        </div>
        <div class="mb-2">
            <label class="block text-xs mb-1">Associated Nodes:</label>
            <div id="areaNodes" class="text-xs bg-gray-50 p-1 rounded max-h-24 overflow-y-auto">
                ${area.nodes && area.nodes.length > 0 ? 
                    area.nodes.map(nodeId => {
                        const node = nodeGraph[area.layer][nodeId];
                        return node ? 
                            `<div class="py-0.5">${nodeId}: ${node.name || 'Unnamed node'}</div>` : 
                            '';
                    }).join('') : 
                    '<div class="py-0.5">No nodes associated with this area</div>'
                }
            </div>
        </div>
        <div class="flex justify-end space-x-2">
            <button id="generateAreaNode" class="px-2 py-1 bg-blue-500 text-white text-xs rounded">
                Generate Node
            </button>
            <button id="updateArea" class="px-2 py-1 bg-blue-500 text-white text-xs rounded">
                Update
            </button>
        </div>
    `;
    
    // Add event listeners
    document.getElementById("areaName").addEventListener("change", function() {
        area.name = this.value;
    });
    
    document.getElementById("areaType").addEventListener("change", function() {
        area.type = this.value;
        redraw();
    });
    
    document.getElementById("generateAreaNode").addEventListener("click", function() {
        generateNodesForArea(area);
        showAreaPanel(area); // Refresh panel
        redraw();
    });
    
    document.getElementById("updateArea").addEventListener("click", function() {
        area.name = document.getElementById("areaName").value;
        area.type = document.getElementById("areaType").value;
        
        // Update suggestions as area name might be used
        populateSuggestions();
        
        redraw();
    });
}

// Create a new node
function createNode(layer, x, y, name = "", type = "regular") {
    console.log("Creating new node at:", x, y, "on layer:", layer);
    
    let id;
    if (nodeGraph[layer]) {
        // Find the next available ID
        id = 0;
        while (nodeGraph[layer][id] !== undefined) {
            id++;
        }
    } else {
        id = 0;
        nodeGraph[layer] = [];
        namedNodes[layer] = [];
        areas[layer] = [];
        layerData[layer] = { imgScale: 1, mapImage: `${layer}.png` }; // Set a default map image
        
        // Add to layer select
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
        
        // Update suggestions
        populateSuggestions();
    }
    
    nodeGraph[layer][id] = node;
    console.log("Node created:", node);
    
    return node;
}

// Connect two nodes
function connectNodes(node1, node2, flags = []) {
    if (node1 == node2) {
        return; // Cannot connect a node to itself
    }
    
    if (node1.connections.some(c => c.id == node2.id) || node2.connections.some(c => c.id == node1.id)) {
        return; // Already connected
    }
    
    if (node1.layer == node2.layer) {
        // Same layer connection - store distance
        let distance = Math.sqrt(Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2));
        node1.connections.push({ id: node2.id, distance: distance, flags: [...flags] });
        node2.connections.push({ id: node1.id, distance: distance, flags: [...flags] });
    } else {
        // Layer change connection - store target layer
        node1.connections.push({ id: node2.id, layer: node2.layer, flags: ["layerChange", ...flags] });
        node2.connections.push({ id: node1.id, layer: node1.layer, flags: ["layerChange", ...flags] });
    }
    
    console.log(`Connected: Node ${node1.id} (${node1.layer}) to Node ${node2.id} (${node2.layer})`);
}

// Disconnect two nodes
function disconnectNodes(node1, node2) {
    if (node1 == node2) {
        return; // Cannot disconnect a node from itself
    }
    
    let node1Index = node1.connections.findIndex(c => c.id === node2.id);
    let node2Index = node2.connections.findIndex(c => c.id === node1.id);
    
    if (node1Index != -1 && node2Index != -1) {
        node1.connections.splice(node1Index, 1);
        node2.connections.splice(node2Index, 1);
        console.log(`Disconnected: Node ${node1.id} from Node ${node2.id}`);
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

// Initialize editor
function initEditor() {
    // Register event handlers (moved to main.js setupEventHandlers())
    console.log("Editor initialized");
    
    // Make sure draw nodes is enabled by default
    drawNodes = true;
    
    // Initialize the editor mode to none
    setEditorMode("none");
}

// Auto-connect area nodes
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
    let connectionsAdded = 0;
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
                connectionsAdded++;
            }
        }
    }
    
    console.log(`Auto-connected ${connectionsAdded} node pairs`);
}