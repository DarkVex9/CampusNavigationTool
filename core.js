// ===== Global Variables =====
var originField = document.getElementById("origin");
var destinationField = document.getElementById("destination");
var mapImgElement = document.getElementById("mainMapImg");
var canvas = document.getElementById("overlay");
var ctx = canvas.getContext("2d");	//overlay canvas context
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var nodeGraph = {};		//each loaded layer is a property of this variable containing an array of all nodes
var namedNodes = {};		//each loaded layer is a property of this variable containing an array of all named nodes
var loadedLayers = [];		//array of what layers are loaded stored in string form
var layerData = {};		//each loaded layer is a property of this variable containing metadata about the layer (so far just imgScale)
var loadingCount = 0;		//count of files that have been requested to load, but have not been recieved and/or processed yet. Might get wrong answers if you try to work with the nodeGraph when this is not zero.
var view = {x:0,y:0,zoom:1,layer:"outside",renderedLayer:""}
var pathColor = "#ff0000";	//Path line color
var pathWidth = 4;		//Path line width in pixels
var currentPath;		//Stores currently drawn path if there is one
var isDragging = false;

//Editor Specific Variables
var editorAllowed = true;
var editorMoveRange = 500;	//Max range that the move tool can grab a node from
var editorStyle = {
	nodeColor:"#42F5C2",
	nodeRadius: 5,
	nodeHighlightColor:"#EDC618",
	connectionColor:"#888888",
	connectionWidth:3,
	connectionHighlightColor:"#EDC618",
	connectionHighlightWidth:5,
	hintColor:"#C9C5A9"
}
var editorContainer = document.getElementById("editorTools");
var editorLayerSelect = document.getElementById("layerSelect");
var editorModeLabel = document.getElementById("editorMode");
var editorMode = "none";
var editorSelectedNode;
var drawNodes = false;
var tempConnectingNode;
var tempIsHintDrawn = false;


// ===== Other Initialization =====
console.log("JavaScript started");
document.getElementById("go_button").addEventListener("click",handleGoButton);
document.addEventListener("keydown",handleKeyPress);
document.addEventListener("mousedown",handleMouseDown);
document.addEventListener("mousemove",handleMouseMove);
document.addEventListener("mouseup",handleMouseUp);
document.addEventListener("wheel",handleScroll);
editorLayerSelect.addEventListener("change",handleLayerDropdown);
if(editorAllowed){editorContainer.style.display = "inline-block";}




// ===== Temporary Test Stuff =====

loadLayerFromJSON(loadFile("outside"));
loadLayerFromJSON(loadFile("derrick_test"));
currentPath = nodeGraph["outside"];
//Yes, the current test points aren't connected the same way the path is. That was intentional for easy testing of the drawing stuff.
redraw();



if(!loadedLayers.includes("outside")){view.layer = null}
if(!view.layer && loadedLayers.length > 0){view.layer = loadedLayers[0];}


// ===== Functions =====
function handleGoButton(){
	console.log("Go Button Pressed");
	if(nodeGraph.length == 0 || loadingCount != 0){
		console.log("Search canceled - Something isn't ready yet. \nNode Count: "+nodeGraph.length+"\nWaiting on "+loadingCount+" files");
		return;		//Abort search
	}
	let startNode = findByName(originField.value);
	let endNode = findByName(destinationField.value);
	if(!startNode || !endNode){
		console.log("Search canceled - Couldn't find node by name. \nStart String:'"+originField.value.trim()+"'\nEnd String:'"+destinationField.value.trim()+"'\nStart Found:"+startNode+"\nEnd Found:"+endNode);
		return;		//Abort search
	}
	let path = findPath(startNode, endNode);

	if(!path){
		console.log("Path not found");
		return; 	//Search failed
	}
	currentPath = path;
}

