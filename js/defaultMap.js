/**
 * defaultMap.js - GitHub Pages compatible JSON map loader
 */

// Storage key for localStorage
const STORAGE_KEY = 'txstNavigationMapData';

// Path to your map file
const MAP_FILE_PATH = './maps/txst_map_data.json'; // Adjust to actual filename

// Check if a map exists in localStorage
function hasStoredMap() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// Load the map from JSON file
function loadMapFromFile() {
  console.log(`Loading map from file: ${MAP_FILE_PATH}`);
  
  return fetch(MAP_FILE_PATH)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load map file: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error("Error loading map file:", error);
      // Rethrow so we can handle it in the calling function
      throw error;
    });
}

// Process the map data and initialize the application
function processMapData(importData) {
  // Reset current data structures
  nodeGraph = {};
  namedNodes = {};
  areas = {};
  backgroundImages = {};
  loadedLayers = [];

  // Load each layer
  for (const layerName in importData.layers) {
    const layer = importData.layers[layerName];
    
    // Add to loaded layers
    if (!loadedLayers.includes(layerName)) {
      loadedLayers.push(layerName);
    }

    // Fix malformed or stale data
    if (layer.nodes) {
        // Filter out nulls
        layer.nodes = layer.nodes.filter(n => n !== null);
  
        // Ensure node IDs match their array index
        layer.nodes.forEach((node, index) => {
            node.id = index;
  
            // Also ensure node.connections is always an array
            if (!Array.isArray(node.connections)) {
                node.connections = [];
            }
        });
    }

    if (layer.nodes) {
        layer.nodes.forEach((node) => {
          if (Array.isArray(node.connections)) {
            node.connections = node.connections.filter(conn => conn && typeof conn.id === 'number');
          } else {
            node.connections = [];
          }
        });
    }    
    
    // Set layer data
    nodeGraph[layerName] = layer.nodes || [];
    namedNodes[layerName] = layer.namedNodes || [];
    areas[layerName] = layer.areas || [];
    layerData[layerName] = layer.metadata || {};
  }
  
  // Load background images if present
  if (importData.backgroundImages) {
    for (const layerName in importData.backgroundImages) {
      const bgData = importData.backgroundImages[layerName];
      
      if (bgData && bgData.dataURL) {
        // Create a new Image object and set its source to the data URL
        const img = new Image();
        img.onload = () => {
          console.log(`Background image loaded for layer ${layerName}`);
          // Only redraw if we're currently viewing this layer
          if (view.layer === layerName) {
            redraw();
          }
        };
        
        // Store the background image data
        backgroundImages[layerName] = {
          image: img,
          x: bgData.x || 0,
          y: bgData.y || 0,
          width: bgData.width || 0,
          height: bgData.height || 0,
          opacity: bgData.opacity || 0.5,
          dataURL: bgData.dataURL
        };
        
        // Set the source last to trigger the load
        img.src = bgData.dataURL;
      }
    }
  }

  // Set view to first layer
  if (loadedLayers.length > 0) {
    view.layer = loadedLayers[0];
  }

  // Enable node drawing
  drawNodes = false;

  validateAllConnections();        // validate all connections
  normalizeLayerReferences();       // normalize layer references
  recalculateAllConnectionDistances(); // recalculate distances

  // Update UI
  checkMapSetup();
  updateBackgroundImageUI();
  redraw();
  
  console.log("Map loaded successfully with", loadedLayers.length, "layers");
}

function recalculateAllConnectionDistances() {
    console.log("Recalculating all connection distances...");
    
    // Go through each layer
    for (const layer of loadedLayers) {
      if (!nodeGraph[layer]) continue;
      
      // Go through each node
      for (let i = 0; i < nodeGraph[layer].length; i++) {
        const node = nodeGraph[layer][i];
        if (!node) continue;
        
        // Recalculate distances for each connection within the same layer
        for (let j = 0; j < node.connections.length; j++) {
          const conn = node.connections[j];
          
          // Only process connections within the same layer
          if (!conn.layer) {
            const targetNode = nodeGraph[layer][conn.id];
            if (targetNode) {
              // Recalculate distance
              const dx = node.x - targetNode.x;
              const dy = node.y - targetNode.y;
              conn.distance = Math.sqrt(dx*dx + dy*dy);
            }
          }
        }
      }
    }
    
    console.log("Connection distances recalculated");
  }

