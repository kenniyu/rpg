
/**
 * Module dependencies.
 */

var express = require('express'),
		routes = require('./routes'),
		connect = require('connect'),
		ejs = require('ejs'),
		nowjs = require('now');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.set('view options', { layout: false });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

app.listen(3000, function(){
	// initMap();
	
  console.log("RPG server listening on port %d in %s mode", app.address().port, app.settings.env);
});

var everyone = nowjs.initialize(app),		// everyone is initialized
		usersHash = {},
		usersCount = 1,
		map = [],
		NUM_ROWS = 21,
		NUM_COLS = 21,
		mapPieceEnum = {
			0: 'concrete',
			1: 'wood',
			2: 'grass',
			3: 'water',
			4: 'player'
		},
		itemEnum = {
			0: 'none',
			1: 'extra-bomb',
			2: 'explosion-expander'
		}
		startingPositions = {
			1: { cellX: 1, cellY: 1 },
			2: { cellX: NUM_COLS-2, cellY: NUM_ROWS-2 },
			3: { cellX: 1, cellY: NUM_ROWS-2 },
			4: { cellX: NUM_COLS-2, cellY: 1 }
		},
		playerPositions = [],
		bombPositions = [],
		itemPositions = [],
		gameHash = {
			isPlaying: false,
			currentPlayers: [],
			waitingPlayers: [],
			confirmedPlayers: [],
			deadPlayers: []
		};

// functions
function initMap() {
	map = [];
	playerPositions = [];
	bombPositions = [];
	itemPositions = [];
	
	var tempRand;
	for (var row = 0; row < NUM_ROWS; row++) {
		map.push([]);
		playerPositions.push([]);
		bombPositions.push([]);
		itemPositions.push([]);
		for (var col = 0; col < NUM_COLS; col++) {
			if (row == 0 || row == NUM_ROWS - 1 || col == 0 || col == NUM_COLS - 1 || (col%2 == 0 && row%2 == 0) ) {
				map[row].push(0);
				itemPositions[row].push(0);
			} else if ( 
				(col == 1 && row == 1) || (col == 1 && row == 2) || (col == 2 && row == 1) ||	
				(col == NUM_COLS-2 && row == 1) || (col == NUM_COLS-2 && row == 2) || (col == NUM_COLS-3 && row == 1) || 
				(col == NUM_COLS-2 && row == NUM_ROWS-2) || (col == NUM_COLS-2 && row == NUM_ROWS-3) || (col == NUM_COLS-3 && row == NUM_ROWS-2) ||	
				(col == 1 && row == NUM_ROWS-2) || (col == 1 && row == NUM_ROWS-3) || (col == 2 && row == NUM_ROWS-2) ) {
				map[row].push(2);
				itemPositions[row].push(0);
			} else {
				tempRand = Math.floor(10*Math.random());
				if (tempRand == 1 || tempRand == 2) {
					itemPositions[row].push(tempRand);
				} else {
					itemPositions[row].push(0);
				}
				map[row].push(1);
			}
			playerPositions[row].push(0);
			bombPositions[row].push(0);
		}
	}
	console.log(itemPositions);
	everyone.now.initMap(map);
}


