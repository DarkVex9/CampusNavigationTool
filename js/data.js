/**
 * data.js - Data structures and loading functionality
 */

// Global data structures
var nodeGraph = {};      // Each loaded layer is a property containing an array of all nodes
var namedNodes = {};     // Each loaded layer is a property containing an array of all named nodes
var loadedLayers = [];   // Array of layers loaded stored in string form
var layerData = {};      // Each loaded layer is a property containing metadata about the layer
var loadingCount = 0;    // Count of files being loaded
var currentPath;         // Stores currently drawn path if there is one

// Node types with colors and icons
const nodeTypes = {
    regular: { name: "Regular", color: "#42F5C2" },
    entrance: { name: "Entrance", color: "#4286f5" },
    elevator: { name: "Elevator", color: "#f542e3" },
    stairs: { name: "Stairs", color: "#f5a742" },
    restroom: { name: "Restroom", color: "#42b6f5" },
    accessible: { name: "Accessible", color: "#42f56f" }
};

// Find a node by name
function findByName(searchString) {
    searchString = searchString.trim().toLowerCase();
    
    // First try exact match
    for (let i = 0; i < loadedLayers.length; i++) {
        const layer = loadedLayers[i];
        
        for (let j = 0; j < namedNodes[layer].length; j++) {
            const namedNode = namedNodes[layer][j];
            const node = nodeGraph[layer][namedNode.id];
            
            if (node && namedNode.name && namedNode.name.toLowerCase() === searchString) {
                return node;
            }
        }
    }
    
    // Then try contains match
    for (let i = 0; i < loadedLayers.length; i++) {
        const layer = loadedLayers[i];
        
        for (let j = 0; j < namedNodes[layer].length; j++) {
            const namedNode = namedNodes[layer][j];
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

// File loading functions
function loadFile(fileName) {
    // Track the number of files being loaded to avoid searching an incomplete map
    loadingCount++;

    // Handle local file loading (mockup for testing)
    if (window.location.protocol == "file:") {
        loadingCount--;
        switch (fileName) {
            case "test file":
                return "test file contents";
            case "outside":
                return '{"name":"outside","metadata":{"imgScale":1,"mapImage":"outside.png"},"graph":[{"id":0,"x":0,"y":0,"layer":"outside","connections":[{"id":1,"distance":80,"flags":[]},{"id":2,"distance":113.13708498984761,"flags":[]},{"id":3,"distance":186.01075237738274,"flags":[]}]},{"id":1,"x":80,"y":0,"layer":"outside","connections":[{"id":0,"distance":80,"flags":[]},{"id":2,"distance":80,"flags":[]}]},{"id":2,"x":80,"y":80,"layer":"outside","connections":[{"id":0,"distance":113.13708498984761,"flags":[]},{"id":1,"distance":80,"flags":[]}]},{"id":3,"x":110,"y":150,"layer":"outside","connections":[{"id":0,"distance":186.01075237738274,"flags":[]}]}],"namedNodes":[]}';
            case "derrick_test":
                return '{"name":"test","metadata":{"imgScale":1,"mapImage":"derrick temp.jpg"},"graph":[null,null,{"id":2,"x":309,"y":360,"layer":"test","connections":[{"id":14,"distance":30,"flags":[]},{"id":6,"distance":39,"flags":[]},{"id":3,"distance":118.00423721205946,"flags":[]}]},{"id":3,"x":427,"y":361,"layer":"test","connections":[{"id":2,"distance":118.00423721205946,"flags":[]},{"id":7,"distance":37.12142238654117,"flags":[]},{"id":4,"distance":107,"flags":[]},{"id":19,"distance":39.01281840626232,"flags":[]}]},{"id":4,"x":534,"y":361,"layer":"test","connections":[{"id":3,"distance":107,"flags":[]},{"id":8,"distance":30.14962686336267,"flags":[]},{"id":17,"distance":25.079872407968907,"flags":[]}]},{"id":5,"x":669,"y":361,"layer":"test","connections":[{"id":10,"distance":28.071337695236398,"flags":[]},{"id":11,"distance":37.12142238654117,"flags":[]},{"id":12,"distance":36.05551275463989,"flags":[]},{"id":13,"distance":108.01851693112621,"flags":[]}]},{"id":6,"x":309,"y":321,"layer":"test","connections":[{"id":2,"distance":39,"flags":[]}]},{"id":7,"x":424,"y":324,"layer":"test","connections":[{"id":3,"distance":37.12142238654117,"flags":[]}]},{"id":8,"x":537,"y":331,"layer":"test","connections":[{"id":4,"distance":30.14962686336267,"flags":[]}]},{"id":9,"x":643,"y":325,"layer":"test","connections":[{"id":10,"distance":37.45430139037795,"flags":[]}]},{"id":10,"x":641,"y":363,"layer":"test","connections":[{"id":5,"distance":28.071337695236398,"flags":[]},{"id":17,"distance":82,"flags":[]}]},{"id":11,"x":672,"y":324,"layer":"test","connections":[{"id":5,"distance":37.12142238654117,"flags":[]}]},{"id":12,"x":667,"y":397,"layer":"test","connections":[{"id":5,"distance":36.05551275463989,"flags":[]}]},{"id":13,"x":777,"y":363,"layer":"test","connections":[{"id":5,"distance":108.01851693112621,"flags":[]}]},{"id":14,"x":309,"y":390,"layer":"test","connections":[{"id":16,"distance":68.00735254367721,"flags":[]},{"id":15,"distance":36.013886210738214,"flags":[]},{"id":2,"distance":30,"flags":[]}]},{"id":15,"x":273,"y":389,"layer":"test","connections":[{"id":14,"distance":36.013886210738214,"flags":[]}]},{"id":16,"x":308,"y":458,"layer":"test","connections":[{"id":14,"distance":68.00735254367721,"flags":[]}]},{"id":17,"x":559,"y":363,"layer":"test","connections":[{"id":4,"distance":25.079872407968907,"flags":[]},{"id":10,"distance":82,"flags":[]},{"id":18,"distance":34.0147027033899,"flags":[]}]},{"id":18,"x":558,"y":397,"layer":"test","connections":[{"id":17,"distance":34.0147027033899,"flags":[]}]},{"id":19,"x":428,"y":400,"layer":"test","connections":[{"id":3,"distance":39.01281840626232,"flags":[]}]}],"namedNodes":[]}';
        }
    } else {
        // TODO: Proper file loading via AJAX/fetch
        // For now, returning null to prevent errors
        loadingCount--;
        return null;
    }
}

function loadLayerFromJSON(layerString) {
    if (!layerString) return;
    
    let obj = JSON.parse(layerString);
    if (loadedLayers.includes(obj.name)) {
        console.log("Layer already loaded - " + obj.name);
        return;
    }
    
    loadedLayers.push(obj.name);
    layerData[obj.name] = obj.metadata;
    nodeGraph[obj.name] = obj.graph;
    namedNodes[obj.name] = obj.namedNodes;
    
    // Add to layer select in UI
    addLayerToSelect(obj.name);
    
    console.log("Loaded layer - " + obj.name);
}

// Add a layer to the layer select dropdown
function addLayerToSelect(layerName) {
    let option = document.createElement("option");
    option.value = layerName;
    option.appendChild(document.createTextNode(layerName));
    document.getElementById("layerSelect").appendChild(option);
}

// Initialize with test data
function initializeTestData() {
    loadLayerFromJSON(loadFile("outside"));
    loadLayerFromJSON(loadFile("derrick_test"));
    
    if (!loadedLayers.includes("outside")) {
        view.layer = null;
    }
    
    if (!view.layer && loadedLayers.length > 0) {
        view.layer = loadedLayers[0];
    }
}

// Get user accessibility preferences
function getUserPreferences() {
    return {
        avoidStairs: document.getElementById('avoidStairs').checked,
        avoidElevators: document.getElementById('avoidElevators').checked
    };
}

// Add this debug function to data.js 
function debugMapLoading() {
    console.log("Current view layer:", view.layer);
    console.log("Loaded layers:", loadedLayers);
    console.log("Layer data:", layerData);
    
    if (view.layer && layerData[view.layer]) {
        console.log("Current map image path:", "map_images/" + layerData[view.layer].mapImage);
        
        // Check if the image file exists
        const img = new Image();
        img.onload = function() {
            console.log("Map image loaded successfully");
        };
        img.onerror = function() {
            console.error("Failed to load map image:", "map_images/" + layerData[view.layer].mapImage);
            console.log("Please ensure the image file exists and the path is correct");
        };
        img.src = "map_images/" + layerData[view.layer].mapImage;
    } else {
        console.error("Invalid layer or missing layer data");
    }
}

// Add this to main.js after initializeTestData()
function checkMapSetup() {
    // Ensure view.layer is set
    if (!view.layer && loadedLayers.length > 0) {
        view.layer = loadedLayers[0];
    }
    
    // Log debug info
    debugMapLoading();
    
    // Force redraw
    redraw();
}

// Update the init function in main.js
function init() {
    console.log("Initializing Navigation Application");
    
    // Initialize UI
    initUI();
    
    // Load test data
    initializeTestData();
    
    // Check map setup
    checkMapSetup();
    
    // Initial render
    redraw();
}

var areas = {};  // Each loaded layer is a property containing an array of all areas

// Define a new area
function createArea(layer, name, type, points) {
    if (!areas[layer]) {
        areas[layer] = [];
    }
    
    const id = areas[layer].length;
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
    area.nodes.push(node.id);
}

// Draw areas in ui.js
function drawAreas() {
    if (!areas[view.layer]) return;
    
    for (const area of areas[view.layer]) {
        // Set fill color based on area type
        ctx.fillStyle = getAreaColor(area.type);
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
        ctx.stroke();
        
        // Draw area name
        // Calculate center point of the polygon
        const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
        const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        
        ctx.fillStyle = "#333";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(area.name, ...posToCanvasPos(centerX, centerY));
        
        // Draw area icon if needed
        drawAreaIcon(area);
    }
}