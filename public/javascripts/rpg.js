// vars
var mapPieceEnum = {
	0: 'concrete',
	1: 'wood',
	2: 'grass',
	3: 'water'
};

var itemEnum = {
	0: 'none',
	1: 'extra-bomb',
	2: 'explosion-expander'
}

var lastKeyPressed = -1,
		trackNum = false,
		numBuffer = [];
// functions


// onready
$().ready(function() {

	$('body').live('click', function(e) {
		// var $tile			=	$(e.target).closest('.tile'),
		// 		cellData 	= $tile.attr('data-cell-id'),
		// 		cellX			= cellData.split(',')[0],
		// 		cellY			= cellData.split(',')[1];
		// 
		// now.submitClick(cellX, cellY);
	});
	
	$('#chat-input').live('keypress', function(e) {
		var message = $(this).val().trim();
		if (e.keyCode == 13 && message != '') {
			now.submitChat(message);
			$(this).val('');
		}
	});
	
	$('#nickname-input').live('keypress', function(e) {
		var nickname = $(this).val().trim();
		if (e.keyCode == 13 && nickname != '') {
			console.log('submitting');
			now.submitNickname(nickname);
		}
	});
	
	$('.game-controls-wrapper a').live('click', function(e) {
		var $target = $(e.target),
				targetDataAttr = $target.attr('data-control-id'),
				triggerEvent = $.Event('keydown');
				
		if (targetDataAttr == 'start-game') {
			now.submitGameStart();
		}
		e.preventDefault();
	});
	
	$('.map-zoomed').live('keydown', function(e) {

		var shifted = e.shiftKey,
				keyCode	=	e.keyCode,
				prefix;

				console.log(keyCode);
		if ((keyCode == 75 || keyCode == 38) && !shifted) {
			prefix = calculatePrefix();
			now.makeMove('up', prefix);
			cleanUp();
		} else if ( (keyCode == 74 || keyCode == 40) && !shifted) {
			prefix = calculatePrefix();
			now.makeMove('down', prefix);
			cleanUp();
		} else if ( (keyCode == 72 || keyCode == 37) && !shifted) {
			prefix = calculatePrefix();
			now.makeMove('left', prefix);
			cleanUp();

		} else if ( (keyCode == 76 || keyCode == 39) && !shifted) {
			prefix = calculatePrefix();
			now.makeMove('right', prefix);
			cleanUp();

		} else if (keyCode == 32 && !shifted) {
			now.makeMove('bomb');
			cleanUp();

		} else if (keyCode == 52 && shifted) {
			now.makeMove('right', 9999);
			cleanUp();
		} else if (keyCode == 48 && !shifted) {
			if (trackNum) {
				numBuffer.push(String.fromCharCode(e.keyCode));
				$('.game-instructions .buffer').text(numBuffer.join(''));
			} else {
				now.makeMove('left', 9999);
				cleanUp();
			}
		} else if (keyCode == 71 && shifted) {
			prefix = calculatePrefix();
			if (prefix) {
				now.makeMove('hop', prefix);
			} else {
				now.makeMove('hop', 9999);
			}
			cleanUp();
			keyCode = -1;
		} else if (keyCode == 71 && !shifted) {
			if (lastKeyPressed == 71) {
				// g was pressed earlier
				prefix = calculatePrefix();
				now.makeMove('hop', prefix);
				keyCode = -1;
				cleanUp();
			}
		} else if (keyCode >= 49 && keyCode <= 57) {
			trackNum = true;
			numBuffer.push(String.fromCharCode(e.keyCode));
			$('.game-instructions .buffer').text(numBuffer.join(''));
		} else if (keyCode == 27) {
			cleanUp();
		}
		lastKeyPressed = keyCode;
	});
	
});

// functions
function cleanUp() {
	trackNum = false;
	numBuffer = [];
	$('.game-instructions .buffer').text('');
}

function calculatePrefix() {
	var prefix = parseInt(numBuffer.join(''));
	return prefix;
}

// now shit
now.broadcastMove = function(userObj) {
	var clientId 			= userObj.id,
			cellX					= userObj.cellX,
			cellY					= userObj.cellY,
			$playerPiece 	=	$('.icon-player[data-player-id="'+clientId+'"]'),
			$oldTile 			= $playerPiece.closest('.tile'),
			$tile					= $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]');
			
	// remove the player piece and tile selection
	$playerPiece.remove();
	
	// append player piece to new tile
	$tile.append($playerPiece);
}

now.broadcastRemove = function(userObj) {
	var clientId 			= userObj.id,
			cellX					= userObj.cellX,
			cellY					= userObj.cellY,
			$playerPiece 	=	$('.icon-player[data-player-id="'+clientId+'"]'),
			$oldTile 			= $playerPiece.closest('.tile');
			
	// remove the player piece and tile selection
	$playerPiece.remove();
}

now.initPlayers = function(usersHash) {
	var userObj,
			cellX,
			cellY,
			clientId,
			$playerPiece,
			$tile;
	for (var clientId in usersHash) {
		userObj 			= usersHash[clientId];
		clientId 			= userObj.id;
		cellX					= userObj.cellX;
		cellY					= userObj.cellY;
		color					= userObj.color;
		$playerPiece 	= $('<div class="icon-player" data-player-id="'+clientId+'"></div').css('background-color', color);
		$tile					= $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]');
		$tile.append($playerPiece);
		
		if (now.core.clientId == clientId) {
			$playerPiece.addClass('selected');
		}
	}
}

