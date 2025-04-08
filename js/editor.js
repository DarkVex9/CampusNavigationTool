/**
 * editor.js - Map editor functionality
 */

// Editor settings
var editorAllowed = true;
var editorMoveRange = 500;   // Max range that the move tool can grab a node from
var editorMode = "none";
var editorSelectedNode;

// Handle key press events
function handleKeyPress(event) {
    //console.log("Key Pressed - "+event.key);
    switch(event.key) {
        case "p":
            // "Print" current layer data
            if (editorAllowed) {
                quantizeNodePositions();
                console.log(JSON.stringify({
                    name: view.layer,
                    metadata: layerData[view.layer],
                    graph: nodeGraph[view.layer],
                    namedNodes: namedNodes[view.layer]
                }));
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
            }
            break;
        case "m":
            // "Move" editor mode
            if (editorAllowed) {
                console.log("Editor Mode - Move");
                editorMode = "move";
                editorModeLabel.innerText = "Editor Mode: Move";
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
            }
            break;
        case "Escape":
            // Clear editor mode
            if (editorAllowed) {
                // Clear selected node if we are already in mode none
                if (editorMode == "none") {
                    editorSelectedNode = null;
                    redraw();
                }
                console.log("Editor Mode - None");
                editorMode = "none";
                editorModeLabel.innerText = "Editor Mode: None";
                
                // Hide node panel
                nodePanel.style.display = "none";
            }
            break;
        case "Backspace":
        case "Delete":
            // Delete selected node
            if (editorAllowed && editorSelectedNode) {
                while(editorSelectedNode.connections.length > 0) {
                    disconnectNodes(editorSelectedNode, nodeGraph[editorSelectedNode.layer][editorSelectedNode.connections[0].id]);
                }
                nodeGraph[editorSelectedNode.layer][editorSelectedNode.id] = null;
                editorSelectedNode = null;
                redraw();
                
                // Hide node panel
                nodePanel.style.display = "none";
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
    }
}

// Handle mouse down events
function handleMouseDown(event) {
    console.log("Mouse Down - Button:", event.button, "Target:", event.target.tagName);
    
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
        if (editorSelectedNode != node2) {
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
            console.log("Cannot connect node to itself.");
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
        } else if (editorMode == "connect") {
            let node2 = findNearestNode(...canvasPosToPos(event.pageX, event.pageY));
            if (tempConnectingNode != node2) {
                redraw();
                tempConnectingNode = node2;
                ctx.strokeStyle = editorStyle.connectionHighlightColor;
                ctx.lineWidth = editorStyle.connectionHighlightWidth;
                ctx.beginPath();
                ctx.moveTo(...posToCanvasPos(editorSelectedNode.x, editorSelectedNode.y));
                ctx.lineTo(...posToCanvasPos(node2.x, node2.y));
                ctx.stroke();
            } 
        } else {
            view.x = view.x + event.movementX / view.zoom;
            view.y = view.y + event.movementY / view.zoom;
            redraw();
        }
    } else {
        if (editorMode == "move") {
            let cursorPos = canvasPosToPos(event.pageX, event.pageY);
            let node = findNearestNode(...cursorPos);
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

// Handle scroll events for zooming
function handleScroll(event) {
    view.zoom = view.zoom * Math.pow(Math.E, -1 * event.deltaY / 400);
    redraw();
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

// Quantize node positions to save space
function quantizeNodePositions(layer = view.layer) {
    for (let i = 0; i < nodeGraph[layer].length; i++) {
        node = nodeGraph[layer][i];
        if (!node) {
            continue;
        }
        moveNode(node, Math.round(node.x), Math.round(node.y));
    }
    redraw();
}


// *** FOR DEBUGGING PURPOSES ONLY ***
// PLEASE REMOVE BEFORE FINAL BUILD
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