// when a client connects to this page
nowjs.on('connect', function() {	
	// get user data
	var user = this.user,
			clientId = user.clientId,
			username = 'player' + usersCount,
			clientCookieId = get_cookie(user.cookie),
			color = '#'+Math.floor(Math.random()*16777215).toString(16);
			
	// set user id and name
	userKey = clientId;
	userValue = {
		id: clientId,
		username: username,
		color: color,
		isPlaying: false,
		bombRadius: 1,
		currentBombs: [],
		maxBombs: 1
	}

	if (gameHash['isPlaying'] == false && gameHash['currentPlayers'].length < 4) {
		// 	we can accept one more player
		gameHash['currentPlayers'].push(userValue.id);

		if (gameHash['currentPlayers'].length >= 2) {
			// show start message to nonconfirmed players if >= 2 players exist
			var tempCurrentPlayerId;
			for (var i = 0; i < gameHash['currentPlayers'].length; i++) {
				tempCurrentPlayerId = gameHash['currentPlayers'][i];
				if (gameHash['confirmedPlayers'].indexOf(tempCurrentPlayerId) == -1) {
					// this player has not confirmed yet, so show him the message
					nowjs.getClient(tempCurrentPlayerId, function() {
						this.now.showGameStartButton();
					});
				}
			}
		}
	} else {
		// push user to waitingPlayers
		gameHash['waitingPlayers'].push(userValue.id);
	}

	// add userValue to usersHash
	usersHash[userKey] = userValue;

	// increment users count
	usersCount++;

	
	// broadcast join
	
	userObj = usersHash[clientId];
	// broadcastJoin(userObj, 'join');
	
	// update everyone's client list and board
	// everyone.now.initPlayer(userObj);
	updateUsersList();
	
	// for this player, initialize the map and players
	// this.now.initMap(map);
	// this.now.initPlayers(usersHash);
});

// when a client disconnects from the page
nowjs.on('disconnect', function() {
	var clientId = this.user.clientId,
			userObj	= usersHash[clientId],
			confirmedPlayersIndex,
			currentPlayersIndex;
	// broadcast_message(user_obj, 'leave');
	removePlayer(userObj);
	
	// clean up game state
	currentPlayersIndex = gameHash['currentPlayers'].indexOf(clientId);
	if (currentPlayersIndex > -1) {
		confirmedPlayersIndex = gameHash['confirmedPlayers'].indexOf(clientId);
		gameHash['currentPlayers'].splice(currentPlayersIndex, 1);
		gameHash['confirmedPlayers'].splice(confirmedPlayersIndex, 1);
	}
	
	if (gameHash['currentPlayers'].length < 2) {
		endGame();
	}
	
	// remove from usersHash
	delete usersHash[clientId];
	
	// update users list
	updateUsersList();
});

everyone.now.submitGameStart = function() {
	var clientId 	= this.user.clientId,
			userObj		= usersHash[clientId];
	if (	gameHash['currentPlayers'].length >= 2 && 
				gameHash['isPlaying'] == false && 
				gameHash['currentPlayers'].indexOf(clientId) > -1 && 
				gameHash['confirmedPlayers'].indexOf(clientId) == -1	) {
		gameHash['confirmedPlayers'].push(clientId);
		if (gameHash['confirmedPlayers'].length == gameHash['currentPlayers'].length) {
			initGame();
		} else {
			this.now.showGameWait();
		}
	}
}

everyone.now.makeMove = function(moveType, prefix, absolute) {
	var clientId 	= this.user.clientId,
			userObj		= usersHash[clientId],
			currentX 	= userObj.cellX,
			currentY 	= userObj.cellY,
			prefix 		= prefix || (moveType == 'hop' ? 0 : 1);
	
	if (gameHash['isPlaying'] == true && userObj['isPlaying'] == true) {
		if (moveType == 'bomb') {
			setBomb(userObj);
		} else {
			setPlayerPosition(userObj, moveType, prefix, absolute);
			updatePlayerPosition(userObj);
		}
	}
}

