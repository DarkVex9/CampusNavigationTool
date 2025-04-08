/**
 * pathfinding.js - A* Pathfinding algorithm implementation
 */

// Main pathfinding function using A* algorithm
function findPath(sourceNode, destinationNode, userPreferences = {}) {
    console.log("Finding path from", sourceNode, "to", destinationNode, "with preferences:", userPreferences);
    
    // Default preferences if not specified
    const preferences = {
        avoidStairs: userPreferences.avoidStairs || false,
        avoidElevators: userPreferences.avoidElevators || false,
        ...userPreferences
    };
    
    // Create open and closed sets
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    
    // For node n, gScore[n] is the cost of the cheapest path from start to n currently known
    const gScore = new Map();
    
    // For node n, fScore[n] = gScore[n] + h(n). fScore[n] represents our current best guess as to
    // how cheap a path could be from start to finish if it goes through n
    const fScore = new Map();
    
    // For node n, cameFrom[n] is the node immediately preceding it on the cheapest path from start
    const cameFrom = new Map();
    
    // Initialize gScore and fScore with infinity for all nodes
    for (const layerName of loadedLayers) {
        if (!nodeGraph[layerName]) continue;
        
        for (const node of nodeGraph[layerName]) {
            if (node) {
                gScore.set(getNodeKey(node), Infinity);
                fScore.set(getNodeKey(node), Infinity);
            }
        }
    }
    
    // The cost from start to start is zero
    gScore.set(getNodeKey(sourceNode), 0);
    
    // For the first node, the fScore equals the heuristic cost to goal
    fScore.set(getNodeKey(sourceNode), heuristic(sourceNode, destinationNode));
    
    // Add the start node to the open set
    openSet.enqueue(sourceNode, fScore.get(getNodeKey(sourceNode)));
    
    while (!openSet.isEmpty()) {
        // Get the node with the lowest fScore value
        const current = openSet.dequeue();
        
        // If we've reached the destination, reconstruct and return the path
        if (current === destinationNode) {
            return reconstructPath(cameFrom, current);
        }
        
        // Add current node to closed set
        closedSet.add(getNodeKey(current));
        
        // Check all neighbors of the current node
        for (const connection of current.connections) {
            // Get the connected node
            let neighbor;
            let weight;
            
            if (connection.flags && connection.flags.includes("layerChange")) {
                // Handle layer change connections (elevators, stairs, etc.)
                neighbor = nodeGraph[connection.layer][connection.id];
                
                // Apply penalty for stairs or elevators if user wants to avoid them
                if ((connection.flags.includes("stairs") && preferences.avoidStairs) ||
                    (connection.flags.includes("elevator") && preferences.avoidElevators)) {
                    // Set a high penalty to discourage using these unless necessary
                    weight = 1000; 
                } else {
                    // Default weight for layer changes
                    weight = 10; // Slightly higher than normal connections to prefer same-floor routes when equal
                }
            } else {
                // Handle normal connections within the same layer
                neighbor = nodeGraph[current.layer][connection.id];
                weight = connection.distance;
            }
            
            // Skip if the neighbor is null (deleted node) or in the closed set
            if (!neighbor || closedSet.has(getNodeKey(neighbor))) {
                continue;
            }
            
            // Calculate tentative gScore
            const tentativeGScore = gScore.get(getNodeKey(current)) + weight;
            
            // If this path to neighbor is better than any previous one, record it
            if (tentativeGScore < gScore.get(getNodeKey(neighbor))) {
                // Record the best path so far
                cameFrom.set(getNodeKey(neighbor), current);
                gScore.set(getNodeKey(neighbor), tentativeGScore);
                fScore.set(getNodeKey(neighbor), tentativeGScore + heuristic(neighbor, destinationNode));
                
                // Add to open set if not already there
                if (!openSet.contains(neighbor)) {
                    openSet.enqueue(neighbor, fScore.get(getNodeKey(neighbor)));
                }
            }
        }
    }
    
    // If we get here, there's no path found
    console.log("No path found between nodes");
    return null;
}

// A* heuristic function - Euclidean distance for same layer, 
// with an added penalty for layer changes
function heuristic(nodeA, nodeB) {
    // Base distance - Euclidean distance
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    let distance = Math.sqrt(dx*dx + dy*dy);
    
    // Add penalty for layer change
    if (nodeA.layer !== nodeB.layer) {
        distance += 100; // Penalty for changing layers
    }
    
    return distance;
}

// Reconstruct the path from source to destination
function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    
    while (cameFrom.has(getNodeKey(current))) {
        current = cameFrom.get(getNodeKey(current));
        totalPath.unshift(current);
    }
    
    return totalPath;
}

// Draw the path on the canvas
function drawPath(path) {
    if (!path || path.includes(null)) {
        return; // Something is wrong, abort
    }
    
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = pathWidth;
    ctx.beginPath();
    
    let i = 0;
    while (i < path.length && i != -1) {
        i = path.map((x) => { return x.layer }).indexOf(view.layer, i);
        if (i == -1) {
            break;
        }
        
        ctx.moveTo(...nodeToCanvasPos(path[i]));
        i++;
        
        while (i < path.length && path[i].layer == view.layer) {
            ctx.lineTo(...nodeToCanvasPos(path[i]));
            i++;
        }
    }
    
    ctx.stroke();
}