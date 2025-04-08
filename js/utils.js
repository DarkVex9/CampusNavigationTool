/**
 * utils.js - Utility functions for the navigation system
 */

// Canvas position conversion utilities
function nodeToCanvasPos(node) {
    return posToCanvasPos(node.x, node.y);
}

function posToCanvasPos(x, y) {
    return [(x + view.x) * view.zoom + canvas.width / 2, (y + view.y) * view.zoom + canvas.height / 2];
}

function canvasPosToPos(x, y) {
    return [(x - canvas.width / 2) / view.zoom - view.x, (y - canvas.height / 2) / view.zoom - view.y];
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

// Helper class for priority queue (used in pathfinding)
class PriorityQueue {
    constructor() {
        this.elements = [];
        this.elementSet = new Set(); // Used to check if an element exists quickly
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

// Helper function to get the center point of an area
function getAreaCenter(area) {
    if (!area || !area.points || area.points.length === 0) {
        return null;
    }
    
    const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
    const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
    
    return { x: centerX, y: centerY };
}

// Calculate area of a polygon
function calculatePolygonArea(points) {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += (points[i].x + points[j].x) * (points[j].y - points[i].y);
    }
    return Math.abs(area / 2);
}