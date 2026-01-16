// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size (accounting for container padding: 1000px max-width - 40px padding = 960px)
canvas.width = 960;
// Make canvas taller to give more vertical space (especially around the second floor)
canvas.height = 500;

// Game state
const gameState = {
    currentLevel: 1,
    player: {
        x: 50,
        y: 0,
        width: 30,
        height: 40,
        speed: 3,
        onGround: false,
        velocityY: 0,
        gravity: 0.8,
        jumpPower: -12,
        canJump: false
    },
    ground: {
        y: canvas.height - 50,
        height: 50
    },
    stairs: [],
    traps: [],
    secondFloor: null, // { x, y, width, height } for second floor platform
    obstacles: [], // Obstacles on second floor
    endpoint: {
        x: canvas.width - 50,
        y: 0,
        width: 50,
        height: canvas.height
    },
    keys: {},
    jumpKeyDown: false,
    won: false,
    dead: false,
    level1Completed: false,
    level2Completed: false
};

// Initialize level-specific data
function initLevel() {
    gameState.stairs = [];
    gameState.traps = [];
    gameState.secondFloor = null;
    gameState.obstacles = [];
    gameState.dead = false;
    gameState.won = false;
    
    // Set default endpoint position (will be overridden for level 3)
    gameState.endpoint.x = canvas.width - 50;
    gameState.endpoint.y = 0;
    gameState.endpoint.width = 50;
    gameState.endpoint.height = canvas.height;
    
    if (gameState.currentLevel === 1) {
        initLevel1();
    } else if (gameState.currentLevel === 2) {
        initLevel2();
    } else if (gameState.currentLevel === 3) {
        initLevel3();
    }
}

// Initialize Level 1 (original level with flipped controls)
function initLevel1() {
    const stairWidth = 100;
    const stairHeight = 30;
    const startX = canvas.width * 0.3;
    const baseY = gameState.ground.y;
    
    gameState.stairs = [
        { x: startX, y: baseY - stairHeight, width: stairWidth, height: stairHeight },
        { x: startX + stairWidth, y: baseY - stairHeight * 2, width: stairWidth, height: stairHeight },
        { x: startX + stairWidth * 2, y: baseY - stairHeight * 3, width: stairWidth, height: stairHeight }
    ];
}

// Initialize Level 2 (with traps and normal controls)
function initLevel2() {
    const stairWidth = 100;
    const stairHeight = 30;
    const startX = canvas.width * 0.2;
    const baseY = gameState.ground.y;
    
    // Add some stairs - all positioned above the ground
    // Third stair is higher so player must use other stairs to reach it
    gameState.stairs = [
        { x: startX, y: baseY - stairHeight * 2, width: stairWidth, height: stairHeight },
        { x: startX + stairWidth + 80, y: baseY - stairHeight * 3, width: stairWidth, height: stairHeight },
        { x: startX + stairWidth * 2 + 160, y: baseY - stairHeight * 4.5, width: stairWidth, height: stairHeight }
    ];
    
    // Add traps (red pits below the floor)
    // Traps are pits below ground level - player dies if they fall into them
    const trapDepth = 120; // How deep the pits are
    const trapStartY = gameState.ground.y + gameState.ground.height; // Start traps below the ground surface
    gameState.traps = [
        { x: 200, width: 60, y: trapStartY, height: trapDepth },
        { x: 400, width: 80, y: trapStartY, height: trapDepth },
        { x: 600, width: 70, y: trapStartY, height: trapDepth },
        { x: 800, width: 50, y: trapStartY, height: trapDepth }
    ];
    
    // Clear second floor and obstacles for level 2
    gameState.secondFloor = null;
    gameState.obstacles = [];
}

