/**
 * main.js - Main application initialization
 */

// Global variables
var editorAllowed = true; // Whether editor tools are allowed

// Initialize the application
function init() {
    console.log("Initializing Navigation Application");
    
    // Initialize UI
    initUI();
    
    // Load test data
    initializeTestData();
    
    // Initial render
    redraw();
}

// Call init when the page loads
window.addEventListener("load", init);