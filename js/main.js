/**
 * main.js - Main application initialization
 */

// Global variables
var editorAllowed = true; // Whether editor tools are allowed
var drawNodes = false;    // Whether to draw nodes by default

// Initialize the application
function init() {
    console.log("Initializing Navigation Application");
    
    // Set up canvas
    canvas = document.getElementById("overlay");
    ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Get reference to map image
    mapImgElement = document.getElementById("mainMapImg");
    
    // Initialize UI elements
    initUI();
    
    // Load test data
    initializeTestData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial render
    redraw();
    
    // Debug map loading
    checkMapSetup();
    
    console.log("Initialization complete");
}

// Setup all event listeners
function setupEventListeners() {
    // Add event listeners for UI controls
    document.getElementById("go_button").addEventListener("click", handleGoButton);
    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("wheel", handleScroll);
    
    // Layer selection dropdown
    const layerSelect = document.getElementById("layerSelect");
    if (layerSelect) {
        layerSelect.addEventListener("change", function() {
            view.layer = this.value;
            console.log("Layer changed to:", view.layer);
            redraw();
        });
    }
    
    // Node panel controls
    const nodeNameInput = document.getElementById("nodeName");
    if (nodeNameInput) {
        nodeNameInput.addEventListener("change", updateNodeName);
    }
    
    const isStairsCheckbox = document.getElementById("isStairs");
    if (isStairsCheckbox) {
        isStairsCheckbox.addEventListener("change", updateNodeFlags);
    }
    
    const isElevatorCheckbox = document.getElementById("isElevator");
    if (isElevatorCheckbox) {
        isElevatorCheckbox.addEventListener("change", updateNodeFlags);
    }
    
    const addLayerChangeBtn = document.getElementById("addLayerChangeConnection");
    if (addLayerChangeBtn) {
        addLayerChangeBtn.addEventListener("click", showLayerChangeUI);
    }
    
    // Handle window resize
    window.addEventListener("resize", function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        redraw();
    });
    
    console.log("Event listeners initialized");
}

// Call init when the page loads
window.addEventListener("load", init);