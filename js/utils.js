/**
 * utils.js - Utility functions for the navigation system
 */

// Canvas position conversion utilities
function nodeToCanvasPos(node) {
    return posToCanvasPos(node.x, node.y);
  }
  
  function posToCanvasPos(x, y) {
    return [
      (x + view.x) * view.zoom + canvas.width / 2,
      (y + view.y) * view.zoom + canvas.height / 2
    ];
  }
  
  function canvasPosToPos(x, y) {
    return [
      (x - canvas.width / 2) / view.zoom - view.x,
      (y - canvas.height / 2) / view.zoom - view.y
    ];
  }
  
  // Drawing utilities
  function drawCircle(x, y, radius, color, fill = false) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(...posToCanvasPos(x, y), radius, 0, 2 * Math.PI);
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.stroke();
  }
  
  // Generate a unique key for a node
  function getNodeKey(node) {
    return `${node.layer}_${node.id}`;
  }
  
  // Priority Queue for pathfinding
  class PriorityQueue {
    constructor() {
      this.elements = [];
      this.elementSet = new Set();
    }
    enqueue(element, priority) {
      this.elements.push({ element, priority });
      this.elements.sort((a, b) => a.priority - b.priority);
      this.elementSet.add(getNodeKey(element));
    }
    dequeue() {
      if (this.elements.length === 0) return null;
      const item = this.elements.shift();
      this.elementSet.delete(getNodeKey(item.element));
      return item.element;
    }
    isEmpty() {
      return this.elements.length === 0;
    }
    contains(element) {
      return this.elementSet.has(getNodeKey(element));
    }
  }
  
  function dumpLayerInfo() {
    console.log("===== Layer Information =====");
    console.log("Current view layer:", view.layer);
    console.log("Loaded layers:", loadedLayers);
    
    for (const layer of loadedLayers) {
      const nodeCount = nodeGraph[layer] ? nodeGraph[layer].filter(n => n !== null).length : 0;
      const namedNodeCount = namedNodes[layer] ? namedNodes[layer].length : 0;
      console.log(`Layer: ${layer}`);
      console.log(`  Nodes: ${nodeCount}`);
      console.log(`  Named Nodes: ${namedNodeCount}`);
      console.log(`  Map Image: ${layerData[layer] ? layerData[layer].mapImage : 'undefined'}`);
    }
    console.log("=============================");
  }
  
  // Helper function to get the center of an area
  function getAreaCenter(area) {
    if (!area || !area.points || area.points.length === 0) {
      return null;
    }
    const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
    const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
    return { x: centerX, y: centerY };
  }
  
  // Calculate polygon area
  function calculatePolygonArea(points) {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      area += (points[i].x + points[j].x) * (points[j].y - points[i].y);
    }
    return Math.abs(area / 2);
  }

// Convert file to data URL
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Export map to file
function exportMapToFile() {
  // Prepare data for export
  const exportData = {
    layers: {},
    backgroundImages: {}
  };
  
  for (const layer of loadedLayers) {
    if (nodeGraph[layer] && nodeGraph[layer].length > 0) {
      // Clean up the data by removing nulls
      const cleanNodes = nodeGraph[layer].filter(node => node !== null);
      
      exportData.layers[layer] = {
        metadata: layerData[layer] || {},
        nodes: cleanNodes,
        namedNodes: namedNodes[layer] || [],
        areas: areas[layer] || []
      };
      
      // Add background image info but not the actual image object
      if (backgroundImages[layer]) {
        // Store a copy without the Image object
        exportData.backgroundImages[layer] = {
          x: backgroundImages[layer].x,
          y: backgroundImages[layer].y,
          width: backgroundImages[layer].width,
          height: backgroundImages[layer].height,
          opacity: backgroundImages[layer].opacity || 0.5,
          dataURL: backgroundImages[layer].dataURL || null
        };
      }
    }
  }
  
  // Convert to JSON
  const jsonData = JSON.stringify(exportData, null, 2);
  
  // Create download link
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'txst_map_data.json';
  a.click();
  URL.revokeObjectURL(url);
  
  console.log("Map data exported to file");
}

// Import map from file
function importMapFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Reset current data
        nodeGraph = {};
        namedNodes = {};
        areas = {};
        layerData = {};
        backgroundImages = {};
        loadedLayers = [];

        // Load each layer
        for (const layerName in importData.layers) {
          const layer = importData.layers[layerName];
          
          // Add to loaded layers
          loadedLayers.push(layerName);
          
          // Set data
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
              img.onerror = (err) => {
                console.error(`Error loading background image for layer ${layerName}:`, err);
              };
              
              // Store the background image data
              backgroundImages[layerName] = {
                image: img,  // This will be populated once the image loads
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
        
        // Restore view layer
        if (loadedLayers.length > 0) {
          view.layer = loadedLayers[0];
        }
        
        // Update UI
        checkMapSetup();
        updateBackgroundImageUI();
        redraw();
        
        console.log("Map loaded from file successfully");
        resolve(true);
      } catch (err) {
        console.error("Error parsing imported map data:", err);
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsText(file);
  });
}

// Save map data to local storage
function saveMapToLocalStorage() {
  // Prepare data for export
  const exportData = {
    layers: {},
    backgroundImages: {}
  };
  
  for (const layer of loadedLayers) {
    if (nodeGraph[layer] && nodeGraph[layer].length > 0) {
      // Clean up the data by removing nulls
      const cleanNodes = nodeGraph[layer].filter(node => node !== null);
      
      exportData.layers[layer] = {
        metadata: layerData[layer] || {},
        nodes: cleanNodes,
        namedNodes: namedNodes[layer] || [],
        areas: areas[layer] || []
      };
      
      // Add background image info but not the actual image object
      if (backgroundImages[layer]) {
        exportData.backgroundImages[layer] = {
          x: backgroundImages[layer].x,
          y: backgroundImages[layer].y,
          width: backgroundImages[layer].width,
          height: backgroundImages[layer].height,
          opacity: backgroundImages[layer].opacity || 0.5,
          dataURL: backgroundImages[layer].dataURL || null
        };
      }
    }
  }
  
  // Save to local storage
  try {
    localStorage.setItem('txstNavigationMapData', JSON.stringify(exportData));
    console.log("Map saved to local storage successfully");
    return true;
  } catch (e) {
    console.error("Error saving to local storage:", e);
    return false;
  }
}

// Load map data from local storage
function loadMapFromLocalStorage() {
  try {
    const savedData = localStorage.getItem('txstNavigationMapData');
    if (!savedData) {
      console.log("No saved map data found in local storage");
      return false;
    }

    const importData = JSON.parse(savedData);
    console.log("Loading saved map data:", importData);

    // Reset current data
    nodeGraph = {};
    namedNodes = {};
    areas = {};
    backgroundImages = {};
    loadedLayers = [];

    // Load each layer
    for (const layerName in importData.layers) {
      const layer = importData.layers[layerName];

      // Add to loaded layers
      loadedLayers.push(layerName);

      // Set data
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
            image: img,  // This will be populated once the image loads
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

    // Restore view layer
    if (loadedLayers.length > 0) {
      view.layer = loadedLayers[0];
    }

    // Update UI
    checkMapSetup();
    updateBackgroundImageUI();
    redraw();

    console.log("Map loaded from local storage successfully");
    return true;
  } catch (e) {
    console.error("Error loading from local storage:", e);
    return false;
  }
}