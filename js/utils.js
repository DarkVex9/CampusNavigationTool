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
      
      // Add background image info but not the actual image data
      if (backgroundImages[layer]) {
        exportData.backgroundImages[layer] = {
          x: backgroundImages[layer].x,
          y: backgroundImages[layer].y,
          opacity: backgroundImages[layer].opacity,
          width: backgroundImages[layer].width,
          height: backgroundImages[layer].height
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
    loadedLayers = [];
    
    // Load each layer
    for (const layerName in importData.layers) {
      const layerData = importData.layers[layerName];
      
      // Add to loaded layers
      if (!loadedLayers.includes(layerName)) {
        loadedLayers.push(layerName);
      }
      
      // Set nodes
      nodeGraph[layerName] = layerData.nodes || [];
      
      // Set named nodes
      namedNodes[layerName] = layerData.namedNodes || [];
      
      // Set areas
      areas[layerName] = layerData.areas || [];
    }
    
    // Restore current layer
    if (loadedLayers.length > 0 && !view.layer) {
      view.layer = loadedLayers[0];
    }
    
    // Update UI
    checkMapSetup();
    redraw();
    
    console.log("Map loaded from local storage successfully");
    return true;
  } catch (e) {
    console.error("Error loading from local storage:", e);
    return false;
  }
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
      
      // Add background image info but not the actual image data
      if (backgroundImages[layer]) {
        exportData.backgroundImages[layer] = {
          x: backgroundImages[layer].x,
          y: backgroundImages[layer].y,
          opacity: backgroundImages[layer].opacity,
          width: backgroundImages[layer].width,
          height: backgroundImages[layer].height
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
    
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        console.log("Parsing imported map data:", importData);
        
        // Reset current data
        nodeGraph = {};
        namedNodes = {};
        areas = {};
        loadedLayers = [];
        
        // Load each layer
        for (const layerName in importData.layers) {
          const layerData = importData.layers[layerName];
          
          // Add to loaded layers
          if (!loadedLayers.includes(layerName)) {
            loadedLayers.push(layerName);
          }
          
          // Set nodes
          nodeGraph[layerName] = layerData.nodes || [];
          
          // Set named nodes
          namedNodes[layerName] = layerData.namedNodes || [];
          
          // Set areas
          areas[layerName] = layerData.areas || [];
        }
        
        // Restore current layer
        if (loadedLayers.length > 0) {
          view.layer = loadedLayers[0];
        }
        
        // Update UI
        checkMapSetup();
        redraw();
        
        console.log("Map imported successfully");
        resolve(true);
      } catch (e) {
        console.error("Error parsing imported map data:", e);
        reject(e);
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
}