function handleKeyPress(event){
	//console.log("Key Pressed - "+event.key);
	switch(event.key){
		case "p":
			//"Print" current layer data
			if(editorAllowed){
				quantizeNodePositions();
				console.log(JSON.stringify({name:view.layer,metadata:layerData[view.layer],graph:nodeGraph[view.layer],namedNodes:namedNodes[view.layer]}));
			}
			break;
		case "u":
			//temp test key for quantizing coordinates to save space in string form
			if(editorAllowed){
				quantizeNodePositions();
			}
			break;
		case "a":
			//"Add" editor mode
			if(editorAllowed){
				console.log("Editor Mode - Add");
				editorMode = "add";
				editorModeLabel.innerText = "Editor Mode: Add";
			}
			break;
		case "m":
			//"Move" editor mode
			if(editorAllowed){
				console.log("Editor Mode - Move");
				editorMode = "move";
				editorModeLabel.innerText = "Editor Mode: Move";
			}
			break;
		case "e":
			//"Edit" editor mode
			if(editorAllowed){
				console.log("Editor Mode - Edit");
				editorMode = "edit";
				editorModeLabel.innerText = "Editor Mode: Edit";
			}
			break;
		case "c":
			//"Connect" editor mode
			if(editorAllowed){
				console.log("Editor Mode - Connect");
				editorMode = "connect";
				editorModeLabel.innerText = "Editor Mode: Connect";
			}
			break;
		case "Escape":
			//Clear editor mode
			if(editorAllowed){
				//Clear selected node if we are already in mode none
				if(editorMode == "none"){
					editorSelectedNode = null;
					redraw();
				}
				console.log("Editor Mode - None");
				editorMode = "none";
				editorModeLabel.innerText = "Editor Mode: None";
			}
			break;
		case "Backspace":
		case "Delete":
			//Delete selected node
			if(editorAllowed && editorSelectedNode){
				while(editorSelectedNode.connections.length > 0){
					disconnectNodes(editorSelectedNode,nodeGraph[editorSelectedNode.layer][editorSelectedNode.connections[0].id]);
				}
				nodeGraph[editorSelectedNode.layer][editorSelectedNode.id] = null;
				editorSelectedNode = null;
				redraw();
			}
			break;
		case "d":
			//Toggle "Draw" nodes
			if(editorAllowed){
				drawNodes = !drawNodes;
				console.log("Draw Nodes " + (drawNodes?"Enabled":"Disabled"));
				redraw();
			}
			break;
	}
}

function handleMouseDown(event){
	console.log("Mouse Down");
	if(event.button != 0){
		return;		//don't need to do anything if it isn't a primary (left) click
	}
	if(event.target == canvas || event.target == document.body){
		if(!editorMode || editorMode == "none"){
			isDragging = true;
		}else if(editorMode == "move" || editorMode == "edit" || editorMode == "connect"){
			
			isDragging = true;
			//console.log("Event Pos:",event.pageX,event.pageY);
			//console.log("Adjusted Pos:",...canvasPosToPos(event.pageX,event.pageY))
			editorSelectedNode = findNearestNode(...canvasPosToPos(event.pageX,event.pageY));
			if(editorMode == "move"){
				let cursorPos = canvasPosToPos(event.pageX,event.pageY)
				let distance = Math.sqrt( Math.pow(editorSelectedNode.x-cursorPos[0],2) + Math.pow(editorSelectedNode.y-cursorPos[1],2) );
				if(distance > (editorMoveRange/Math.sqrt(view.zoom))){
					editorSelectedNode = null;
					return;		//nearest node is outside max move range
				}
			}			
			console.log("Selected Node",editorSelectedNode);
			redraw();
			console.log("Selected Node (id:"+editorSelectedNode.id+",x:"+editorSelectedNode.x+",y:"+editorSelectedNode.y+")");
		}else if(editorMode == "add"){
			editorSelectedNode = createNode(view.layer,...canvasPosToPos(event.pageX,event.pageY));
			redraw();
		}
	}
}