function initGame() {
	// initialize game map, setting paths, obstacles, and items
	initMap();
	
	console.log('starting game');
	console.log(gameHash);
	gameHash['isPlaying'] = true;
	gameHash['deadPlayers'] = [];
	
	var currentPlayers = gameHash['currentPlayers'],
			tempClientId,
			userObj;
	
	for (var i = 0; i < currentPlayers.length; i++) {
		tempClientId = currentPlayers[i];
		userObj = usersHash[tempClientId];
		
		userObj['isPlaying'] = true;		
		userObj['bombRadius'] = 1;
		userObj['currentBombs'] = [];
		userObj['maxBombs'] = 1;
		
		// set user starting position
		for (var startingPositionIndex in startingPositions) {
			var startingPositionObj = startingPositions[startingPositionIndex],
					cellX = startingPositionObj.cellX,
					cellY	=	startingPositionObj.cellY;
			if ( canMoveTo(cellY, cellX) ) {
				userObj['cellX'] = cellX;
				userObj['cellY'] = cellY;
				playerPositions[cellY][cellX] = userObj.id;
				break;
			}
		}
		
		// update game controls
		nowjs.getClient(tempClientId, function() {
			this.now.hideGameStartButton();
			this.now.showGameInstructions();			
		});
	}

	// initialize our players on map
	everyone.now.initPlayers(usersHash);
}

function setBomb(userObj) {
	var cellX = userObj.cellX,
			cellY	= userObj.cellY,
			clientId = userObj.clientId,
			numCurrentBombs = userObj.currentBombs.length,
			maxBombs = userObj.maxBombs;
	
	if (numCurrentBombs < maxBombs && bombPositions[cellY][cellX] == 0) {
		// ok to set bomb
		console.log('setting bomb with radius '+userObj.bombRadius+' and maxBombs = '+maxBombs);
		bombPositions[cellY][cellX] = userObj.clientId;
		userObj.currentBombs.push({bombX: cellX, bombY: cellY});
		everyone.now.setBombPosition(cellY, cellX);

		setTimeout(function() {
			explodeBomb(userObj, cellY, cellX);
		}, 2000);
	}
}

function explodeBomb(userObj, cellY, cellX) {
	if (bombPositions[cellY][cellX] != 0) {
		// must check to make sure there is a bomb here to explode
		// since a bomb couldve exploded by another explosion
		// and we dont want to shift
		var bombLocation = userObj.currentBombs.shift(),
				bombX,
				bombY,
				bombRadius;
				
		if (bombLocation) {
			bombX = bombLocation.bombX,
			bombY	=	bombLocation.bombY,
			bombRadius = userObj.bombRadius;

			explode('self', bombY, bombX, userObj);
			explode('left', bombY, bombX, userObj);
			explode('right', bombY, bombX, userObj);
			explode('up', bombY, bombX, userObj);
			explode('down', bombY, bombX, userObj);
			
			bombPositions[bombY][bombX] = 0;
		}
	}
}	

