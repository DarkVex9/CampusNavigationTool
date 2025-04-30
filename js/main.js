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
  
  // Test Data only
  // initializeTestData();
  
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
    layerSelect.addEventListener("change", function () {
      view.layer = this.value;
      console.log("Layer changed to:", view.layer);
      updateBackgroundImageUI();
      redraw();
    });
  }

  // Add listeners for node panel inputs
  setupNodePanelListeners();

  // Add listeners for editor buttons
  setupEditorButtonListeners();

  // Handle window resize
  window.addEventListener("resize", function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  });

  // Setup toggle editor button
  const toggleEditorBtn = document.getElementById("toggleEditor");
  if (toggleEditorBtn) {
    toggleEditorBtn.addEventListener("click", function () {
      const editorTools = document.getElementById("editorTools");
      if (editorTools) {
        const isVisible = editorTools.style.display !== "none";
        editorTools.style.display = isVisible ? "none" : "block";
        this.textContent = isVisible ? "Show Editor Tools" : "Hide Editor Tools";
      }
    });
  }

  // DELETE FLOOR button logic
  const deleteFloorBtn = document.getElementById("deleteFloorBtn");
  if (deleteFloorBtn) {
    deleteFloorBtn.addEventListener("click", function () {
      console.log("🗑️ Delete Floor button clicked");
  
      if (loadedLayers.length <= 1) {
        alert("At least one floor must remain.");
        return;
      }
  
      const currentLayer = view.layer;
      if (!confirm(`Are you sure you want to delete floor "${currentLayer}"? This cannot be undone.`)) return;
  
      console.log("Current layer:", currentLayer);
      console.log("Loaded layers before delete:", [...loadedLayers]);
  
      const index = loadedLayers.indexOf(currentLayer);
      if (index !== -1) {
        const deletedLayer = loadedLayers.splice(index, 1)[0];
        delete nodeGraph[deletedLayer];
        delete namedNodes[deletedLayer];
        delete areas[deletedLayer];
        delete layerData[deletedLayer];
        delete backgroundImages[deletedLayer];
  
        const select = document.getElementById("layerSelect");
        if (select) {
          const optionToRemove = [...select.options].find(opt => opt.value === deletedLayer);
          if (optionToRemove) {
            optionToRemove.remove();
            console.log("Removed dropdown option for:", deletedLayer);
          } else {
            console.warn("No option found for deleted layer:", deletedLayer);
          }
        }
  
        if (loadedLayers.length > 0) {
          view.layer = loadedLayers[0];
          if (select) select.value = view.layer;
        } else {
          view.layer = "outside";
        }
  
        console.log("Deleted layer:", deletedLayer);
        console.log("Remaining layers:", loadedLayers);
        redraw();
        populateSuggestions();
        alert(`Floor "${deletedLayer}" deleted.`);
      } else {
        console.warn("Layer not found in loadedLayers:", currentLayer);
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
  const endpointCheckbox = document.getElementById("constraintEndpoint");
  if (endpointCheckbox) {
    endpointCheckbox.addEventListener("change", function () {
      if (!editorSelectedNode) return;
      if (!editorSelectedNode.constraints) {
        editorSelectedNode.constraints = [];
      }
      if (this.checked) {
        if (!editorSelectedNode.constraints.includes("endpoint")) {
          editorSelectedNode.constraints.push("endpoint");
        }
      } else {
        editorSelectedNode.constraints = editorSelectedNode.constraints.filter(c => c !== "endpoint");
      }
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
    // fileToDataURL is defined in utils.js
    const dataUrl = await fileToDataURL(file);
    
    // Create a new Image object and load the data URL
    const img = new Image();
    img.onload = function() {
      // Store the image object and its associated data
      backgroundImages[view.layer] = {
        image: img,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        opacity: 0.5,
        dataURL: dataUrl // Store the data URL for saving
      };
      
      console.log(`Background image loaded for layer ${view.layer}:`, img.width, "x", img.height);
      
      // Update UI and redraw
      updateBackgroundImageUI();
      redraw();
    };
    
    img.onerror = function() {
      console.error('Error loading the image');
      alert('Failed to load the image. Please try again.');
    };
    
    // Set the source to trigger loading
    img.src = dataUrl;
  } catch (error) {
    console.error('Error processing background image:', error);
    alert('Failed to process the image. Please try again.');
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

// Update background image UI based on current layer
function updateBackgroundImageUI() {
  const bgControls = document.getElementById('backgroundControls');
  const hasImage = !!backgroundImages[view.layer];
  
  if (bgControls) {
    // Show/hide controls based on whether there's an image
    bgControls.style.display = hasImage ? 'block' : 'none';
    
    if (hasImage) {
      // Update opacity slider
      const opacitySlider = document.getElementById('bgOpacity');
      const opacityValue = document.getElementById('opacityValue');
      if (opacitySlider && opacityValue) {
        const opacity = backgroundImages[view.layer].opacity || 0.5;
        opacitySlider.value = Math.round(opacity * 100);
        opacityValue.textContent = Math.round(opacity * 100);
      }
    }
  }
}

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

document.addEventListener("DOMContentLoaded", init);