function handleMouseUp(event){
	if(event.button != 0){
		return;		//don't need to do anything if it isn't a primary (left) click
	}
	if(editorMode == "connect"){
		let node2 = findNearestNode(...canvasPosToPos(event.pageX,event.pageY))
		if(editorSelectedNode != node2){
			if(editorSelectedNode.connections.map((x)=>x.id).includes(node2.id)){
				console.log("Disconnected Nodes", editorSelectedNode, node2);
				disconnectNodes(editorSelectedNode,node2);
				redraw();
			}else{
				console.log("Connected Nodes", editorSelectedNode, node2);
				connectNodes(editorSelectedNode,node2);
				redraw();
			}
		}else{
			console.log("Cannot connect node to itself.");
		}
	}
	isDragging = false;
}

function handleMouseMove(event){
	if(isDragging){
		if(editorMode == "move" && editorSelectedNode){
			let pos = canvasPosToPos(event.pageX,event.pageY)
			moveNode(editorSelectedNode,...pos);
			redraw();
		}else if(editorMode == "connect"){
			let node2 = findNearestNode(...canvasPosToPos(event.pageX,event.pageY));
			if (tempConnectingNode != node2){
				redraw();
				tempConnectingNode = node2;
				ctx.strokeStyle = editorStyle.connectionHighlightColor;
				ctx.lineWidth = editorStyle.connectionHighlightWidth;
				ctx.beginPath();
				ctx.moveTo(...posToCanvasPos(editorSelectedNode.x,editorSelectedNode.y));
				ctx.lineTo(...posToCanvasPos(node2.x,node2.y));
				ctx.stroke();
			} 
		}else{
			view.x = view.x + event.movementX / view.zoom;
			view.y = view.y + event.movementY / view.zoom;
			//mapImgElement.style.left = view.x + "px";
			//mapImgElement.style.top = view.y + "px";
			redraw();
		}
	}else{
		if(editorMode == "move"){
			let cursorPos = canvasPosToPos(event.pageX,event.pageY)
			let node = findNearestNode(...cursorPos);
			let distance = Math.sqrt( Math.pow(node.x-cursorPos[0],2) + Math.pow(node.y-cursorPos[1],2) );
			if(distance < (editorMoveRange/Math.sqrt(view.zoom))){
				tempIsHintDrawn = true;
				redraw();
				ctx.strokeStyle = editorStyle.connectionHighlightColor;
				ctx.strokeStyle = editorStyle.hintColor;
				ctx.lineWidth = editorStyle.connectionHighlightWidth;
				ctx.beginPath();
				ctx.moveTo(event.pageX,event.pageY);
				ctx.lineTo(...posToCanvasPos(node.x,node.y));
				ctx.stroke();
			}else if(tempIsHintDrawn){
				tempIsHintDrawn = false;
				redraw();
			}
		}
	}
}

function handleScroll(event){
	view.zoom = view.zoom * Math.pow(Math.E,-1*event.deltaY/400);
	redraw();
	//console.log(view.zoom);
}

function updateMapImageTransform(){
		mapImgElement.style.transform = `scale(${view.zoom}) translate(${view.x + canvas.width/2/view.zoom}px, ${view.y + canvas.height/2/view.zoom}px)`;
}
//function updateMapImageTransform(){
//		mapImgElement.style.transform = `scale(${view.zoom}) translate(${view.x}px, ${view.y}px)`;
//}

function findByName(searchString){
	searchString = searchString.trim();
	for(let i=0;i<loadedLayers.length;i++){
		let result = namedNodes[loadedLayers[i]].find((x)=>{x.name == searchString});
		if(result){
			return result;	//Return matching node
		}
	}
	return false;	//Return false on a failed search
}

function findNearestNode(x, y, layer = view.layer){
	//Find the nearest node to a point on the specified layer, or the current layer if none is specified.
	//Technically this computes square distances essentially skipping the square root in the pythagorean theorem, but since it is only used for relative comparisons it saves processing and makes no difference to the answer.

	let bestNode;
	let bestDistance = Number.MAX_VALUE;
	for(let i=0;i<nodeGraph[view.layer].length;i++){
		if(!nodeGraph[view.layer][i]){
			continue;
		}
		let node = nodeGraph[view.layer][i];
		let workingDistance = Math.pow(x-node.x,2) + Math.pow(y-node.y,2);
		if(workingDistance < bestDistance){
			bestNode = node;
			bestDistance = workingDistance;
		}
	}
	return bestNode;
}

