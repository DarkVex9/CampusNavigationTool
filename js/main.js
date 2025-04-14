/**
 * main.js - Main application initialization
 */

// Global variables
var editorAllowed = true; // Whether editor tools are allowed
var drawNodes = false;    // Whether to draw nodes by default
var loadingCount = 0;

// Initialize the application
function init() {
    console.log("Initializing Navigation Application");
    
    // Set up canvas
    canvas = document.getElementById("overlay");
    if (!canvas) {
      console.error("Overlay canvas element not found!");
      return;
    }
    
    ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Load test data first
    initializeTestData();
    
    // Then initialize UI elements
    initUI();
    
    // Set up event listeners
    setupEventListeners();

    setupSaveAreaButtonListener();
    
    // Keep editor tools hidden by default
    editorContainer = document.getElementById("editorTools");
    if (editorContainer) {
      editorContainer.style.display = "none";
      
      // Update toggle button text accordingly
      const toggleBtn = document.getElementById("toggleEditor");
      if (toggleBtn) {
        toggleBtn.textContent = "Show Editor Tools";
      }
    }
    
    // Initialize with drawing disabled by default
    drawNodes = false;
    
    // Reset the view to center
    view.x = 0;
    view.y = 0;
    view.zoom = 1;
    view.layer = 'outside';
     
    // Initial render
    redraw();
     
    // Check map setup
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
          updateBackgroundImageUI(); // Add this line
          redraw();
      });
  }
  
  // Add listeners for node panel inputs
  setupNodePanelListeners();
  
  // Add listeners for editor buttons
  setupEditorButtonListeners();
  
  // Handle window resize
  window.addEventListener("resize", function() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redraw();
  });
  
  // Setup toggle editor button with proper functionality
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
  
  console.log("Event listeners initialized");
}

function setupEditorButtonListeners() {
  const editorButtons = document.querySelectorAll('.editor-buttons button');
  editorButtons.forEach(button => {
      button.addEventListener('click', function() {
          const mode = this.getAttribute('data-mode');
          setEditorMode(mode);
      });
  });
  
  // Exit editor mode button
  const exitEditorButton = document.querySelector('button[onclick="setEditorMode(\'none\')"]');
  if (exitEditorButton) {
      // Replace the inline onclick with a proper event listener
      exitEditorButton.removeAttribute('onclick');
      exitEditorButton.addEventListener('click', function() {
          setEditorMode('none');
      });
  }
}

function setupSaveAreaButtonListener() {
    const saveAreaButton = document.getElementById("saveAreaButton");
    if (saveAreaButton) {
      saveAreaButton.addEventListener("click", function() {
        if (isDrawingPolygon && polygonPoints.length >= 3) {
          console.log("Completing polygon with", polygonPoints.length, "points");
          isDrawingPolygon = false;
          showAreaPropertiesDialog(function(properties) {
            const area = createArea(view.layer, properties.name, properties.type, polygonPoints);
            if (properties.createNode) {
              generateNodesForArea(area);
            }
            console.log("Created new area:", area);
            polygonPoints = [];
            // Hide the save button after saving
            saveAreaButton.style.display = "none";
            redraw();
            populateSuggestions();
          });
        } else {
          alert("You need at least 3 points to create an area.");
        }
      });
    }
  }


// Call init when the page loads
window.addEventListener("load", init);

function setupNodePanelListeners() {
  const nodeNameInput = document.getElementById("nodeName");
  if (nodeNameInput) {
      nodeNameInput.addEventListener("change", updateNodeName);
  }
  
  const nodeXInput = document.getElementById("nodeX");
  if (nodeXInput) {
      nodeXInput.addEventListener("change", function() {
          if (!editorSelectedNode) return;
          editorSelectedNode.x = parseFloat(this.value);
          moveNode(editorSelectedNode, editorSelectedNode.x, editorSelectedNode.y);
          redraw();
      });
  }
  
  const nodeYInput = document.getElementById("nodeY");
  if (nodeYInput) {
      nodeYInput.addEventListener("change", function() {
          if (!editorSelectedNode) return;
          editorSelectedNode.y = parseFloat(this.value);
          moveNode(editorSelectedNode, editorSelectedNode.x, editorSelectedNode.y);
          redraw();
      });
  }
  
  const nodeTypeSelect = document.getElementById("nodeType");
  if (nodeTypeSelect) {
      nodeTypeSelect.addEventListener("change", function() {
          if (!editorSelectedNode) return;
          editorSelectedNode.type = this.value;
          redraw();
      });
  }
}

// Setup background image controls
document.getElementById('uploadBgImage').addEventListener('change', async function(e) {
  if (!e.target.files || e.target.files.length === 0) return;
  
  const file = e.target.files[0];
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }
  
  try {
    const dataUrl = await fileToDataURL(file);
    await loadBackgroundImage(view.layer, dataUrl);
    updateBackgroundImageUI();
    redraw();
  } catch (error) {
    console.error('Error loading background image:', error);
    alert('Failed to load the image. Please try again.');
  }
});

document.getElementById('bgOpacity').addEventListener('input', function() {
  const opacity = parseInt(this.value) / 100;
  document.getElementById('opacityValue').textContent = this.value;
  if (backgroundImages[view.layer]) {
    backgroundImages[view.layer].opacity = opacity;
    redraw();
  }
});

document.getElementById('centerBgImage').addEventListener('click', function() {
  if (backgroundImages[view.layer]) {
    backgroundImages[view.layer].x = 0;
    backgroundImages[view.layer].y = 0;
    redraw();
  }
});

// Setup save/load controls
document.getElementById('saveMap').addEventListener('click', function() {
  saveMapToLocalStorage();
  alert('Map saved successfully!');
});

document.getElementById('exportMap').addEventListener('click', function() {
  exportMapToFile();
});

document.getElementById('importMap').addEventListener('change', async function(e) {
  if (!e.target.files || e.target.files.length === 0) return;
  
  const file = e.target.files[0];
  if (file.type !== 'application/json') {
    alert('Please select a JSON file');
    return;
  }
  
  try {
    await importMapFromFile(file);
    alert('Map imported successfully!');
  } catch (error) {
    console.error('Error importing map:', error);
    alert('Failed to import the map. Please check the file format.');
  }
});

// Load saved map on startup
document.getElementById('loadSavedMap').addEventListener('click', function() {
  if (loadMapFromLocalStorage()) {
    alert('Map loaded successfully!');
  } else {
    alert('No saved map found or error loading map.');
  }
});