function validateAllConnections() {
  console.log("Validating all connections...");
  let fixedConnections = 0;
  
  for (const layer of loadedLayers) {
    if (!nodeGraph[layer]) continue;
    
    for (let i = 0; i < nodeGraph[layer].length; i++) {
      const node = nodeGraph[layer][i];
      if (!node) continue;
      
      // Check each connection
      for (let j = node.connections.length - 1; j >= 0; j--) {
        const conn = node.connections[j];
        let isValid = false;
        
        if (conn.layer) {
          // Cross-layer connection
          isValid = nodeGraph[conn.layer] && nodeGraph[conn.layer][conn.id];
        } else {
          // Same-layer connection
          isValid = nodeGraph[node.layer][conn.id];
        }
        
        if (!isValid) {
          console.log(`Removing invalid connection from node ${node.id} to ${conn.id} ${conn.layer ? 'in layer ' + conn.layer : ''}`);
          node.connections.splice(j, 1);
          fixedConnections++;
        }
      }
    }
  }
  
  console.log(`Fixed ${fixedConnections} invalid connections`);
}


function validateAllConnections() {
    console.log("Validating all connections...");
    let fixedConnections = 0;
    
    for (const layer of loadedLayers) {
      if (!nodeGraph[layer]) continue;
      
      for (let i = 0; i < nodeGraph[layer].length; i++) {
        const node = nodeGraph[layer][i];
        if (!node) continue;
        
        // Check each connection
        for (let j = node.connections.length - 1; j >= 0; j--) {
          const conn = node.connections[j];
          let isValid = false;
          
          if (conn.layer) {
            // Cross-layer connection
            isValid = nodeGraph[conn.layer] && nodeGraph[conn.layer][conn.id];
          } else {
            // Same-layer connection
            isValid = nodeGraph[node.layer][conn.id];
          }
          
          if (!isValid) {
            console.log(`Removing invalid connection from node ${node.id} to ${conn.id} ${conn.layer ? 'in layer ' + conn.layer : ''}`);
            node.connections.splice(j, 1);
            fixedConnections++;
          }
        }
      }
    }
    
    console.log(`Fixed ${fixedConnections} invalid connections`);
}

function normalizeLayerReferences() {
    console.log("Normalizing layer references in connections...");
    let normalizedConnections = 0;
    
    for (const layer of loadedLayers) {
      if (!nodeGraph[layer]) continue;
      
      for (let i = 0; i < nodeGraph[layer].length; i++) {
        const node = nodeGraph[layer][i];
        if (!node) continue;
        
        // Ensure the node has correct layer
        node.layer = layer;
        
        // For same-layer connections, make sure they don't have a layer field
        for (let j = 0; j < node.connections.length; j++) {
          const conn = node.connections[j];
          
          // If connection is to same layer but has a layer field
          if (conn.layer && conn.layer === layer) {
            delete conn.layer; // Remove unnecessary layer field
            normalizedConnections++;
          }
        }
      }
    }
    
    console.log(`Normalized ${normalizedConnections} connections`);
  }

// Initialize the application with either localStorage data or JSON file
document.addEventListener("DOMContentLoaded", function() {
  setTimeout(() => {
    // Check if we need to load the map from file
    // This checks both if localStorage is empty AND if the application hasn't loaded any layers yet
    if (!hasStoredMap() && (loadedLayers.length === 0 || 
        !nodeGraph[loadedLayers[0]] || 
        nodeGraph[loadedLayers[0]].length === 0)) {
      
      console.log("No saved map found, loading from file...");
      
      loadMapFromFile()
        .then(mapData => {
          processMapData(mapData);
          console.log("Map loaded successfully from file");
          
          // Optionally save to localStorage for faster loading next time
          // Uncomment if you want this
          // localStorage.setItem(STORAGE_KEY, JSON.stringify(mapData));
        })
        .catch(error => {
          console.error("Failed to load map from file:", error);
          
          // Initialize with empty data as fallback
          console.log("Initializing with empty map as fallback");
          initializeTestData();
        });
    } else {
      console.log("Using existing map data");
    }
  }, 100); // Small delay to ensure main init is complete
});

// Add a load map button to the UI
document.addEventListener("DOMContentLoaded", function() {
  // Create a load file button
  const loadFileBtn = document.createElement('button');
  loadFileBtn.id = 'loadMapFile';
  loadFileBtn.className = 'w-full p-1 rounded border bg-blue-100 border-blue-300 text-xs';
  loadFileBtn.textContent = 'Load Map from File';
  loadFileBtn.style.marginTop = '8px';
  
  // Add the button to the Save & Load section
  const saveLoadSection = document.querySelector('#editorTools .mt-4');
  if (saveLoadSection) {
    saveLoadSection.appendChild(loadFileBtn);
    
    // Add click event
    loadFileBtn.addEventListener('click', function() {
      if (confirm('Load map from file? This will replace your current map.')) {
        loadMapFromFile()
          .then(mapData => {
            processMapData(mapData);
            alert('Map loaded successfully from file.');
          })
          .catch(error => {
            console.error("Failed to load map:", error);
            alert('Failed to load map. See console for details.');
          });
      }
    });
  }
});