function findPath(sourceNode,destinationNode){
	//TODO: Path search stuff
	return ;	//Return array of nodes making up the path, or false for a failed search
}

function redraw(){
	if(view.layer != view.renderedLayer){
		mapImgElement.src = "map_images/"+layerData[view.layer].mapImage;
		view.renderedLayer = view.layer;
	}
	updateMapImageTransform();
	ctx.clearRect(0,0,canvas.width,canvas.height);
	if(currentPath){
		drawPath(currentPath);
	}
	if(drawNodes){
		ctx.strokeStyle = editorStyle.connectionColor;
		ctx.lineWidth = editorStyle.connectionWidth;
		ctx.beginPath();
		//Draw connections
		for(let i=0;i<nodeGraph[view.layer].length;i++){
			if(!nodeGraph[view.layer][i]){
				continue;
			}
			let node = nodeGraph[view.layer][i];
			for(let j=0;j<node.connections.length;j++){
				if(!node.connections[j].flags.includes("layerChange")){
					let node2 = nodeGraph[view.layer][node.connections[j].id];
					ctx.moveTo(...nodeToCanvasPos(node));
					ctx.lineTo(...nodeToCanvasPos(node2));
				}
			}
		}
		ctx.stroke();
		//Draw Nodes
		for(let i=0;i<nodeGraph[view.layer].length;i++){
			if(!nodeGraph[view.layer][i]){
				continue;
			}
			let node = nodeGraph[view.layer][i];
			drawCircle(node.x,node.y,editorStyle.nodeRadius,editorStyle.nodeColor);
		}
		//Highlight selected node
		if(editorSelectedNode){
			drawCircle(editorSelectedNode.x,editorSelectedNode.y,editorStyle.nodeRadius,editorStyle.nodeHighlightColor);
			drawCircle(editorSelectedNode.x,editorSelectedNode.y,editorStyle.nodeRadius/2,editorStyle.nodeHighlightColor);
		}
	}
}

function drawCircle(x,y,radius,color){
	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.arc(...posToCanvasPos(x, y), radius, 0, 2*Math.PI);
	ctx.stroke();
}

function drawPath(path){
	if(path.includes(null)){
		return;	//Something is wrong, abort
	}
	ctx.strokeStyle = pathColor;
	ctx.lineWidth = pathWidth;
	ctx.beginPath();
	let i=0;
	while(i < path.length && i != -1){
		i = path.map((x)=>{return x.layer}).indexOf(view.layer,i);
		if(i == -1){
			break;
		}
		ctx.moveTo(...nodeToCanvasPos(path[i]));
		i++;
		while(i<path.length && path[i].layer == view.layer){
			ctx.lineTo(...nodeToCanvasPos(path[i]));
			i++;
		}
	}
	ctx.stroke();
}

function nodeToCanvasPos(node){
	return posToCanvasPos(node.x,node.y);
}

function posToCanvasPos(x,y){
	return [(x+view.x)*view.zoom + canvas.width/2, (y+view.y)*view.zoom + canvas.height/2];
}

function canvasPosToPos(x,y){
	return [(x - canvas.width/2)/view.zoom - view.x, (y - canvas.height/2)/view.zoom - view.y];
}


// ===== Editor Functions =====
function createNode(layer,x,y,name=""){
	let id;
	if(loadedLayers.includes(layer)){
		id = nodeGraph[layer].length;
	}else{
		id = 0;
		loadedLayers.push(layer);
		prepLayer(layer);
		nodeGraph[layer] = [];
		namedNodes[layer] = [];
		layerData[layer] = {imgScale:1};
	}
	let node = {id:id,x:x,y:y,layer:layer,connections:[]};
	if(name){
		node.name = name;
	}
	nodeGraph[layer][id] = node;
	return node;
}