// Initialize Level 3 (with second floor)
function initLevel3() {
    const stairWidth = 100;
    const stairHeight = 30;
    const baseY = gameState.ground.y;
    
    // First floor: traps similar to level 2
    const trapDepth = 120;
    const trapStartY = gameState.ground.y + gameState.ground.height;
    gameState.traps = [
        { x: 100, width: 60, y: trapStartY, height: trapDepth },
        { x: 300, width: 300, y: trapStartY, height: trapDepth },
        { x: 620, width: 50, y: trapStartY, height: trapDepth }
    ];
    
    // For now, no stairs on the ground level in level 3
    gameState.stairs = [
        { x: 340, y: 380, width: 50, height: 20 },
        { x: 365, y: 450, width: 50, height: 20 },
        { x: 450, y: 230, width: 20, height: 100 }, // wall
        { x: 500, y: 450, width: 50, height: 20 },

        { x: 800, y: 400, width: 50, height: 20 },
        { x: 900, y: 320, width: 50, height: 20 },
        { x: 810, y: 270, width: 50, height: 20 },
    ];
    
    // Second floor setup
    // Increase secondFloorHeight to create more space between first floor and ceiling
    const secondFloorHeight = 240; // Height of second floor from ground
    const secondFloorY = baseY - secondFloorHeight;
    
    // Obstacles on second floor (blocks to jump over)
    const obstacleHeight = 40;
    const obstacleWidth = 50;
    gameState.obstacles = [
        { x: 600, y: secondFloorY - obstacleHeight, width: obstacleWidth, height: obstacleHeight },
        { x: 400, y: secondFloorY - obstacleHeight, width: obstacleWidth, height: obstacleHeight },
        { x: 200, y: secondFloorY - obstacleHeight, width: obstacleWidth, height: obstacleHeight }
    ];
    
    // Second floor platform as segments with holes between boxes
    // This allows players to drop back down to the first floor
    const secondFloorThickness = 30;
    const holeWidth = 80; // Width of holes between boxes
    const floorEndX = canvas.width - 120; // Leave gap at right end for stairs
    
    // Create floor segments with gaps between obstacles
    // Boxes are at x=200, 400, 600, each width=50
    // Create 80-pixel gaps centered around each box
    const gapHalf = holeWidth / 2; // 40 pixels on each side of box
    
    // Calculate gap boundaries
    const gap1Start = 200 - gapHalf; // 160
    const gap1End = 200 + obstacleWidth + gapHalf; // 290
    const gap2Start = 400 - gapHalf; // 360
    const gap2End = 400 + obstacleWidth + gapHalf; // 490
    const gap3Start = 600 - gapHalf; // 560
    const gap3End = 600 + obstacleWidth + gapHalf; // 690
    
    gameState.secondFloor = [
        // Left segment: from start to before first gap
        { x: 0, y: secondFloorY, width: gap1Start, height: secondFloorThickness },
        // Middle-left segment: between first and second gap
        { x: gap1End, y: secondFloorY, width: gap2Start - gap1End, height: secondFloorThickness },
        // Middle-right segment: between second and third gap
        { x: gap2End, y: secondFloorY, width: gap3Start - gap2End, height: secondFloorThickness },
        // Right segment: after third gap to end
        { x: gap3End, y: secondFloorY, width: floorEndX - gap3End, height: secondFloorThickness }
    ];
    
    // Set endpoint position for level 3 (left side, spanning from second floor to top)
    gameState.endpoint.x = 0;
    // Start at the very top of the canvas
    gameState.endpoint.y = 0;
    gameState.endpoint.width = 50;
    // Extend down to the top of the second floor
    gameState.endpoint.height = secondFloorY;
}

// Initialize player position (left end, on ground)
function initPlayer() {
    // All levels: start at bottom left
    gameState.player.x = 50;
    gameState.player.y = gameState.ground.y - gameState.player.height;
}