now.initPlayer = function(userObj) {
	var cellX 				= userObj.cellX,
			cellY 				= userObj.cellY,
			clientId 			= userObj.id,
			color					= userObj.color,
			$playerPiece 	= $('<div class="icon-player" data-player-id="'+clientId+'"></div').css('background-color', color),
			$tile					= $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]');
			
	$tile.append($playerPiece);
}

now.updateUsersList = function(usersHash) {
	var userName,
			userColor,
			usersListHtml = '',
			userStatus,
			userObj;
			
	$('.users-list').empty();
	for (var clientId in usersHash) {
		userObj = usersHash[clientId];
		userColor = userObj.color;
		userName = userObj.username;
		userStatus = (userObj.isReady == true ? 'ready' : 'waiting');
		
		usersListHtml += '<li class="user-item">'+
			'<span class="user-status '+userStatus+'"></span>'+
			'<span class="user-name" style="color: '+userColor+'" data-user-id="'+clientId+'">'+userName+'</span>'+
		'</li>';
	}
	$('.users-list').append(usersListHtml);	
}

now.updateNickname = function(userObj) {
	var clientId = userObj.id,
			$userNameItem = $('.user-name[data-user-id="'+clientId+'"]'),
			username = userObj.username;
	$userNameItem.text(username);
}

now.initMap = function(map) {
	var num_rows 	= map.length,
			num_cols	=	map[0].length,
			tile_class,
			$map		= $('.container-game .map-zoomed'),
			$row,
			label;
			
	$map.empty();
	
	for (var row = 0; row < num_rows; row++) {
		$row = $('<div class="row" data-row-id="' + row + '"></div>');
		for (var col = 0; col < num_cols; col++) {
			tileClass = mapPieceEnum[map[row][col]];
			if (row == 0 && col != 0 && col != num_cols - 1) {
				label = col;
			} else if (col == 0 && row != 0 && row != num_rows - 1) {
				label = row;
			} else if (row == num_rows - 1 && col != 0 && col != num_cols - 1) {
				label = col;
			} else if (col == num_cols - 1 && row != 0 && row != num_rows - 1) {
				label = row;
			} else {
				label = '';
			}
			$row.append('<div class="tile '+tileClass+'" data-cell-id="'+row+','+col+'">'+label+'</div>');
		}
		$map.append($row);
	}
	$('.map-zoomed').focus();
}

now.setBombPosition = function(cellY, cellX) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]'),
			$bombPiece 	= $('<div class="icon-bomb"></div');
			
	$tile.append($bombPiece);
}

now.updateChat = function(userObj, message) {
	var $chatMessageDiv = $('.chat-wrapper .chat-messages'),
			username = userObj.username;
	$chatMessageDiv.append('<li class="message"><span class="username">'+username+'</span>: <span class="chat-text">'+message+'</span></li>');
	$chatMessageDiv.animate({ scrollTop: $chatMessageDiv.prop("scrollHeight") }, 100);	
}

now.showGameStartButton = function() {
	var $gameStartButton = $('.game-controls-wrapper .game-start');
	$gameStartButton.css('display', 'inline-block');
}

now.hideGameStartButton = function() {
	var $gameStartButton = $('.game-controls-wrapper .game-start'),
			$gameStartButtonLink = $('.game-controls-wrapper .game-start a');
	$gameStartButtonLink.text('Start Game');
	$gameStartButton.hide();
}

now.showGameWait = function() {
	var $gameStartButtonLink = $('.game-controls-wrapper .game-start a');
	$gameStartButtonLink.text('Waiting for players to ready up...');
}

now.showGameInstructions = function() {
	var $gameInstructions = $('.game-controls-wrapper .game-instructions');
	$gameInstructions.css('display', 'inline-block');
}

now.hideGameInstructions = function() {
	var $gameInstructions = $('.game-controls-wrapper .game-instructions');
	$gameInstructions.hide();
}

now.showBombExplosion = function(bombY, bombX) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+bombY+','+bombX+'"]'),
			$explosionPiece 	= $('<div class="icon-explosion"></div')
			$bombPiece = $tile.find('.icon-bomb');
			
	$tile.append($explosionPiece);
	
	if ($tile.hasClass('wood')) {
		$tile.removeClass('wood').addClass('grass');
	}
	
	$bombPiece.remove();
	$explosionPiece.fadeOut(400, function() {
		$(this).remove();
	});
}

now.showPlayerDeath = function(clientId, cellY, cellX) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]'),
			$playerPiece 	= $tile.find('.icon-player');
			
	$playerPiece.fadeOut(400, function() {
		$(this).remove();
	});
}

now.showItem = function(cellY, cellX, itemNum) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]'),
			itemClass = itemEnum[itemNum],
			$itemPiece 	= $('<div class="item icon-'+itemClass+'"></div');
			
	$tile.append($itemPiece);
}

now.grabItem = function(cellY, cellX) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]'),
			$itemPiece = $tile.find('.item');
			
	$itemPiece.remove();
}

now.removeItem = function(cellY, cellX) {
	var	$tile = $('.map-zoomed').find('.tile[data-cell-id="'+cellY+','+cellX+'"]'),
			$itemPiece = $tile.find('.item');
			
	$itemPiece.remove();
}