function connectNodes(node1,node2,flags){
	if(node1 == node2){
		return;		//cannot connect a node to itself
	}
	if(node1.connections.some((x)=>{x.id == node2.id}) || node2.connections.some((x)=>{x.id == node1.id})){
		return;		//already connected
	}
	if(node1.layer == node2.layer){
		let distance = Math.sqrt( Math.pow(node1.x-node2.x,2) + Math.pow(node1.y-node2.y,2) );
		node1.connections.push({id:node2.id,distance:distance,flags:[]});
		node2.connections.push({id:node1.id,distance:distance,flags:[]});
	}else{
		node1.connections.push({id:node2.id,layer:node2.layer,flags:["layerChange"]});
		node2.connections.push({id:node1.id,layer:node1.layer,flags:["layerChange"]});
	}
}

function disconnectNodes(node1,node2){
	if(node1 == node2){
		return;		//cannot disconnect a node from itself
	}
	let node1Index = node1.connections.map((x)=>x.id).indexOf(node2.id);
	let node2Index = node2.connections.map((x)=>x.id).indexOf(node1.id);
	if(node1Index != -1 && node2Index != -1){
		node1.connections.splice(node1Index,1);
		node2.connections.splice(node2Index,2);
	}
}

function moveNode(node,x,y){
	//console.log("move node x:"+x+" y:"+y,node);
	node.x = x;
	node.y = y;
	for(let i=0;i<node.connections.length;i++){
		if(!node.connections[i].flags.includes("layerChange")){
			let node2 = nodeGraph[node.layer][node.connections[i].id];
			let distance = Math.sqrt( Math.pow(node.x-node2.x,2) + Math.pow(node.y-node2.y,2) );
			let foundIndex = node2.connections.map((x)=>x.id).indexOf(node.id)
			if(foundIndex != -1){
				node.connections[i].distance = distance;
				node2.connections[foundIndex ].distance = distance;
			}else{
				console.log("One sided connection found when moving, move canceled.",node,node2);
			}
		}
	}
}

function quantizeNodePositions(layer = view.layer){
	for(let i=0;i<nodeGraph[view.layer].length;i++){
		node = nodeGraph[view.layer][i]
		if(!nodeGraph[view.layer][i]){
			continue;
		}
		//moveNode(node, Math.round(node.x*10)/10, Math.round(node.y*10)/10);
		moveNode(node, Math.round(node.x), Math.round(node.y));
	}
	redraw();
}

function prepLayer(layerName){
	//Regular Part
	
	//Editor Part
	let option = document.createElement("option");
	option.value = layerName;
	option.appendChild(document.createTextNode(layerName));
	editorLayerSelect.appendChild(option);
}

function handleLayerDropdown(){
	view.layer = editorLayerSelect.value;
	redraw();
}