// Check collision between player and a rectangle
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Check if player collides with stairs (for blocking)
function checkStairCollision(newX, newY) {
    const testPlayer = {
        x: newX,
        y: newY,
        width: gameState.player.width,
        height: gameState.player.height
    };
    
    for (let stair of gameState.stairs) {
        if (checkCollision(testPlayer, stair)) {
            return true;
        }
    }
    
    // Also check obstacles
    if (gameState.obstacles && gameState.obstacles.length > 0) {
        for (let obstacle of gameState.obstacles) {
            if (checkCollision(testPlayer, obstacle)) {
                return true;
            }
        }
    }
    
    // Check second floor segments (for level 3 ceiling collision)
    if (gameState.currentLevel === 3 && gameState.secondFloor) {
        const secondFloorSegments = Array.isArray(gameState.secondFloor) ? gameState.secondFloor : [gameState.secondFloor];
        for (let segment of secondFloorSegments) {
            if (checkCollision(testPlayer, segment)) {
                // #region agent log
                if (newY < gameState.player.y) {
                    fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:199',message:'checkStairCollision - second floor collision would occur but not checked',data:{playerY:gameState.player.y,newY:newY,secondFloorY:segment.y,wouldCollide:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                }
                // #endregion
                return true; // Collision detected
            }
        }
    }
    
    return false;
}

// Check if player hits a trap
function checkTrapCollision() {
    if ((gameState.currentLevel !== 2 && gameState.currentLevel !== 3) || gameState.traps.length === 0) {
        return false;
    }
    
    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerBottom = gameState.player.y + gameState.player.height;
    const playerTop = gameState.player.y;
    const trapTopY = gameState.ground.y + gameState.ground.height; // Top of trap (bottom of ground)
    
    // Check if player has fallen into a trap (below ground level AND center point is in trap area)
    for (let trap of gameState.traps) {
        // Check if player's center point is over the trap horizontally
        const centerOverTrap = playerCenterX >= trap.x && playerCenterX <= trap.x + trap.width;
        
        // Check if player has fallen INTO the trap (below ground surface)
        // Player must be below ground level AND center point is over trap
        if (centerOverTrap && playerBottom > trapTopY && playerTop < trapTopY + trap.height) {
            return true;
        }
    }
    
    // Also check if player falls completely below canvas (dies)
    if (gameState.player.y + gameState.player.height > canvas.height) {
        return true;
    }
    
    return false;
}

// Check if player is on ground or stairs
function checkGroundCollision() {
    // Check if player is over a trap - if so, they can fall through
    let overTrap = false;
    if ((gameState.currentLevel === 2 || gameState.currentLevel === 3) && gameState.traps.length > 0) {
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        for (let trap of gameState.traps) {
            // Check if player's center point is over the trap horizontally
            if (playerCenterX >= trap.x && playerCenterX <= trap.x + trap.width) {
                overTrap = true;
                break;
            }
        }
    }
    
    // Check second floor (level 3) - check all segments
    if (gameState.currentLevel === 3 && gameState.secondFloor) {
        const playerBottom = gameState.player.y + gameState.player.height;
        const playerTop = gameState.player.y;
        const secondFloorSegments = Array.isArray(gameState.secondFloor) ? gameState.secondFloor : [gameState.secondFloor];
        
        // Check each floor segment
        for (let segment of secondFloorSegments) {
            const secondFloorTop = segment.y;
            
            // Check if player is landing on top of this floor segment
            if (checkCollision(gameState.player, segment)) {
                const isFallingOntoFloor = gameState.player.velocityY >= 0 && playerBottom <= secondFloorTop + 15;
                // #region agent log
                fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:277',message:'Second floor collision detected',data:{playerY:gameState.player.y,playerX:gameState.player.x,playerTop:playerTop,playerBottom:playerBottom,secondFloorTop:secondFloorTop,velocityY:gameState.player.velocityY,isFallingOntoFloor:isFallingOntoFloor,secondFloorX:segment.x,secondFloorWidth:segment.width},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                
                if (isFallingOntoFloor) {
                    // #region agent log
                    fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:280',message:'Landing on second floor',data:{playerX:gameState.player.x},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                    gameState.player.y = segment.y - gameState.player.height;
                    gameState.player.onGround = true;
                    gameState.player.velocityY = 0;
                    gameState.player.canJump = true;
                    return true;
                } else {
                    // Hitting from side or below, push horizontally
                    // #region agent log
                    const isHittingFromBelow = playerTop < secondFloorTop && playerBottom > secondFloorTop;
                    fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:286',message:'Hitting second floor from side/below - pushing horizontally',data:{playerX:gameState.player.x,playerY:gameState.player.y,playerTop:playerTop,playerBottom:playerBottom,secondFloorTop:secondFloorTop,isHittingFromBelow:isHittingFromBelow,oldX:gameState.player.x},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    if (gameState.player.x < segment.x) {
                        gameState.player.x = segment.x - gameState.player.width;
                    } else {
                        gameState.player.x = segment.x + segment.width;
                    }
                    // #region agent log
                    fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:291',message:'After horizontal push',data:{newX:gameState.player.x},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                }
            }
        }
    }
    
    // Check ground (only if not over a trap)
    // If player is over a trap, they can fall through and won't land on ground
    if (!overTrap && gameState.player.y + gameState.player.height >= gameState.ground.y) {
        gameState.player.y = gameState.ground.y - gameState.player.height;
        gameState.player.onGround = true;
        gameState.player.velocityY = 0;
        gameState.player.canJump = true;
        return true;
    }
    
    // Check stairs - prioritize landing on top when falling
    for (let stair of gameState.stairs) {
        if (checkCollision(gameState.player, stair)) {
            // Check if player is falling onto the stair from above (landing on top)
            // Allow landing if player's bottom is near the top of the stair and falling down
            const playerBottom = gameState.player.y + gameState.player.height;
            const stairTop = stair.y;
            const isFallingOntoStair = gameState.player.velocityY >= 0 && playerBottom <= stairTop + 15;
            
            if (isFallingOntoStair) {
                gameState.player.y = stair.y - gameState.player.height;
                gameState.player.onGround = true;
                gameState.player.velocityY = 0;
                gameState.player.canJump = true;
                return true;
            }
            // If hitting from side or below, push player out horizontally
            // But only if not already on top of another stair or second floor
            else {
                // Check if player is already standing on top of a different stair or second floor
                let standingOnSomething = false;
                for (let otherStair of gameState.stairs) {
                    if (otherStair !== stair && 
                        gameState.player.y + gameState.player.height <= otherStair.y + 5 &&
                        gameState.player.x + gameState.player.width > otherStair.x &&
                        gameState.player.x < otherStair.x + otherStair.width) {
                        standingOnSomething = true;
                        break;
                    }
                }
                
                // Check if standing on second floor (check all segments)
                if (!standingOnSomething && gameState.secondFloor) {
                    const playerBottom = gameState.player.y + gameState.player.height;
                    const secondFloorSegments = Array.isArray(gameState.secondFloor) ? gameState.secondFloor : [gameState.secondFloor];
                    for (let segment of secondFloorSegments) {
                        if (playerBottom <= segment.y + 5 &&
                            gameState.player.x + gameState.player.width > segment.x &&
                            gameState.player.x < segment.x + segment.width) {
                            standingOnSomething = true;
                            break;
                        }
                    }
                }
                
                // Only push horizontally if not standing on something else
                if (!standingOnSomething) {
                    if (gameState.player.x < stair.x) {
                        gameState.player.x = stair.x - gameState.player.width;
                    } else {
                        gameState.player.x = stair.x + stair.width;
                    }
                }
            }
        }
    }
    
    // Check obstacles (on second floor) - can land on top
    if (gameState.obstacles && gameState.obstacles.length > 0) {
        for (let obstacle of gameState.obstacles) {
            if (checkCollision(gameState.player, obstacle)) {
                const playerBottom = gameState.player.y + gameState.player.height;
                const obstacleTop = obstacle.y;
                const isFallingOntoObstacle = gameState.player.velocityY >= 0 && playerBottom <= obstacleTop + 15;
                
                if (isFallingOntoObstacle) {
                    gameState.player.y = obstacle.y - gameState.player.height;
                    gameState.player.onGround = true;
                    gameState.player.velocityY = 0;
                    gameState.player.canJump = true;
                    return true;
                } else {
                    // Hitting from side, push horizontally
                    if (gameState.player.x < obstacle.x) {
                        gameState.player.x = obstacle.x - gameState.player.width;
                    } else {
                        gameState.player.x = obstacle.x + obstacle.width;
                    }
                }
            }
        }
    }
    
    gameState.player.onGround = false;
    return false;
}

// Handle input
function handleInput() {
    let newX = gameState.player.x;
    
    if (gameState.currentLevel === 1) {
        // Level 1: flipped arrow controls
        // Left arrow moves RIGHT (flipped)
        if (gameState.keys['ArrowLeft']) {
            newX += gameState.player.speed;
        }
        
        // Right arrow moves LEFT (flipped)
        if (gameState.keys['ArrowRight']) {
            newX -= gameState.player.speed;
        }
    } else if (gameState.currentLevel === 2) {
        // Level 2: K/U movement keys (no arrow movement)
        // 'k' = move left
        if (gameState.keys['k'] || gameState.keys['K']) {
            newX -= gameState.player.speed;
        }
        
        // 'u' = move right
        if (gameState.keys['u'] || gameState.keys['U']) {
            newX += gameState.player.speed;
        }
    } else if (gameState.currentLevel === 3) {
        // Level 3: use P (left), C+O (right - both keys required)
        // 'p' = move left
        if (gameState.keys['p'] || gameState.keys['P']) {
            newX -= gameState.player.speed;
        }
        
        // 'c' AND 'o' = move right (both keys must be pressed)
        if ((gameState.keys['c'] || gameState.keys['C']) && (gameState.keys['o'] || gameState.keys['O'])) {
            newX += gameState.player.speed;
        }
    }
    
    // Check if new position would collide with stairs
    if (!checkStairCollision(newX, gameState.player.y)) {
        gameState.player.x = newX;
    }
    
    // Keep player within canvas bounds
    if (gameState.player.x < 0) {
        gameState.player.x = 0;
    }
    if (gameState.player.x + gameState.player.width > canvas.width) {
        gameState.player.x = canvas.width - gameState.player.width;
    }
    
}

// Helper to check if a key is the jump key for the current level
function isJumpKey(key) {
    if (gameState.currentLevel === 1) {
        return key === 'ArrowUp';
    }
    if (gameState.currentLevel === 2) {
        return key === 'n' || key === 'N';
    }
    if (gameState.currentLevel === 3) {
        return key === 's' || key === 'S';
    }
    return false;
}

// Trigger a jump if allowed (used on keydown edge only)
function tryJump() {
    if (!gameState.player.canJump) return;
    gameState.player.velocityY = gameState.player.jumpPower;
    gameState.player.canJump = false;
    gameState.player.onGround = false;
}

// Update game state
function update() {
    if (gameState.won || gameState.dead) return;
    
    // Handle input
    handleInput();
    
    // Apply gravity
    if (!gameState.player.onGround) {
        gameState.player.velocityY += gameState.player.gravity;
    }
    
    // Update player Y position (check for collisions first)
    const newY = gameState.player.y + gameState.player.velocityY;
    
    // Check if new Y position would collide with stairs (for vertical blocking)
    // Only block upward movement (jumping into ceiling), allow downward movement to be handled by checkGroundCollision
    const verticalCollision = checkStairCollision(gameState.player.x, newY);
    // #region agent log
    if (gameState.currentLevel === 3 && verticalCollision) {
        fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:484',message:'Vertical collision detected',data:{playerY:gameState.player.y,newY:newY,velocityY:gameState.player.velocityY,playerX:gameState.player.x},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    if (!verticalCollision) {
        gameState.player.y = newY;
    } else {
        // Only block upward movement (hitting ceiling/stair from below)
        // Allow downward movement to pass through - checkGroundCollision will handle landing
        if (gameState.player.velocityY < 0) {
            // #region agent log
            fetch('http://127.0.0.1:7247/ingest/38fd1378-4073-467f-810e-b8c2f8413fd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'game.js:490',message:'Hitting ceiling - setting velocityY to 0',data:{playerY:gameState.player.y,newY:newY,playerX:gameState.player.x},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            gameState.player.velocityY = 0;
        } else {
            // Falling down - allow movement, checkGroundCollision will handle landing
            gameState.player.y = newY;
        }
    }
    
    // Check ground/stair collision (for landing on top)
    checkGroundCollision();
    
    // Check trap collision (death condition)
    if (checkTrapCollision()) {
        gameState.dead = true;
        resetPlayer();
    }
    
    // Check win condition (player reaches endpoint)
    if (checkCollision(gameState.player, gameState.endpoint)) {
        gameState.won = true;
        // Mark level 1 as completed when won
        if (gameState.currentLevel === 1) {
            gameState.level1Completed = true;
        }
        // Mark level 2 as completed when won
        if (gameState.currentLevel === 2) {
            gameState.level2Completed = true;
        }
        showWinModal();
    }
}

// Draw player (simple man figure)
function drawPlayer() {
    ctx.save();
    
    // Body
    ctx.fillStyle = '#3498db';
    ctx.fillRect(gameState.player.x + 10, gameState.player.y + 10, 10, 20);
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(gameState.player.x + 15, gameState.player.y + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Legs
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(gameState.player.x + 12, gameState.player.y + 30, 3, 10);
    ctx.fillRect(gameState.player.x + 15, gameState.player.y + 30, 3, 10);
    
    // Arms
    ctx.fillStyle = '#3498db';
    ctx.fillRect(gameState.player.x + 7, gameState.player.y + 12, 3, 8);
    ctx.fillRect(gameState.player.x + 20, gameState.player.y + 12, 3, 8);
    
    ctx.restore();
}

// Draw ground
function drawGround() {
    // Draw ground segments, leaving gaps for traps
    ctx.fillStyle = '#8B4513';
    
    if ((gameState.currentLevel === 2 || gameState.currentLevel === 3) && gameState.traps.length > 0) {
        // Sort traps by x position to ensure correct ground segment drawing
        const sortedTraps = [...gameState.traps].sort((a, b) => a.x - b.x);
        
        // Draw ground in segments, skipping trap areas
        let lastX = 0;
        for (let trap of sortedTraps) {
            // Draw ground segment before this trap
            if (trap.x > lastX) {
                ctx.fillRect(lastX, gameState.ground.y, trap.x - lastX, gameState.ground.height);
                
                // Add edge highlight at the right edge (where ground meets trap)
                ctx.strokeStyle = '#654321';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(trap.x, gameState.ground.y);
                ctx.lineTo(trap.x, canvas.height);
                ctx.stroke();
            }
            lastX = Math.max(lastX, trap.x + trap.width);
            
            // Add edge highlight at the left edge of next ground segment (where trap ends)
            if (lastX < canvas.width) {
                ctx.strokeStyle = '#654321';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(trap.x + trap.width, gameState.ground.y);
                ctx.lineTo(trap.x + trap.width, canvas.height);
                ctx.stroke();
            }
        }
        // Draw remaining ground after last trap
        if (lastX < canvas.width) {
            ctx.fillRect(lastX, gameState.ground.y, canvas.width - lastX, gameState.ground.height);
        }
    } else {
        // Level 1: draw full ground
        ctx.fillRect(0, gameState.ground.y, canvas.width, gameState.ground.height);
    }
    
    // Add some texture
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 20) {
        // Skip drawing texture lines over traps
        let skipLine = false;
        if (gameState.currentLevel === 2 || gameState.currentLevel === 3) {
            for (let trap of gameState.traps) {
                if (i >= trap.x && i <= trap.x + trap.width) {
                    skipLine = true;
                    break;
                }
            }
        }
        if (!skipLine) {
            ctx.beginPath();
            ctx.moveTo(i, gameState.ground.y);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
    }
}

// Draw traps (red pits below the floor)
function drawTraps() {
    if (gameState.currentLevel !== 2 || gameState.traps.length === 0) {
        return;
    }
    
    for (let trap of gameState.traps) {
        const trapTopY = gameState.ground.y + gameState.ground.height; // Top of trap (bottom of ground)
        
        // Draw shadow cast by ground edges onto the trap (makes it appear recessed)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        // Left edge shadow
        ctx.fillRect(trap.x - 2, trapTopY, 2, trap.height);
        // Right edge shadow
        ctx.fillRect(trap.x + trap.width, trapTopY, 2, trap.height);
        // Top shadow (cast downward)
        const shadowGradient = ctx.createLinearGradient(trap.x, trapTopY, trap.x, trapTopY + 15);
        shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGradient;
        ctx.fillRect(trap.x, trapTopY, trap.width, 15);
        
        // Draw the pit below ground level with gradient (darker = deeper)
        const gradient = ctx.createLinearGradient(trap.x, trapTopY, trap.x, trapTopY + trap.height);
        gradient.addColorStop(0, '#cc2222'); // Medium red at top
        gradient.addColorStop(0.5, '#990000'); // Darker red in middle
        gradient.addColorStop(1, '#550000'); // Very dark red at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(trap.x, trapTopY, trap.width, trap.height);
        
        // Add very dark shadow at the very bottom for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(trap.x, trapTopY + trap.height - 30, trap.width, 30);
        
        // Add side borders (walls of the pit) - darker to show depth
        ctx.strokeStyle = '#440000';
        ctx.lineWidth = 5;
        ctx.strokeRect(trap.x, trapTopY, trap.width, trap.height);
        
        // Add inner wall highlights (to show 3D depth)
        ctx.strokeStyle = '#660000';
        ctx.lineWidth = 2;
        // Left inner wall
        ctx.beginPath();
        ctx.moveTo(trap.x + 3, trapTopY);
        ctx.lineTo(trap.x + 3, trapTopY + trap.height);
        ctx.stroke();
        // Right inner wall
        ctx.beginPath();
        ctx.moveTo(trap.x + trap.width - 3, trapTopY);
        ctx.lineTo(trap.x + trap.width - 3, trapTopY + trap.height);
        ctx.stroke();
        
        // Add dark border at the top edge (where floor meets pit) - makes it look recessed
        ctx.strokeStyle = '#220000';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(trap.x, trapTopY);
        ctx.lineTo(trap.x + trap.width, trapTopY);
        ctx.stroke();
        
        // Add diagonal warning stripes inside the pit (darker)
        ctx.strokeStyle = '#770000';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < trap.width; i += 12) {
            ctx.beginPath();
            ctx.moveTo(trap.x + i, trapTopY);
            ctx.lineTo(trap.x + i + 12, trapTopY + trap.height);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }
}

// Draw stairs
function drawStairs() {
    ctx.fillStyle = '#A0522D';
    for (let stair of gameState.stairs) {
        ctx.fillRect(stair.x, stair.y, stair.width, stair.height);
        
        // Add edge highlight
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(stair.x, stair.y, stair.width, stair.height);
    }
}

// Draw second floor
function drawSecondFloor() {
    if (!gameState.secondFloor) {
        return;
    }
    
    // Handle both array of segments and single object (for backwards compatibility)
    const segments = Array.isArray(gameState.secondFloor) ? gameState.secondFloor : [gameState.secondFloor];
    
    ctx.fillStyle = '#8B4513';
    for (let segment of segments) {
        ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
        
        // Add edge highlight
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(segment.x, segment.y, segment.width, segment.height);
        
        // Add texture
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        for (let i = 0; i < segment.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(segment.x + i, segment.y);
            ctx.lineTo(segment.x + i, segment.y + segment.height);
            ctx.stroke();
        }
    }
}

// Draw obstacles
function drawObstacles() {
    if (!gameState.obstacles || gameState.obstacles.length === 0) {
        return;
    }
    
    ctx.fillStyle = '#A0522D';
    for (let obstacle of gameState.obstacles) {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // Add edge highlight
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
}

// Draw endpoint
function drawEndpoint() {
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(gameState.endpoint.x, gameState.endpoint.y, gameState.endpoint.width, gameState.endpoint.height);
    
    // Add label
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('END', gameState.endpoint.x + gameState.endpoint.width / 2, gameState.endpoint.y + 20);
}

// Draw everything
function draw() {
    // Clear canvas with sky color
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw game elements
    // Draw traps FIRST so they appear as pits below the ground
    drawTraps();
    // Then draw ground segments (which will have gaps where traps are)
    drawGround();
    drawStairs();
    // Draw second floor and obstacles (level 3)
    drawSecondFloor();
    drawObstacles();
    drawEndpoint();
    drawPlayer();
    
    // Draw death overlay if dead
    if (gameState.dead) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('DEAD!', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('keydown', (e) => {
    gameState.keys[e.key] = true;
    canvas.focus();
    
    // Edge-triggered jump: only once per physical key press
    if (isJumpKey(e.key)) {
        if (!gameState.jumpKeyDown) {
            tryJump();
        }
        gameState.jumpKeyDown = true;
    }
    
    // Handle restart key (R key) when dead
    if (e.key === 'r' || e.key === 'R') {
        if (gameState.dead) {
            gameState.dead = false;
            resetPlayer();
        }
    }
});

canvas.addEventListener('keyup', (e) => {
    gameState.keys[e.key] = false;
    
    // Reset jump key state when key is released
    if (isJumpKey(e.key)) {
        gameState.jumpKeyDown = false;
    }
});

// Level switching
function switchLevel(level) {
    // Prevent switching to level 2 if level 1 is not completed
    if (level === 2 && !gameState.level1Completed) {
        return;
    }
    
    // Prevent switching to level 3 if level 2 is not completed
    if (level === 3 && !gameState.level2Completed) {
        return;
    }
    
    gameState.currentLevel = level;
    gameState.won = false;
    gameState.dead = false;
    gameState.jumpKeyDown = false;
    initLevel();
    resetPlayer();
    updateUI();
}

function updateUI() {
    document.getElementById('levelDisplay').textContent = gameState.currentLevel;
    const levelInstructions = document.getElementById('levelInstructions');
    const level1Button = document.getElementById('level1Button');
    const level2Button = document.getElementById('level2Button');
    const level3Button = document.getElementById('level3Button');
    
    if (gameState.currentLevel === 1) {
        levelInstructions.textContent = 'Hint: Utilize ← → ↑';
        level1Button.classList.add('active');
        level2Button.classList.remove('active');
        if (level3Button) level3Button.classList.remove('active');
    } else if (gameState.currentLevel === 2) {
        levelInstructions.textContent = 'Hint: Utilize U, K, N';
        level1Button.classList.remove('active');
        level2Button.classList.add('active');
        if (level3Button) level3Button.classList.remove('active');
    } else if (gameState.currentLevel === 3) {
        levelInstructions.textContent = 'Hint: Utilize P, C+O, S';
        level1Button.classList.remove('active');
        level2Button.classList.remove('active');
        if (level3Button) level3Button.classList.add('active');
    }
    
    // Update level 2 button state (locked/unlocked)
    if (gameState.level1Completed) {
        level2Button.disabled = false;
        level2Button.classList.remove('locked');
        level2Button.title = '';
    } else {
        level2Button.disabled = true;
        level2Button.classList.add('locked');
        level2Button.title = 'Complete Level 1 to unlock';
    }
    
    // Update level 3 button state (locked/unlocked)
    if (level3Button) {
        if (gameState.level2Completed) {
            level3Button.disabled = false;
            level3Button.classList.remove('locked');
            level3Button.title = '';
        } else {
            level3Button.disabled = true;
            level3Button.classList.add('locked');
            level3Button.title = 'Complete Level 2 to unlock';
        }
    }
}

// Level button event listeners
document.getElementById('level1Button').addEventListener('click', () => {
    switchLevel(1);
});

document.getElementById('level2Button').addEventListener('click', () => {
    switchLevel(2);
});

const level3Button = document.getElementById('level3Button');
if (level3Button) {
    level3Button.addEventListener('click', () => {
        switchLevel(3);
    });
}

// Make canvas focusable
canvas.setAttribute('tabindex', '0');

// Show win modal
function showWinModal() {
    const modal = document.getElementById('winModal');
    const restartButton = document.getElementById('restartButton');
    
    // Update modal content based on level
    if (gameState.currentLevel === 1) {
        // Level 1: Show "Next Level" button
        restartButton.textContent = 'Next Level';
        restartButton.onclick = () => {
            modal.classList.add('hidden');
            switchLevel(2);
        };
    } else if (gameState.currentLevel === 2) {
        // Level 2: Show "Next Level" button
        restartButton.textContent = 'Next Level';
        restartButton.onclick = () => {
            modal.classList.add('hidden');
            switchLevel(3);
        };
    } else {
        // Level 3: Show "Play Again" button
        restartButton.textContent = 'Play Again';
        restartButton.onclick = () => {
            gameState.won = false;
            gameState.dead = false;
            resetPlayer();
            modal.classList.add('hidden');
        };
    }
    
    modal.classList.remove('hidden');
}

// Reset player position
function resetPlayer() {
    // All levels: start at bottom left
    gameState.player.x = 50;
    gameState.player.y = gameState.ground.y - gameState.player.height;
    gameState.player.velocityY = 0;
    gameState.player.onGround = true;
    gameState.player.canJump = true;
    gameState.jumpKeyDown = false;
}

// Note: restartButton click handler is now set dynamically in showWinModal()

// Initialize game
initLevel();
initPlayer();
updateUI();

// Auto-focus canvas when page loads
window.addEventListener('load', () => {
    canvas.focus();
});

// Also focus on click anywhere on the page
document.addEventListener('click', () => {
    canvas.focus();
});

gameLoop();
