/**
 * main.js - Main application initialization
 */

// Global variables
var editorAllowed = true; // Whether editor tools are allowed

view.zoom = 1.5;
view.x = -100;
view.y = -50;

// Initialize the application
function init() {
    console.log("Initializing Navigation Application");
    
    // Initialize UI
    initUI();
    
    // Load test data or create empty structures
    initializeEmptyData();
    
    // Set up event handlers for the buttons
    setupEventHandlers();
    
    // Initial render
    redraw();
}

// Initialize empty data structures
function initializeEmptyData() {
    // Create a default layer if none exists
    if (loadedLayers.length === 0) {
        const defaultLayer = "default";
        loadedLayers.push(defaultLayer);
        nodeGraph[defaultLayer] = [];
        namedNodes[defaultLayer] = [];
        areas[defaultLayer] = [];
        layerData[defaultLayer] = { 
            imgScale: 1, 
            mapImage: "blank.png" // This won't be used yet
        };
        
        view.layer = defaultLayer;
        
        // Add to layer select in UI
        addLayerToSelect(defaultLayer);
    }
}

// Set up event handlers for UI elements
function setupEventHandlers() {
    // Map controls
    document.getElementById("zoomIn").addEventListener("click", function() {
        view.zoom = Math.min(view.zoom * 1.2, 5);
        redraw();
    });
    
    document.getElementById("zoomOut").addEventListener("click", function() {
        view.zoom = Math.max(view.zoom / 1.2, 0.2);
        redraw();
    });
    
    // Make sure Draw Nodes is enabled by default for visibility
    drawNodes = true;
}

// Add sample areas for testing
function addSampleAreas() {
    // Only add if no areas exist
    if (areas[view.layer] && areas[view.layer].length > 0) {
        return;
    }
    
    // Add a sample classroom
    const classroom = createArea(
        view.layer,
        "Classroom 101",
        "classroom",
        [
            { x: 20, y: 20 },
            { x: 100, y: 20 },
            { x: 100, y: 80 },
            { x: 20, y: 80 }
        ]
    );
    
    // Add a sample hallway
    const hallway = createArea(
        view.layer,
        "Main Hallway",
        "hallway",
        [
            { x: 20, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 120 },
            { x: 20, y: 120 }
        ]
    );
    
    // Generate nodes for the areas
    const classroomNode = generateNodesForArea(classroom);
    const hallwayNode = generateNodesForArea(hallway);
    
    // Connect the nodes
    connectNodes(classroomNode, hallwayNode);
    
    console.log("Added sample areas for testing");
}

// Call init when the page loads
window.addEventListener("load", init);