// ===== File Handling =====
function loadFile(fileName){
	//Track the number of files being loaded to avoid searching an incomplete map.
	loadingCount++;

	//TODO: load file
	//This will have issues with CORS if we try to just run the file locally.
	//We will need to either find a solution for hosting a local server to test it or put a placeholder string thing here
	if(window.location.protocol == "file:"){
		loadingCount--;
		switch(fileName){
			case "test file":
				return "test file contents"
			case "outside":
				return '{"name":"outside","metadata":{"imgScale":1,"mapImage":"outside.png"},"graph":[{"id":0,"x":0,"y":0,"layer":"outside","connections":[{"id":1,"distance":80,"flags":[]},{"id":2,"distance":113.13708498984761,"flags":[]},{"id":3,"distance":186.01075237738274,"flags":[]}]},{"id":1,"x":80,"y":0,"layer":"outside","connections":[{"id":0,"distance":80,"flags":[]},{"id":2,"distance":80,"flags":[]}]},{"id":2,"x":80,"y":80,"layer":"outside","connections":[{"id":0,"distance":113.13708498984761,"flags":[]},{"id":1,"distance":80,"flags":[]}]},{"id":3,"x":110,"y":150,"layer":"outside","connections":[{"id":0,"distance":186.01075237738274,"flags":[]}]}],"namedNodes":[]}'
			case "derrick_test":
				return '{"name":"test","metadata":{"imgScale":1,"mapImage":"derrick temp.jpg"},"graph":[null,null,{"id":2,"x":309,"y":360,"layer":"test","connections":[{"id":14,"distance":30,"flags":[]},{"id":6,"distance":39,"flags":[]},{"id":3,"distance":118.00423721205946,"flags":[]}]},{"id":3,"x":427,"y":361,"layer":"test","connections":[{"id":2,"distance":118.00423721205946,"flags":[]},{"id":7,"distance":37.12142238654117,"flags":[]},{"id":4,"distance":107,"flags":[]},{"id":19,"distance":39.01281840626232,"flags":[]}]},{"id":4,"x":534,"y":361,"layer":"test","connections":[{"id":3,"distance":107,"flags":[]},{"id":8,"distance":30.14962686336267,"flags":[]},{"id":17,"distance":25.079872407968907,"flags":[]}]},{"id":5,"x":669,"y":361,"layer":"test","connections":[{"id":10,"distance":28.071337695236398,"flags":[]},{"id":11,"distance":37.12142238654117,"flags":[]},{"id":12,"distance":36.05551275463989,"flags":[]},{"id":13,"distance":108.01851693112621,"flags":[]}]},{"id":6,"x":309,"y":321,"layer":"test","connections":[{"id":2,"distance":39,"flags":[]}]},{"id":7,"x":424,"y":324,"layer":"test","connections":[{"id":3,"distance":37.12142238654117,"flags":[]}]},{"id":8,"x":537,"y":331,"layer":"test","connections":[{"id":4,"distance":30.14962686336267,"flags":[]}]},{"id":9,"x":643,"y":325,"layer":"test","connections":[{"id":10,"distance":37.45430139037795,"flags":[]}]},{"id":10,"x":641,"y":363,"layer":"test","connections":[{"id":5,"distance":28.071337695236398,"flags":[]},{"id":17,"distance":82,"flags":[]}]},{"id":11,"x":672,"y":324,"layer":"test","connections":[{"id":5,"distance":37.12142238654117,"flags":[]}]},{"id":12,"x":667,"y":397,"layer":"test","connections":[{"id":5,"distance":36.05551275463989,"flags":[]}]},{"id":13,"x":777,"y":363,"layer":"test","connections":[{"id":5,"distance":108.01851693112621,"flags":[]}]},{"id":14,"x":309,"y":390,"layer":"test","connections":[{"id":16,"distance":68.00735254367721,"flags":[]},{"id":15,"distance":36.013886210738214,"flags":[]},{"id":2,"distance":30,"flags":[]}]},{"id":15,"x":273,"y":389,"layer":"test","connections":[{"id":14,"distance":36.013886210738214,"flags":[]}]},{"id":16,"x":308,"y":458,"layer":"test","connections":[{"id":14,"distance":68.00735254367721,"flags":[]}]},{"id":17,"x":559,"y":363,"layer":"test","connections":[{"id":4,"distance":25.079872407968907,"flags":[]},{"id":10,"distance":82,"flags":[]},{"id":18,"distance":34.0147027033899,"flags":[]}]},{"id":18,"x":558,"y":397,"layer":"test","connections":[{"id":17,"distance":34.0147027033899,"flags":[]}]},{"id":19,"x":428,"y":400,"layer":"test","connections":[{"id":3,"distance":39.01281840626232,"flags":[]}]}],"namedNodes":[]}'
		}
	}else{
		//TODO: Proper file loading
	}
}

function loadLayerFromJSON(layerString){
	let obj = JSON.parse(layerString);
	if(loadedLayers.includes(obj.name)){
		console.log("Layer already loaded - "+obj.name);
		return;
	}
	loadedLayers.push(obj.name);
	prepLayer(obj.name);
	layerData[obj.name] = obj.metadata;
	nodeGraph[obj.name] = obj.graph;
	namedNodes[obj.name] = obj.namedNodes;
	console.log("Loaded layer - "+obj.name);
}