function explode(direction, cellY, cellX, userObj) {
	var currentY = cellY,
			currentX = cellX,
			bombRadius = userObj.bombRadius,
			increment,
			currentIncrement = 0,
			itemNum;
	
	if (direction == 'self') {
		if (playerPositions[currentY][currentX] != 0) {
			killPlayer(playerPositions[currentY][currentX]);
			playerPositions[currentY][currentX] = 0;
		}
		everyone.now.showBombExplosion(currentY, currentX);
	} else if (direction == 'up' || direction == 'down') {
		increment = (direction == 'up' ? -1 : 1);
		while (currentIncrement < bombRadius) {
			if (mapPieceEnum[map[currentY + increment][currentX]] == 'wood') {
				// explode turn wood to grass
				map[currentY + increment][currentX] = 2;
				// check for item
				itemNum = itemPositions[currentY + increment][currentX];
				if (itemNum != 0) {
					everyone.now.showItem(currentY + increment, currentX, itemNum);
				}
				// show explosion
				everyone.now.showBombExplosion(currentY + increment, currentX);
				break;
			} else if (mapPieceEnum[map[currentY + increment][currentX]] == 'concrete') {
				break;
			} else {
				// explode anything in this cell 
				if (playerPositions[currentY + increment][currentX] != 0) {
					killPlayer(playerPositions[currentY + increment][currentX]);
					playerPositions[currentY + increment][currentX] = 0;
				}
				if (bombPositions[currentY + increment][currentX] != 0) {
					explodeBomb(userObj, currentY + increment, currentX);
				}
				if (itemPositions[currentY + increment][currentX] != 0) {
					everyone.now.removeItem(currentY + increment, currentX);
					itemPositions[currentY + increment][currentX] = 0;
				}
				everyone.now.showBombExplosion(currentY + increment, currentX);
				currentY += increment;
			}
			currentIncrement++;
		}
	} else if (direction == 'left' || direction == 'right') {
		increment = (direction == 'left' ? -1 : 1);
		while (currentIncrement < bombRadius) {
			if (mapPieceEnum[map[currentY][currentX + increment]] == 'wood') {
				// explode, turn wood to grass
				map[currentY][currentX + increment] = 2;
				// check for item				
				itemNum = itemPositions[currentY][currentX + increment];
				if (itemNum != 0) {
					everyone.now.showItem(currentY, currentX + increment, itemNum);
				}
				// show explosion
				everyone.now.showBombExplosion(currentY, currentX + increment);
				break;
			} else if (mapPieceEnum[map[currentY][currentX + increment]] == 'concrete') {
				break;
			} else {
				// explode anything in this cell 
				if (playerPositions[currentY][currentX + increment] != 0) {
					killPlayer(playerPositions[currentY][currentX + increment]);
					playerPositions[currentY][currentX + increment] = 0;
				}
				if (bombPositions[currentY][currentX + increment] != 0) {
					explodeBomb(userObj, currentY, currentX + increment);
				}
				if (itemPositions[currentY][currentX + increment] != 0) {
					itemPositions[currentY][currentX + increment] = 0;
					everyone.now.removeItem(currentY, currentX + increment);
				}
				everyone.now.showBombExplosion(currentY, currentX + increment);
				currentX += increment;
			}
			currentIncrement++;
		}
	}
	
}

function setPlayerPosition(userObj, direction, prefix) {
	var currentX = userObj.cellX,
			currentY = userObj.cellY;
						
	if (direction == 'hop') {
		direction = (currentY - prefix > 0 ? 'up' : 'down');
		prefix = Math.abs(currentY - prefix);	// how far to move
		increment = (direction == 'up' ? -1 : 1);
	} else {
		increment = ( (direction == 'left' || direction == 'up') ? -1 : 1 );
	}
	
	playerPositions[currentY][currentX] = 0;
	if (direction == 'left' || direction == 'right') {
		for (var i = 0; i < prefix; i++) {
			if ( canMoveTo(currentY, currentX + increment) ) {
				currentX += increment;
			} else {
				break;
			}
		}
		userObj.cellX = currentX;
	} else {
		for (var i = 0; i < prefix; i++) {
			if (map[currentY + increment] && canMoveTo(currentY + increment, currentX) ) {
				currentY += increment;
			} else {
				break;
			}
		}
		userObj.cellY = currentY;
	}
	playerPositions[currentY][currentX] = userObj.id;
	grabItem(userObj);
}

function grabItem(userObj) {
	// grabs item in user's current position
	var cellY 	= userObj.cellY,
			cellX 	= userObj.cellX,
			itemId	= itemPositions[cellY][cellX];
			
	if (itemEnum[itemId] == 'extra-bomb') {
		if (userObj.maxBombs < 10) {
			userObj.maxBombs += 1;
		}
	} else if (itemEnum[itemId] == 'explosion-expander') {
		if (userObj.bombRadius < 10) {
			userObj.bombRadius += 1;
		}
	}
	itemPositions[cellY][cellX] = 0;
	everyone.now.grabItem(cellY, cellX);
}

function canMoveTo(cellY, cellX) {
	if (map[cellY][cellX] == 2 && playerPositions[cellY][cellX] == 0 && bombPositions[cellY][cellX] == 0) {
		return true;
	} else {
		return false;
	}
}

function killPlayer(clientId, cellY) {
	var userObj = usersHash[clientId],
			cellY 	= userObj.cellY,
			cellX		= userObj.cellX;
	
	gameHash['deadPlayers'].push(clientId);
	
	if (gameHash['currentPlayers'].length - gameHash['deadPlayers'].length == 1) {
		// we have a winner, end game
		endGame();
	}
	
	everyone.now.showPlayerDeath(clientId, cellY, cellX);
}

function endGame() {
	
	console.log(gameHash);
	
	var newPlayerId;
	
	// we ahve a winner, broadcast
	
	// set game state
	gameHash['isPlaying'] = false;
	
	// move waiting players to current players
	for (var i = 0; i < gameHash['waitingPlayers'].length; i++) {
		if (gameHash['currentPlayers'].length + 1 <= 4) {
			newPlayerId = gameHash['waitingPlayers'].shift();
			gameHash['currentPlayers'].push(newPlayerId);
		} else {
			break;
		}
	}
	
	// clear confirmed players and dead players
	gameHash['confirmedPlayers'] = [];
	gameHash['deadPlayers'] = [];
	
	// update game controls
	everyone.now.showGameStartButton();
	everyone.now.hideGameInstructions();
	
	// we're ready for a new game
	console.log(gameHash);
}

everyone.now.submitClick = function(finalX, finalY) {
	var clientId = this.user.clientId,
			userObj	= usersHash[clientId];
			
	// set the player positions
	userObj.cellX = finalX;
	userObj.cellY = finalY;
	
	updatePlayerPosition(userObj);
}

everyone.now.submitChat = function(message) {
	var clientId = this.user.clientId,
			userObj	= usersHash[clientId];
	everyone.now.updateChat(userObj, urlify(encodeHTML(message)));
}

function removePlayer(userObj) {
	for (var row = 0; row < NUM_ROWS; row++) {
		for (var col = 0; col < NUM_COLS; col++) {
			if (playerPositions[row][col] == userObj.id) {
				playerPositions[row][col] = 0;
			}
		}
	}
	everyone.now.broadcastRemove(userObj);
}

function getOpenNeighbors(userObj) {
	var userX = userObj.cellX,
			userY = userObj.cellY,
			positions = [];
	if (map[userY][userX-1] == 0) {
		positions.push({cellX: userX-1, cellY: userY});
	}
	if (map[userY+1][userX-1] == 0) {
		positions.push({cellX: userX-1, cellY: userY+1});
	}
	if (map[userY+1][userX] == 0) {
		positions.push({cellX: userX, cellY: userY+1});
	}
	if (map[userY+1][userX+1] == 0) {
		positions.push({cellX: userX+1, cellY: userY+1});
	}
	if (map[userY][userX+1] == 0) {
		positions.push({cellX: userX+1, cellY: userY});
	}
	if (map[userY-1][userX+1] == 0) {
		positions.push({cellX: userX+1, cellY: userY-1});
	}
	if (map[userY-1][userX] == 0) {
		positions.push({cellX: userX, cellY: userY-1});
	}
	if (map[userY-1][userX-1] == 0) {
		positions.push({cellX: userX-1, cellY: userY-1});
	}
	return positions;
}

function updatePlayerPosition(userObj) {
	everyone.now.broadcastMove(userObj);
}

function findPath(startX, startY, finalX, finalY) {
	var neighboringCells = [],
			currentX = startX,
			currentY = startY;
}

function getOpenNeighbors(locX, locY) {
	var openNeighbors = [];
}

function updateUsersList() {
	everyone.now.updateUsersList(usersHash);
}

// encode HTML
function encodeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function urlify(text) {
	var urlRegex = /(https?:\/\/[^\s]+)/g;
	return text.replace(urlRegex, function(url) {
		return '<a href="' + url + '" target="_blank">' + url + '</a>';
	});
}

function get_cookie(cookieHash) {
	for (var key in cookieHash) {
		return cookieHash[key];
	}
}