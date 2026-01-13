// Game Configuration
const HORIZONTAL_ROADS = 3; // 3 horizontal roads (top, middle, bottom)
const VERTICAL_ROADS = 3; // 3 vertical roads (left, middle, right)
const PARKING_ROWS = 2; // 2 rows of parking squares (between the 3 horizontal roads)
const PARKING_COLS = 2; // 2 columns of parking squares (between the 3 vertical roads)
const ROAD_WIDTH = 80; // Wider road to accommodate cars on one side
const PARKING_SPACE_WIDTH = 40;
const PARKING_SPACE_HEIGHT = 60;
const CAR_WIDTH = 30;
const CAR_HEIGHT = 50;
const SPACING = 5; // Spacing between parking spaces

// Parking grid configuration - how many spaces per square
const SPACES_PER_ROW = 4; // Number of parking spaces horizontally per square
const SPACES_PER_COL = 2; // Number of parking spaces vertically per square

// Calculate square dimensions based on parking spaces
const SQUARE_WIDTH = SPACES_PER_ROW * (PARKING_SPACE_WIDTH + SPACING) - SPACING;
const SQUARE_HEIGHT = SPACES_PER_COL * (PARKING_SPACE_HEIGHT + SPACING) - SPACING;

// Space for walls outside boundary roads
const WALL_SPACE = 20; // Space outside roads for walls
// Space at bottom for entrance area
const ENTRANCE_AREA_HEIGHT = 60; // Space below bottom road for entrance

// Calculate canvas dimensions based on squares + roads + wall space + entrance area
// Width: wall space + road + square + road + square + road + wall space
const CANVAS_WIDTH = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH + ROAD_WIDTH + SQUARE_WIDTH + ROAD_WIDTH + WALL_SPACE;
// Height: wall space + road + square + road + square + road + entrance area
const CANVAS_HEIGHT = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + ENTRANCE_AREA_HEIGHT;

// Directions: 0=North, 1=East, 2=South, 3=West
const DIRECTIONS = {
    NORTH: 0,
    EAST: 1,
    SOUTH: 2,
    WEST: 3
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game state
let playerCar = {
    x: CANVAS_WIDTH / 2, // Start at center of entrance
    y: CANVAS_HEIGHT - 30, // Start at bottom entrance area (just inside the entrance)
    direction: DIRECTIONS.NORTH,
    speed: 2,
    parked: false
};

let botCars = [];
let parkedCars = [];
let parkingSpaces = [];
let keys = {};
let gameStartTime = null; // Track when game started for initial delay
let lastBotSpawnTime = null; // Track when last bot was spawned
const BOT_SPAWN_INTERVAL = 5000; // Spawn a new bot every 5 seconds
const INITIAL_SPAWN_DELAY = 4000; // Wait 4 seconds after game start before first spawn (enters 1 sec before first departure)
let lastParkedCarLeaveTime = null; // Track when last parked car left
const PARKED_CAR_LEAVE_INTERVAL = 5000; // One parked car leaves every 5 seconds
let nextSpotToVacate = null; // Track which spot will be vacated next (for new bots to target)

// Initialize parking lot
function initializeParkingLot() {
    parkingSpaces = [];
    
    // Create parking spaces in each of the 4 squares (2 rows x 2 columns)
    // Fill each square with a grid of parking spaces that fit exactly
    for (let row = 0; row < PARKING_ROWS; row++) {
        for (let col = 0; col < PARKING_COLS; col++) {
            // Calculate square position - account for wall space at top and left
            const squareX = WALL_SPACE + ROAD_WIDTH + col * (SQUARE_WIDTH + ROAD_WIDTH);
            const squareY = WALL_SPACE + ROAD_WIDTH + row * (SQUARE_HEIGHT + ROAD_WIDTH);
            
            // Create parking spaces in a grid - no centering needed, they fill exactly
            for (let i = 0; i < SPACES_PER_COL; i++) {
                for (let j = 0; j < SPACES_PER_ROW; j++) {
                    const newSpace = {
                        x: squareX + j * (PARKING_SPACE_WIDTH + SPACING),
                        y: squareY + i * (PARKING_SPACE_HEIGHT + SPACING),
                        width: PARKING_SPACE_WIDTH,
                        height: PARKING_SPACE_HEIGHT,
                        occupied: true, // Start all as occupied
                        row: row,
                        col: col,
                        side: i < SPACES_PER_COL / 2 ? 'top' : 'bottom' // Top half face north, bottom half face south
                    };
                    parkingSpaces.push(newSpace);
                }
            }
        }
    }
    
    // All spaces start occupied - no free spaces at game start
    // Create initial parked cars for all occupied spaces
    for (let space of parkingSpaces) {
        if (space.occupied) {
            space.hasCar = true;
            parkedCars.push({
                space: space,
                leaveTimer: Math.random() * 10000 + 5000 // Leave after 5-15 seconds
            });
        }
    }
}

// Initialize bot cars
function initializeBotCars() {
    botCars = []; // Start with no bots - they will enter one per second
}

// Spawn a new bot at the entrance
function spawnNewBotAtEntrance() {
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const entranceCenterX = entranceX + ENTRANCE_WIDTH / 2;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    // Spawn bot just below the canvas, at the entrance, heading north
    // Add some random variation horizontally within the entrance width
    const spawnX = entranceCenterX + (Math.random() - 0.5) * (ENTRANCE_WIDTH - 20); // Keep some margin from edges
    const spawnY = CANVAS_HEIGHT + 20; // Start below the canvas
    
    // Check if there's already a bot too close to the spawn position
    let tooClose = false;
    for (let bot of botCars) {
        const distance = Math.sqrt(
            Math.pow(bot.x - spawnX, 2) + 
            Math.pow(bot.y - spawnY, 2)
        );
        if (distance < 60) { // Minimum distance between bots
            tooClose = true;
            break;
        }
    }
    
    // Don't spawn if too close to another bot
    if (tooClose) {
        return;
    }
    
    // Create new bot car
    const newBot = {
        x: spawnX,
        y: spawnY,
        direction: DIRECTIONS.NORTH, // Enter heading north
        speed: 1.5,
        targetSpace: nextSpotToVacate, // Assign the spot that will be vacated
        state: nextSpotToVacate ? 'parking' : 'searching', // If we know the target, go straight to parking mode
        path: null,
        pathIndex: 0,
        pathTargetSpace: null
    };
    
    // If we have a target spot, start navigating to it immediately
    if (nextSpotToVacate) {
        // Initialize road graph if needed
        if (!roadGraph) {
            roadGraph = initializeRoadGraph();
        }
        // Set the path target space
        newBot.pathTargetSpace = nextSpotToVacate;
        // Start navigating toward the target space
        navigateTowardParkingSpace(newBot, nextSpotToVacate);
    }
    
    // Snap to correct lane for initial direction
    snapBotToLane(newBot);
    botCars.push(newBot);
}

// Count bots that are currently looking for parking spots (searching or parking state)
function countBotsLookingForSpots() {
    let count = 0;
    for (let bot of botCars) {
        if (bot.state === 'searching' || bot.state === 'parking') {
            count++;
        }
    }
    return count;
}

// Check if we should spawn a new bot and spawn it if needed
function checkAndSpawnBots() {
    if (gameStartTime === null) {
        gameStartTime = Date.now();
        lastBotSpawnTime = Date.now();
        return;
    }
    
    const elapsedTime = Date.now() - gameStartTime;
    
    // Wait for initial delay before first spawn
    if (elapsedTime < INITIAL_SPAWN_DELAY) {
        return;
    }
    
    // Always spawn one bot every 5 seconds (enters 1 second before a car leaves)
    if (lastBotSpawnTime === null) {
        lastBotSpawnTime = Date.now();
        spawnNewBotAtEntrance();
    } else {
        const timeSinceLastSpawn = Date.now() - lastBotSpawnTime;
        if (timeSinceLastSpawn >= BOT_SPAWN_INTERVAL) {
            spawnNewBotAtEntrance();
            lastBotSpawnTime = Date.now();
        }
    }
}

// Check if a direction is opposite to current direction (U-turn prevention)
function isOppositeDirection(currentDir, newDir) {
    const opposites = {
        [DIRECTIONS.NORTH]: DIRECTIONS.SOUTH,
        [DIRECTIONS.SOUTH]: DIRECTIONS.NORTH,
        [DIRECTIONS.EAST]: DIRECTIONS.WEST,
        [DIRECTIONS.WEST]: DIRECTIONS.EAST
    };
    return opposites[currentDir] === newDir;
}

// Check if a position is within the parking lot boundary
function isWithinBoundary(x, y) {
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const BOUNDARY_MARGIN = 2; // Small margin inside the boundary
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    // Always allow movement in the entrance area (below parking lot)
    if (y >= parkingLotBottom && y <= CANVAS_HEIGHT) {
        // Must be within entrance width
        if (x >= entranceX && x <= entranceX + ENTRANCE_WIDTH) {
            return true; // In entrance area
        }
        return false; // Outside entrance area but below parking lot
    }
    
    // Check if within horizontal bounds (accounting for wall space)
    if (x < WALL_SPACE + BOUNDARY_MARGIN || x > CANVAS_WIDTH - WALL_SPACE - BOUNDARY_MARGIN) {
        return false;
    }
    
    // Check top boundary (wall space)
    if (y < WALL_SPACE + BOUNDARY_MARGIN) {
        return false;
    }
    
    // Within parking lot area
    return true;
}

// Check if two rectangles overlap
function rectanglesOverlap(rect1, rect2) {
    return !(rect1.x + rect1.width < rect2.x ||
             rect2.x + rect2.width < rect1.x ||
             rect1.y + rect1.height < rect2.y ||
             rect2.y + rect2.height < rect1.y);
}

// Get car bounding box (rectangle) based on position and direction
function getCarBoundingBox(x, y, direction) {
    // Car dimensions - width and height swap based on direction
    let carWidth, carHeight;
    if (direction === DIRECTIONS.NORTH || direction === DIRECTIONS.SOUTH) {
        // Car facing north or south - vertical orientation
        carWidth = CAR_WIDTH;
        carHeight = CAR_HEIGHT;
    } else {
        // Car facing east or west - horizontal orientation
        carWidth = CAR_HEIGHT;
        carHeight = CAR_WIDTH;
    }
    
    // Return bounding box (x, y is center of car, so calculate top-left corner)
    return {
        x: x - carWidth / 2,
        y: y - carHeight / 2,
        width: carWidth,
        height: carHeight
    };
}

// Check if car collides with any parking space (optionally exclude a specific space or exclude spaces near a position)
function carCollidesWithParkingSpace(x, y, direction, excludeSpace = null, excludeNearPosition = null, excludeRadius = 0) {
    const carBox = getCarBoundingBox(x, y, direction);
    
    for (let space of parkingSpaces) {
        // Skip the excluded space (e.g., target space for parking bots)
        if (excludeSpace && space === excludeSpace) {
            continue;
        }
        
        // Skip spaces near a specific position (useful for exiting bots to avoid nearby spaces)
        if (excludeNearPosition && excludeRadius > 0) {
            const spaceCenterX = space.x + space.width / 2;
            const spaceCenterY = space.y + space.height / 2;
            const distance = Math.sqrt(
                Math.pow(spaceCenterX - excludeNearPosition.x, 2) +
                Math.pow(spaceCenterY - excludeNearPosition.y, 2)
            );
            if (distance < excludeRadius) {
                continue;
            }
        }
        
        const spaceBox = {
            x: space.x,
            y: space.y,
            width: space.width,
            height: space.height
        };
        
        if (rectanglesOverlap(carBox, spaceBox)) {
            return true;
        }
    }
    
    return false;
}

// Check if car collides with any wall
function carCollidesWithWall(x, y, direction) {
    // Allow cars to maneuver freely while centered in an intersection.
    if (isAtIntersection(x, y)) {
        return false;
    }

    const carBox = getCarBoundingBox(x, y, direction);
    const WALL_WIDTH = 8;
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    // Top wall
    if (rectanglesOverlap(carBox, { x: 0, y: 0, width: CANVAS_WIDTH, height: WALL_SPACE })) {
        return true;
    }
    
    // Left wall
    if (rectanglesOverlap(carBox, { x: 0, y: 0, width: WALL_SPACE, height: CANVAS_HEIGHT })) {
        return true;
    }
    
    // Right wall
    if (rectanglesOverlap(carBox, { x: CANVAS_WIDTH - WALL_SPACE, y: 0, width: WALL_SPACE, height: CANVAS_HEIGHT })) {
        return true;
    }
    
    // Bottom wall (with entrance gap)
    // Allow a small tolerance so cars on the bottom road don't clip the wall
    const bottomWallY = parkingLotBottom + CAR_HEIGHT / 2;
    // Left side of bottom wall
    if (rectanglesOverlap(carBox, { x: 0, y: bottomWallY, width: entranceX, height: WALL_SPACE })) {
        return true;
    }
    // Right side of bottom wall
    if (rectanglesOverlap(carBox, { x: entranceX + ENTRANCE_WIDTH, y: bottomWallY, 
                                    width: CANVAS_WIDTH - (entranceX + ENTRANCE_WIDTH), height: WALL_SPACE })) {
        return true;
    }
    
    return false;
}

// Check if car collides with other cars (excluding itself)
function carCollidesWithOtherCars(x, y, direction, excludeCar = null) {
    const carBox = getCarBoundingBox(x, y, direction);
    
    // Check collision with player car (if not excluded and not parked)
    if (excludeCar !== playerCar && !playerCar.parked) {
        const playerBox = getCarBoundingBox(playerCar.x, playerCar.y, playerCar.direction);
        if (rectanglesOverlap(carBox, playerBox)) {
            return true;
        }
    }
    
    // Only check collision with bot cars if this is the player car
    // Bots can pass through each other (no bot-to-bot collision)
    if (excludeCar === null || excludeCar === playerCar) {
        // This is the player car checking for bot collisions
        for (let bot of botCars) {
            if (bot.state !== 'parked') {
                const botBox = getCarBoundingBox(bot.x, bot.y, bot.direction);
                if (rectanglesOverlap(carBox, botBox)) {
                    return true;
                }
            }
        }
    }
    // Bots don't check collisions with other bots - they can pass through
    
    return false;
}

// Check if a position is on a road (not in a parking space)
function isOnRoad(x, y) {
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    const parkingLotBottom = bottomRoadY + ROAD_WIDTH;
    
    const leftRoadX = WALL_SPACE;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH;
    
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    
    // Check if on horizontal roads (top, middle, bottom)
    const onTopRoad = y >= topRoadY && y <= topRoadY + ROAD_WIDTH && 
                      x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onMiddleRoad = y >= middleRoadY && y <= middleRoadY + ROAD_WIDTH &&
                          x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onBottomRoad = y >= bottomRoadY && y <= bottomRoadY + ROAD_WIDTH &&
                         x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    
    // Check if on entrance area (below bottom road, in the entrance gap)
    const onEntranceArea = y >= parkingLotBottom && y <= CANVAS_HEIGHT &&
                           x >= entranceX && x <= entranceX + ENTRANCE_WIDTH;
    
    // Check if on vertical roads (left, middle, right)
    const onLeftRoad = x >= leftRoadX && x <= leftRoadX + ROAD_WIDTH &&
                       y >= WALL_SPACE && y <= parkingLotBottom;
    const onMiddleVerticalRoad = x >= middleRoadX && x <= middleRoadX + ROAD_WIDTH &&
                                 y >= WALL_SPACE && y <= parkingLotBottom;
    const onRightRoad = x >= rightRoadX && x <= rightRoadX + ROAD_WIDTH &&
                        y >= WALL_SPACE && y <= parkingLotBottom;
    
    // Car is on a road if it's on any horizontal road, entrance area, OR any vertical road
    return (onTopRoad || onMiddleRoad || onBottomRoad || onEntranceArea) || (onLeftRoad || onMiddleVerticalRoad || onRightRoad);
}

// Check if at intersection
function isAtIntersection(x, y) {
    const threshold = ROAD_WIDTH / 2 + 10;
    
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    
    const leftRoadX = WALL_SPACE;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH;
    
    // Calculate all intersection points (3 horizontal roads x 3 vertical roads = 9 intersections)
    const intersections = [];
    const roadYs = [topRoadY, middleRoadY, bottomRoadY];
    const roadXs = [leftRoadX, middleRoadX, rightRoadX];
    
    for (let i = 0; i < roadYs.length; i++) {
        for (let j = 0; j < roadXs.length; j++) {
            intersections.push({ 
                x: roadXs[j] + ROAD_WIDTH / 2, 
                y: roadYs[i] + ROAD_WIDTH / 2 
            });
        }
    }
    
    // Check if near any intersection
    for (let intersection of intersections) {
        const distance = Math.sqrt(
            Math.pow(x - intersection.x, 2) + 
            Math.pow(y - intersection.y, 2)
        );
        if (distance < threshold) {
            return true;
        }
    }
    
    return false;
}

// Check if a position is on a horizontal road
function isOnHorizontalRoad(x, y) {
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    
    // Check if on horizontal roads (top, middle, bottom)
    const onTopRoad = y >= topRoadY && y <= topRoadY + ROAD_WIDTH && 
                      x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onMiddleRoad = y >= middleRoadY && y <= middleRoadY + ROAD_WIDTH &&
                          x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onBottomRoad = y >= bottomRoadY && y <= bottomRoadY + ROAD_WIDTH &&
                         x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    
    return onTopRoad || onMiddleRoad || onBottomRoad;
}

// Check which horizontal road a position is on (returns 'top', 'middle', 'bottom', or null)
function getHorizontalRoad(x, y) {
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    
    if (y >= topRoadY && y <= topRoadY + ROAD_WIDTH && 
        x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE) {
        return 'top';
    }
    if (y >= middleRoadY && y <= middleRoadY + ROAD_WIDTH &&
        x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE) {
        return 'middle';
    }
    if (y >= bottomRoadY && y <= bottomRoadY + ROAD_WIDTH &&
        x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE) {
        return 'bottom';
    }
    return null;
}

// Check if a parking space is adjacent to a specific horizontal road
function isSpaceAdjacentToHorizontalRoad(space, roadName) {
    // Top road is adjacent to spaces in row 0, side 'top'
    if (roadName === 'top') {
        return space.row === 0 && space.side === 'top';
    }
    // Middle road is adjacent to spaces in row 0, side 'bottom' OR row 1, side 'top'
    if (roadName === 'middle') {
        return (space.row === 0 && space.side === 'bottom') || 
               (space.row === 1 && space.side === 'top');
    }
    // Bottom road is adjacent to spaces in row 1, side 'bottom'
    if (roadName === 'bottom') {
        return space.row === 1 && space.side === 'bottom';
    }
    return false;
}

// Check if car's horizontal boundary overlaps with parking space's horizontal boundary
function carHorizontallyOverlapsSpace(carX, carY, carDirection, space) {
    const carBox = getCarBoundingBox(carX, carY, carDirection);
    
    // Check horizontal overlap: car's x-range overlaps with space's x-range
    const carLeft = carBox.x;
    const carRight = carBox.x + carBox.width;
    const spaceLeft = space.x;
    const spaceRight = space.x + space.width;
    
    // Check if there's any horizontal overlap
    return !(carRight < spaceLeft || carLeft > spaceRight);
}

// Check if next to a free parking space
function checkNearParkingSpace() {
    if (playerCar.parked) return null;
    
    // Player must be on a horizontal road to park
    if (!isOnHorizontalRoad(playerCar.x, playerCar.y)) {
        return null;
    }
    
    // Determine which horizontal road the car is on
    const currentRoad = getHorizontalRoad(playerCar.x, playerCar.y);
    if (!currentRoad) {
        return null;
    }
    
    // Check each parking space
    for (let space of parkingSpaces) {
        if (space.occupied) continue;
        
        // Space must be adjacent to the current horizontal road
        if (!isSpaceAdjacentToHorizontalRoad(space, currentRoad)) {
            continue;
        }
        
        // Car's body must horizontally overlap with the parking space
        if (!carHorizontallyOverlapsSpace(playerCar.x, playerCar.y, playerCar.direction, space)) {
            continue;
        }
        
        // If all conditions met, this space can be parked in
        return space;
    }
    return null;
}

// Update player car
function updatePlayerCar() {
    if (playerCar.parked) return;
    
    let newX = playerCar.x;
    let newY = playerCar.y;
    let newDirection = playerCar.direction;
    let moveAttempted = false;
    
    // Arrow keys directly control movement direction
    // At intersections, can turn and move in one action
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        newY = playerCar.y - playerCar.speed;
        newDirection = DIRECTIONS.NORTH;
        moveAttempted = true;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        newY = playerCar.y + playerCar.speed;
        newDirection = DIRECTIONS.SOUTH;
        moveAttempted = true;
    } else if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        newX = playerCar.x - playerCar.speed;
        newDirection = DIRECTIONS.WEST;
        moveAttempted = true;
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        newX = playerCar.x + playerCar.speed;
        newDirection = DIRECTIONS.EAST;
        moveAttempted = true;
    }
    
    // If a move was attempted, check if it's valid
    if (moveAttempted) {
        // Prevent U-turns: don't allow moving directly opposite to current direction
        if (isOppositeDirection(playerCar.direction, newDirection)) {
            // Invalid move - U-turn not allowed
            return;
        }
        
        // Check if move is valid: must be on road, within boundary, and not colliding with parking spaces or walls
        // Player car can pass through bots (no collision with other cars)
        if (isOnRoad(newX, newY) && isWithinBoundary(newX, newY)) {
            // Check if the entire car body would collide with parking spaces or walls
            if (!carCollidesWithParkingSpace(newX, newY, newDirection) && 
                !carCollidesWithWall(newX, newY, newDirection)) {
                playerCar.x = newX;
                playerCar.y = newY;
                playerCar.direction = newDirection;
            }
        }
        // If invalid move, nothing happens (car stays in place)
    }
    
    // Check for parking
    const nearSpace = checkNearParkingSpace();
    const parkButton = document.getElementById('parkButton');
    if (nearSpace) {
        parkButton.classList.remove('hidden');
    } else {
        parkButton.classList.add('hidden');
    }
}

// Park the player car
function parkPlayer() {
    const nearSpace = checkNearParkingSpace();
    if (nearSpace && !playerCar.parked && !nearSpace.occupied) {
        playerCar.parked = true;
        playerCar.x = nearSpace.x + nearSpace.width / 2;
        playerCar.y = nearSpace.y + nearSpace.height / 2;
        nearSpace.occupied = true;
        nearSpace.hasCar = true;
        // Set direction based on which side of the square the space is on
        if (nearSpace.side === 'top') {
            playerCar.direction = DIRECTIONS.NORTH;
        } else if (nearSpace.side === 'bottom') {
            playerCar.direction = DIRECTIONS.SOUTH;
        } else if (nearSpace.side === 'left') {
            playerCar.direction = DIRECTIONS.EAST;
        } else if (nearSpace.side === 'right') {
            playerCar.direction = DIRECTIONS.WEST;
        }
        document.getElementById('parkButton').classList.add('hidden');
        showWinModal();
    }
}

// Show win modal
function showWinModal() {
    const winModal = document.getElementById('winModal');
    winModal.classList.remove('hidden');
}

// Hide win modal
function hideWinModal() {
    const winModal = document.getElementById('winModal');
    winModal.classList.add('hidden');
}

// Restart the game
function restartGame() {
    // Hide win modal
    hideWinModal();
    
    // Reset game state
    playerCar = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 30,
        direction: DIRECTIONS.NORTH,
        speed: 2,
        parked: false
    };
    
    botCars = [];
    parkedCars = [];
    parkingSpaces = [];
    gameStartTime = Date.now();
    lastBotSpawnTime = null; // Reset spawn timer
    lastParkedCarLeaveTime = null; // Reset parked car leave timer
    nextSpotToVacate = null; // Reset next spot to vacate
    
    // Reinitialize
    initializeParkingLot();
    initializeBotCars();
    
    // Hide park button
    document.getElementById('parkButton').classList.add('hidden');
}

// Helper function to choose direction toward a target point
function chooseDirectionTowardTarget(botX, botY, targetX, targetY, currentDirection) {
    const dx = targetX - botX;
    const dy = targetY - botY;
    
    // Determine which direction to go based on distance
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    // If already close enough, maintain current direction or choose based on larger component
    if (absDx < 5 && absDy < 5) {
        return currentDirection;
    }
    
    // Prefer the direction with larger distance component
    // But also consider if we're on a road that allows that direction
    if (absDx > absDy) {
        // Horizontal movement preferred
        return dx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
    } else {
        // Vertical movement preferred
        return dy > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
    }
}

// ==================== LANE-BASED PATH SYSTEM FOR BOTS ====================

// Get the correct lane position (right side of road) for a bot based on its direction and position
// Returns the Y position for horizontal roads or X position for vertical roads
function getLanePosition(x, y, direction) {
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    const parkingLotBottom = bottomRoadY + ROAD_WIDTH;
    
    const leftRoadX = WALL_SPACE;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH;
    
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    
    // Lane offset from center (right side of road from driver's perspective)
    // Each lane is ROAD_WIDTH / 2 = 40px wide, so offset by 1/4 of road width (10px) from center
    const LANE_OFFSET = ROAD_WIDTH / 4; // 20px offset from center line
    
    // Check if on horizontal road
    const onTopRoad = y >= topRoadY && y <= topRoadY + ROAD_WIDTH && 
                      x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onMiddleRoad = y >= middleRoadY && y <= middleRoadY + ROAD_WIDTH &&
                          x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    const onBottomRoad = y >= bottomRoadY && y <= bottomRoadY + ROAD_WIDTH &&
                         x >= WALL_SPACE && x <= CANVAS_WIDTH - WALL_SPACE;
    
    if (onTopRoad || onMiddleRoad || onBottomRoad) {
        // Horizontal road - return Y position
        let roadCenterY;
        if (onTopRoad) roadCenterY = topRoadY + ROAD_WIDTH / 2;
        else if (onMiddleRoad) roadCenterY = middleRoadY + ROAD_WIDTH / 2;
        else roadCenterY = bottomRoadY + ROAD_WIDTH / 2;
        
        // Right side of road from driver's perspective:
        // EAST (right) -> right side = bottom half (below center)
        // WEST (left) -> right side = top half (above center)
        if (direction === DIRECTIONS.EAST) {
            return roadCenterY + LANE_OFFSET; // Bottom half
        } else if (direction === DIRECTIONS.WEST) {
            return roadCenterY - LANE_OFFSET; // Top half
        }
        // If direction is NORTH or SOUTH on horizontal road, use center (shouldn't happen normally)
        return roadCenterY;
    }
    
    // Check if on vertical road
    const onLeftRoad = x >= leftRoadX && x <= leftRoadX + ROAD_WIDTH &&
                       y >= WALL_SPACE && y <= parkingLotBottom;
    const onMiddleVerticalRoad = x >= middleRoadX && x <= middleRoadX + ROAD_WIDTH &&
                                 y >= WALL_SPACE && y <= parkingLotBottom;
    const onRightRoad = x >= rightRoadX && x <= rightRoadX + ROAD_WIDTH &&
                        y >= WALL_SPACE && y <= parkingLotBottom;
    
    if (onLeftRoad || onMiddleVerticalRoad || onRightRoad) {
        // Vertical road - return X position
        let roadCenterX;
        if (onLeftRoad) roadCenterX = leftRoadX + ROAD_WIDTH / 2;
        else if (onMiddleVerticalRoad) roadCenterX = middleRoadX + ROAD_WIDTH / 2;
        else roadCenterX = rightRoadX + ROAD_WIDTH / 2;
        
        // Right side of road from driver's perspective:
        // SOUTH (down) -> right side = right half (east of center)
        // NORTH (up) -> right side = left half (west of center)
        if (direction === DIRECTIONS.SOUTH) {
            return roadCenterX + LANE_OFFSET; // Right half
        } else if (direction === DIRECTIONS.NORTH) {
            return roadCenterX - LANE_OFFSET; // Left half
        }
        // If direction is EAST or WEST on vertical road, use center (shouldn't happen normally)
        return roadCenterX;
    }
    
    // Check if in entrance area (including below canvas for entering bots)
    const onEntranceArea = y >= parkingLotBottom && 
                           x >= entranceX && x <= entranceX + ENTRANCE_WIDTH;
    
    if (onEntranceArea) {
        // Entrance area - treat as horizontal road
        // For entrance, bots typically go NORTH (entering) or SOUTH (exiting)
        // If going SOUTH (exiting), stay on right side (right half of entrance)
        // If going NORTH (entering), stay on right side (left half of entrance)
        const entranceCenterX = entranceX + ENTRANCE_WIDTH / 2;
        if (direction === DIRECTIONS.SOUTH) {
            return entranceCenterX + LANE_OFFSET; // Right side when exiting
        } else if (direction === DIRECTIONS.NORTH) {
            return entranceCenterX - LANE_OFFSET; // Right side when entering
        }
        return entranceCenterX;
    }
    
    // Not on a recognized road, return current position
    return null;
}

// Snap bot to correct lane position based on its direction
function snapBotToLane(bot) {
    // Don't snap to lane if at intersection - allow smooth turning
    if (isAtIntersection(bot.x, bot.y)) {
        return; // Skip lane snapping at intersections to allow turning
    }
    
    const lanePos = getLanePosition(bot.x, bot.y, bot.direction);
    if (lanePos === null) return; // Not on a road
    
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    const parkingLotBottom = bottomRoadY + ROAD_WIDTH;
    
    const leftRoadX = WALL_SPACE;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH;
    
    // Check if on horizontal road
    const onTopRoad = bot.y >= topRoadY && bot.y <= topRoadY + ROAD_WIDTH && 
                      bot.x >= WALL_SPACE && bot.x <= CANVAS_WIDTH - WALL_SPACE;
    const onMiddleRoad = bot.y >= middleRoadY && bot.y <= middleRoadY + ROAD_WIDTH &&
                          bot.x >= WALL_SPACE && bot.x <= CANVAS_WIDTH - WALL_SPACE;
    const onBottomRoad = bot.y >= bottomRoadY && bot.y <= bottomRoadY + ROAD_WIDTH &&
                         bot.x >= WALL_SPACE && bot.x <= CANVAS_WIDTH - WALL_SPACE;
    
    if (onTopRoad || onMiddleRoad || onBottomRoad) {
        // Horizontal road - snap Y position
        const targetY = lanePos;
        // Smoothly move toward lane position (don't snap instantly to avoid jitter)
        const snapSpeed = 0.5;
        if (Math.abs(bot.y - targetY) > snapSpeed) {
            bot.y += (targetY > bot.y ? snapSpeed : -snapSpeed);
        } else {
            bot.y = targetY;
        }
        return;
    }
    
    // Check if on vertical road
    const onLeftRoad = bot.x >= leftRoadX && bot.x <= leftRoadX + ROAD_WIDTH &&
                       bot.y >= WALL_SPACE && bot.y <= parkingLotBottom;
    const onMiddleVerticalRoad = bot.x >= middleRoadX && bot.x <= middleRoadX + ROAD_WIDTH &&
                                 bot.y >= WALL_SPACE && bot.y <= parkingLotBottom;
    const onRightRoad = bot.x >= rightRoadX && bot.x <= rightRoadX + ROAD_WIDTH &&
                        bot.y >= WALL_SPACE && bot.y <= parkingLotBottom;
    
    if (onLeftRoad || onMiddleVerticalRoad || onRightRoad) {
        // Vertical road - snap X position
        const targetX = lanePos;
        // Smoothly move toward lane position
        const snapSpeed = 0.5;
        if (Math.abs(bot.x - targetX) > snapSpeed) {
            bot.x += (targetX > bot.x ? snapSpeed : -snapSpeed);
        } else {
            bot.x = targetX;
        }
        return;
    }
    
    // Check if in entrance area (including below canvas for entering bots)
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const onEntranceArea = bot.y >= parkingLotBottom &&
                           bot.x >= entranceX && bot.x <= entranceX + ENTRANCE_WIDTH;
    
    if (onEntranceArea) {
        // Entrance area - snap X position
        const targetX = lanePos;
        const snapSpeed = 0.5;
        if (Math.abs(bot.x - targetX) > snapSpeed) {
            bot.x += (targetX > bot.x ? snapSpeed : -snapSpeed);
        } else {
            bot.x = targetX;
        }
        return;
    }
    
}

// ==================== PATHFINDING SYSTEM ====================

// Road network graph - nodes represent intersections and key points
let roadGraph = null;

// Initialize the road network graph
function initializeRoadGraph() {
    const topRoadY = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    const leftRoadX = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH + ROAD_WIDTH / 2;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH / 2;
    
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const entranceCenterX = entranceX + ENTRANCE_WIDTH / 2;
    const entranceY = parkingLotBottom + ENTRANCE_AREA_HEIGHT / 2;
    
    // Create nodes at all intersections (9 intersections + entrance)
    // Naming: top-left, top-middle, top-right, middle-left, etc.
    const nodes = {
        'top-left': { x: leftRoadX, y: topRoadY, id: 'top-left' },
        'top-middle': { x: middleRoadX, y: topRoadY, id: 'top-middle' },
        'top-right': { x: rightRoadX, y: topRoadY, id: 'top-right' },
        'middle-left': { x: leftRoadX, y: middleRoadY, id: 'middle-left' },
        'middle-middle': { x: middleRoadX, y: middleRoadY, id: 'middle-middle' },
        'middle-right': { x: rightRoadX, y: middleRoadY, id: 'middle-right' },
        'bottom-left': { x: leftRoadX, y: bottomRoadY, id: 'bottom-left' },
        'bottom-middle': { x: middleRoadX, y: bottomRoadY, id: 'bottom-middle' },
        'bottom-right': { x: rightRoadX, y: bottomRoadY, id: 'bottom-right' },
        'entrance': { x: entranceCenterX, y: entranceY, id: 'entrance' }
    };
    
    // Create edges (connections between nodes along roads)
    // Each edge has: { from, to, distance }
    const edges = [];
    
    // Horizontal connections (top road)
    edges.push({ from: 'top-left', to: 'top-middle', distance: Math.abs(middleRoadX - leftRoadX) });
    edges.push({ from: 'top-middle', to: 'top-right', distance: Math.abs(rightRoadX - middleRoadX) });
    
    // Horizontal connections (middle road)
    edges.push({ from: 'middle-left', to: 'middle-middle', distance: Math.abs(middleRoadX - leftRoadX) });
    edges.push({ from: 'middle-middle', to: 'middle-right', distance: Math.abs(rightRoadX - middleRoadX) });
    
    // Horizontal connections (bottom road)
    edges.push({ from: 'bottom-left', to: 'bottom-middle', distance: Math.abs(middleRoadX - leftRoadX) });
    edges.push({ from: 'bottom-middle', to: 'bottom-right', distance: Math.abs(rightRoadX - middleRoadX) });
    
    // Vertical connections (left road)
    edges.push({ from: 'top-left', to: 'middle-left', distance: Math.abs(middleRoadY - topRoadY) });
    edges.push({ from: 'middle-left', to: 'bottom-left', distance: Math.abs(bottomRoadY - middleRoadY) });
    
    // Vertical connections (middle road)
    edges.push({ from: 'top-middle', to: 'middle-middle', distance: Math.abs(middleRoadY - topRoadY) });
    edges.push({ from: 'middle-middle', to: 'bottom-middle', distance: Math.abs(bottomRoadY - middleRoadY) });
    
    // Vertical connections (right road)
    edges.push({ from: 'top-right', to: 'middle-right', distance: Math.abs(middleRoadY - topRoadY) });
    edges.push({ from: 'middle-right', to: 'bottom-right', distance: Math.abs(bottomRoadY - middleRoadY) });
    
    // Entrance connection (from bottom-middle to entrance)
    edges.push({ from: 'bottom-middle', to: 'entrance', distance: Math.abs(entranceY - bottomRoadY) });
    
    // Build adjacency list for efficient pathfinding
    const graph = {};
    for (let nodeId in nodes) {
        graph[nodeId] = [];
    }
    
    for (let edge of edges) {
        // Add bidirectional edges
        graph[edge.from].push({ to: edge.to, distance: edge.distance });
        graph[edge.to].push({ to: edge.from, distance: edge.distance });
    }
    
    return { nodes, graph };
}

// Find the nearest road node to a given position
function findNearestRoadNode(x, y) {
    if (!roadGraph) {
        roadGraph = initializeRoadGraph();
    }
    
    let nearestNode = null;
    let minDistance = Infinity;
    
    for (let nodeId in roadGraph.nodes) {
        const node = roadGraph.nodes[nodeId];
        const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
        if (distance < minDistance) {
            minDistance = distance;
            nearestNode = node;
        }
    }
    
    return nearestNode;
}

// Find the nearest road node to a parking space (prefer the adjacent horizontal road)
function findNearestRoadNodeToSpace(space) {
    if (!roadGraph) {
        roadGraph = initializeRoadGraph();
    }
    
    const spaceCenterX = space.x + space.width / 2;
    const spaceCenterY = space.y + space.height / 2;
    
    // Determine which horizontal road is adjacent to this space
    const topRoadY = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    
    const leftRoadX = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH + ROAD_WIDTH / 2;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH / 2;
    
    // Find which horizontal road the space is adjacent to
    let targetRoadY = null;
    if (space.row === 0 && space.side === 'top') {
        targetRoadY = topRoadY;
    } else if ((space.row === 0 && space.side === 'bottom') || (space.row === 1 && space.side === 'top')) {
        targetRoadY = middleRoadY;
    } else if (space.row === 1 && space.side === 'bottom') {
        targetRoadY = bottomRoadY;
    }
    
    // Find the nearest intersection on that horizontal road
    let nearestNode = null;
    let minDistance = Infinity;
    
    if (targetRoadY !== null) {
        // Check intersections on the target horizontal road
        const candidates = ['top-left', 'top-middle', 'top-right', 
                           'middle-left', 'middle-middle', 'middle-right',
                           'bottom-left', 'bottom-middle', 'bottom-right'];
        
        for (let nodeId of candidates) {
            const node = roadGraph.nodes[nodeId];
            if (Math.abs(node.y - targetRoadY) < 5) { // On the same horizontal road
                const distance = Math.abs(node.x - spaceCenterX);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestNode = node;
                }
            }
        }
    }
    
    // Fallback: if no node found, use general nearest node
    if (!nearestNode) {
        return findNearestRoadNode(spaceCenterX, spaceCenterY);
    }
    
    return nearestNode;
}

// A* pathfinding algorithm
function findPath(startNode, goalNode) {
    if (!roadGraph) {
        roadGraph = initializeRoadGraph();
    }
    
    if (!startNode || !goalNode || startNode.id === goalNode.id) {
        return []; // Already at goal or invalid nodes
    }
    
    const openSet = [startNode.id];
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    
    // Initialize scores
    for (let nodeId in roadGraph.nodes) {
        gScore[nodeId] = Infinity;
        fScore[nodeId] = Infinity;
    }
    
    gScore[startNode.id] = 0;
    fScore[startNode.id] = heuristic(startNode, goalNode);
    
    while (openSet.length > 0) {
        // Find node in openSet with lowest fScore
        let currentId = openSet[0];
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (fScore[openSet[i]] < fScore[currentId]) {
                currentId = openSet[i];
                currentIndex = i;
            }
        }
        
        // Remove current from openSet
        openSet.splice(currentIndex, 1);
        
        // If we reached the goal, reconstruct path
        if (currentId === goalNode.id) {
            const path = [];
            let current = goalNode.id;
            while (current !== undefined) {
                path.unshift(roadGraph.nodes[current]);
                current = cameFrom[current];
            }
            return path;
        }
        
        // Check all neighbors
        for (let neighbor of roadGraph.graph[currentId]) {
            const neighborId = neighbor.to;
            const tentativeGScore = gScore[currentId] + neighbor.distance;
            
            if (tentativeGScore < gScore[neighborId]) {
                cameFrom[neighborId] = currentId;
                gScore[neighborId] = tentativeGScore;
                fScore[neighborId] = gScore[neighborId] + heuristic(roadGraph.nodes[neighborId], goalNode);
                
                if (!openSet.includes(neighborId)) {
                    openSet.push(neighborId);
                }
            }
        }
    }
    
    return []; // No path found
}

// Heuristic function for A* (Euclidean distance)
function heuristic(nodeA, nodeB) {
    return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
}

// Get direction from one point to another
function getDirectionToPoint(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    if (absDx > absDy) {
        return dx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
    } else {
        return dy > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
    }
}

// ==================== END PATHFINDING SYSTEM ====================

// Helper function to navigate toward entrance using pathfinding
function navigateTowardEntrance(bot, entranceX, entranceY) {
    // Initialize road graph if needed
    if (!roadGraph) {
        roadGraph = initializeRoadGraph();
    }
    
    // Don't change direction if bot was blocked last frame (let collision handler work)
    if (bot.wasBlocked) {
        return; // Skip navigation if blocked - let collision handler resolve it
    }
    
    // If already in entrance area and heading south, continue
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    const ENTRANCE_WIDTH = 100;
    const entranceCenterX = entranceX + ENTRANCE_WIDTH / 2;
    
    const isInEntranceArea = bot.y >= parkingLotBottom && 
                             bot.x >= entranceX && 
                             bot.x <= entranceX + ENTRANCE_WIDTH;
    
    if (isInEntranceArea) {
        // In entrance area, head south to exit
        bot.direction = DIRECTIONS.SOUTH;
        bot.path = null; // Clear path when in entrance
        snapBotToLane(bot); // Snap to correct lane
        return;
    }
    
    // If bot doesn't have a path to entrance yet, calculate it
    if (!bot.path || bot.path.length === 0 || bot.pathTarget !== 'entrance') {
        // Find nearest road node to bot's current position
        const startNode = findNearestRoadNode(bot.x, bot.y);
        
        // Goal is the entrance node
        const goalNode = roadGraph.nodes['entrance'];
        
        if (startNode && goalNode) {
            // Calculate path using A*
            const path = findPath(startNode, goalNode);
            
            if (path.length > 0) {
                bot.path = path;
                bot.pathIndex = 0; // Start at first waypoint
                bot.pathTarget = 'entrance';
            } else {
                // No path found, fall back to direct navigation
                bot.path = null;
                bot.pathIndex = 0;
            }
        } else {
            bot.path = null;
            bot.pathIndex = 0;
        }
    }
    
    // If we have a path, follow it
    if (bot.path && bot.path.length > 0 && bot.pathIndex < bot.path.length) {
        const targetWaypoint = bot.path[bot.pathIndex];
        const dx = targetWaypoint.x - bot.x;
        const dy = targetWaypoint.y - bot.y;
        const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);
        
        // If close enough to current waypoint, move to next one
        if (distanceToWaypoint < 15) {
            bot.pathIndex++;
            
            // If we've reached the last waypoint, we're at the entrance
            if (bot.pathIndex >= bot.path.length) {
                // We're at the entrance, head south to exit
                bot.direction = DIRECTIONS.SOUTH;
                snapBotToLane(bot); // Snap to correct lane
                return;
            }
        }
        
        // Navigate toward current waypoint
        if (bot.pathIndex < bot.path.length) {
            const currentWaypoint = bot.path[bot.pathIndex];
            const waypointDx = currentWaypoint.x - bot.x;
            const waypointDy = currentWaypoint.y - bot.y;
            
            // Choose direction toward waypoint
            const absDx = Math.abs(waypointDx);
            const absDy = Math.abs(waypointDy);
            
            if (absDx > absDy) {
                bot.direction = waypointDx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
            } else {
                bot.direction = waypointDy > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
            }
            // Snap to correct lane for new direction
            snapBotToLane(bot);
        }
    } else {
        // No path available, fall back to direct navigation
        const bottomRoadY = parkingLotBottom - ROAD_WIDTH / 2;
        
        // If not on bottom road yet, head south
        if (bot.y < bottomRoadY - 10) {
            bot.direction = DIRECTIONS.SOUTH;
        } else {
            // On or past bottom road, navigate horizontally to entrance center
            if (Math.abs(bot.x - entranceCenterX) > 15) {
                const desiredDir = bot.x < entranceCenterX ? DIRECTIONS.EAST : DIRECTIONS.WEST;
                bot.direction = desiredDir;
            } else {
                // Aligned with entrance, head south
                bot.direction = DIRECTIONS.SOUTH;
            }
        }
        // Snap to correct lane for new direction
        snapBotToLane(bot);
    }
}

// Helper function to navigate toward a parking space using pathfinding
function navigateTowardParkingSpace(bot, space) {
    // Initialize road graph if needed
    if (!roadGraph) {
        roadGraph = initializeRoadGraph();
    }
    
    // If bot doesn't have a path yet, calculate it
    if (!bot.path || bot.path.length === 0 || bot.pathTargetSpace !== space) {
        // Find nearest road node to bot's current position
        const startNode = findNearestRoadNode(bot.x, bot.y);
        
        // Find nearest road node to the parking space
        const goalNode = findNearestRoadNodeToSpace(space);
        
        if (startNode && goalNode) {
            // Calculate path using A*
            const path = findPath(startNode, goalNode);
            
            if (path.length > 0) {
                bot.path = path;
                bot.pathIndex = 0; // Start at first waypoint
                bot.pathTargetSpace = space;
            } else {
                // No path found, fall back to direct navigation
                bot.path = null;
                bot.pathIndex = 0;
            }
        } else {
            bot.path = null;
            bot.pathIndex = 0;
        }
    }
    
    // If we have a path, follow it
    if (bot.path && bot.path.length > 0 && bot.pathIndex < bot.path.length) {
        const targetWaypoint = bot.path[bot.pathIndex];
        const dx = targetWaypoint.x - bot.x;
        const dy = targetWaypoint.y - bot.y;
        const distanceToWaypoint = Math.sqrt(dx * dx + dy * dy);
        
        // If close enough to current waypoint, move to next one
        if (distanceToWaypoint < 15) {
            bot.pathIndex++;
            
            // If we've reached the last waypoint, we're at the road near the space
            if (bot.pathIndex >= bot.path.length) {
                // We're at the road adjacent to the space, now align to approach it
                const spaceCenterX = space.x + space.width / 2;
                const spaceCenterY = space.y + space.height / 2;
                
                // Determine which horizontal road we're on and align with the space
                const currentRoad = getHorizontalRoad(bot.x, bot.y);
                if (currentRoad) {
                    // We're on the correct horizontal road, align horizontally with the space
                    const spaceRoadX = spaceCenterX;
                    const spaceRoadY = targetWaypoint.y; // Use the road Y from the last waypoint
                    
                    const alignDx = spaceRoadX - bot.x;
                    if (Math.abs(alignDx) > 10) {
                        bot.direction = alignDx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
                        snapBotToLane(bot); // Snap to correct lane
                    }
                }
                return; // Let parking logic handle the final approach
            }
        }
        
        // Navigate toward current waypoint
        if (bot.pathIndex < bot.path.length) {
            const currentWaypoint = bot.path[bot.pathIndex];
            const waypointDx = currentWaypoint.x - bot.x;
            const waypointDy = currentWaypoint.y - bot.y;
            
            // Don't change direction if bot was blocked last frame
            if (bot.wasBlocked) {
                return;
            }
            
            // Choose direction toward waypoint
            const absDx = Math.abs(waypointDx);
            const absDy = Math.abs(waypointDy);
            
            if (absDx > absDy) {
                bot.direction = waypointDx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
            } else {
                bot.direction = waypointDy > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
            }
            // Snap to correct lane for new direction
            snapBotToLane(bot);
        }
    } else {
        // No path available, fall back to direct navigation (shouldn't happen often)
        const spaceCenterX = space.x + space.width / 2;
        const spaceCenterY = space.y + space.height / 2;
        
        const dx = spaceCenterX - bot.x;
        const dy = spaceCenterY - bot.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        if (bot.wasBlocked) {
            return;
        }
        
        if (absDx > absDy) {
            bot.direction = dx > 0 ? DIRECTIONS.EAST : DIRECTIONS.WEST;
        } else {
            bot.direction = dy > 0 ? DIRECTIONS.SOUTH : DIRECTIONS.NORTH;
        }
        // Snap to correct lane for new direction
        snapBotToLane(bot);
    }
}

// Update bot cars
function updateBotCars() {
    const ENTRANCE_WIDTH = 100;
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    const entranceCenterX = entranceX + ENTRANCE_WIDTH / 2;
    const entranceY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    for (let i = botCars.length - 1; i >= 0; i--) {
        const bot = botCars[i];
        if (bot.state === 'parked') continue;
        
        // Check if bot has left the canvas through the entrance (only if exiting)
        // Don't remove bots that are entering (below canvas but heading north)
        if (bot.y > CANVAS_HEIGHT && (bot.state === 'exiting' || bot.exiting)) {
            // Bot has left through the entrance, remove it
            botCars.splice(i, 1);
            continue;
        }
        
        // Check if bot is in entrance area and heading south - allow them to continue exiting
        const isInEntranceArea = (bot.y >= parkingLotBottom || bot.y > CANVAS_HEIGHT) && 
                                 bot.x >= entranceX && 
                                 bot.x <= entranceX + ENTRANCE_WIDTH;
        
        // Smart bot AI based on state
        if (bot.state === 'exiting' || bot.exiting) {
            // Bots that just left parking should navigate toward entrance and exit
            // Only navigate if bot successfully moved last frame, or if stuck for multiple frames
            if (bot.stuckFrames === undefined) bot.stuckFrames = 0;
            
            // Only navigate if not blocked last frame, or if stuck for 10+ frames
            if (!bot.wasBlocked || bot.stuckFrames > 10) {
                navigateTowardEntrance(bot, entranceX, entranceY);
                bot.stuckFrames = 0; // Reset if we navigated
            } else {
                bot.stuckFrames++;
            }
        } else if (bot.state === 'searching') {
            // Actively search for free parking spaces
            let nearestSpace = null;
            let minDistance = Infinity;
            
            for (let space of parkingSpaces) {
                if (space.occupied) continue;
                const distance = Math.sqrt(
                    Math.pow(bot.x - (space.x + space.width / 2), 2) +
                    Math.pow(bot.y - (space.y + space.height / 2), 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestSpace = space;
                }
            }
            
            if (nearestSpace) {
                // Navigate toward the nearest free space
                bot.targetSpace = nearestSpace;
                bot.state = 'parking';
                bot.path = null; // Clear any old path
                bot.pathIndex = 0;
                bot.pathTargetSpace = null;
                navigateTowardParkingSpace(bot, nearestSpace);
            } else {
                // No free spaces, use systematic road following instead of random movement
                // Only change direction if not blocked and cooldown has passed
                if (bot.lastDirectionChange === undefined) bot.lastDirectionChange = 0;
                const timeSinceLastChange = Date.now() - bot.lastDirectionChange;
                
                // Only change direction if not blocked and it's been at least 1000ms since last change
                // This prevents rapid spinning when searching
                if (!bot.wasBlocked && timeSinceLastChange > 1000) {
                    // Follow roads systematically - prefer continuing in current direction
                    // Only change if we're at an intersection or stuck
                    if (isAtIntersection(bot.x, bot.y)) {
                        // At intersection, can choose a new direction
                        const alternatives = [];
                        for (let dir = 0; dir < 4; dir++) {
                            if (dir !== bot.direction && !isOppositeDirection(bot.direction, dir)) {
                                alternatives.push(dir);
                            }
                        }
                        if (alternatives.length > 0) {
                            bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                            bot.lastDirectionChange = Date.now();
                            // Don't snap at intersection - allow smooth turning, lane will snap after leaving intersection
                        }
                    }
                    // Otherwise, continue in current direction
                }
            }
        } else if (bot.state === 'parking' && bot.targetSpace) {
            // Actively navigate toward target parking space
            // Allow bots to navigate to occupied spaces if they have a path (they're assigned to spaces that will be vacated)
            // Only switch to searching if the space is occupied AND we don't have a valid path (meaning we lost our assignment)
            if (bot.targetSpace.occupied && (!bot.path || bot.path.length === 0)) {
                // Space was taken and we don't have a path, go back to searching
                bot.state = 'searching';
                bot.targetSpace = null;
                bot.path = null; // Clear path since target changed
                bot.pathIndex = 0;
                bot.pathTargetSpace = null;
            } else {
                // Only navigate if bot successfully moved last frame, or if stuck for multiple frames
                // Initialize stuck counter if not exists
                if (bot.stuckFrames === undefined) bot.stuckFrames = 0;
                
                // Only navigate if not blocked last frame, or if stuck for 10+ frames
                if (!bot.wasBlocked || bot.stuckFrames > 10) {
                    navigateTowardParkingSpace(bot, bot.targetSpace);
                    bot.stuckFrames = 0; // Reset if we navigated
                } else {
                    bot.stuckFrames++;
                }
            }
        }
        
        // Move bot (only if staying on road)
        let newBotX = bot.x;
        let newBotY = bot.y;
        
        switch (bot.direction) {
            case DIRECTIONS.NORTH:
                newBotY = bot.y - bot.speed;
                // Allow bots entering from below canvas to move up
                if (newBotY < 0 && bot.y >= CANVAS_HEIGHT) {
                    // Bot is entering from below, allow it to continue north
                } else if (newBotY < 0) {
                    newBotY = CANVAS_HEIGHT;
                }
                break;
            case DIRECTIONS.EAST:
                newBotX = bot.x + bot.speed;
                if (newBotX > CANVAS_WIDTH) newBotX = 0;
                break;
            case DIRECTIONS.SOUTH:
                newBotY = bot.y + bot.speed;
                // Allow movement beyond canvas height if in entrance area (they're leaving)
                if (newBotY > CANVAS_HEIGHT && !isInEntranceArea) {
                    newBotY = 0;
                }
                break;
            case DIRECTIONS.WEST:
                newBotX = bot.x - bot.speed;
                if (newBotX < 0) newBotX = CANVAS_WIDTH;
                break;
        }
        
        // Allow movement through entrance area even if it goes beyond normal boundary
        const isMovingThroughEntrance = bot.direction === DIRECTIONS.SOUTH && 
                                        isInEntranceArea && 
                                        newBotY > CANVAS_HEIGHT;
        
        // Allow bots entering from below canvas to move into the entrance area
        const isEnteringFromBelow = bot.y >= CANVAS_HEIGHT && 
                                     bot.direction === DIRECTIONS.NORTH &&
                                     bot.x >= entranceX && 
                                     bot.x <= entranceX + ENTRANCE_WIDTH;
        
        // Only move if the new position is on a road and doesn't collide with parking spaces, walls, or other cars
        // OR if they're exiting through the entrance OR entering from below
        const isOnRoadCheck = isOnRoad(newBotX, newBotY) || isEnteringFromBelow;
        const isWithinBoundaryCheck = isWithinBoundary(newBotX, newBotY) || isEnteringFromBelow;
        if (isMovingThroughEntrance || isEnteringFromBelow || (isOnRoadCheck && isWithinBoundaryCheck)) {
            // Check if the entire car body would collide with parking spaces, walls, or other cars
            // Skip collision check if exiting through entrance or entering from below
            
            // Special case: Allow bots to move into their target parking space if close enough
            let allowMoveIntoTargetSpace = false;
            if (bot.state === 'parking' && bot.targetSpace && !bot.targetSpace.occupied) {
                const spaceCenterX = bot.targetSpace.x + bot.targetSpace.width / 2;
                const spaceCenterY = bot.targetSpace.y + bot.targetSpace.height / 2;
                const currentDistance = Math.sqrt(
                    Math.pow(bot.x - spaceCenterX, 2) +
                    Math.pow(bot.y - spaceCenterY, 2)
                );
                // If close to target space (within 120px), allow moving into it
                if (currentDistance < 120) {
                    // Check if the new position would be in the target space OR closer to it
                    const carBox = getCarBoundingBox(newBotX, newBotY, bot.direction);
                    const spaceBox = {
                        x: bot.targetSpace.x,
                        y: bot.targetSpace.y,
                        width: bot.targetSpace.width,
                        height: bot.targetSpace.height
                    };
                    const newDistance = Math.sqrt(
                        Math.pow(newBotX - spaceCenterX, 2) +
                        Math.pow(newBotY - spaceCenterY, 2)
                    );
                    // Allow if: moving into the space OR moving closer to it
                    if (rectanglesOverlap(carBox, spaceBox) || newDistance < currentDistance) {
                        allowMoveIntoTargetSpace = true;
                    }
                }
            }
            
            // Exclude spaces from collision check:
            // - Target space for parking bots
            // - Space just left for exiting bots (and nearby spaces to prevent getting stuck)
            let excludeSpace = null;
            let excludeNearPosition = null;
            let excludeRadius = 0;
            if (bot.state === 'parking' && bot.targetSpace && !bot.targetSpace.occupied) {
                excludeSpace = bot.targetSpace;
            } else if ((bot.state === 'exiting' || bot.exiting) && bot.justLeftSpace) {
                excludeSpace = bot.justLeftSpace;
                // Also exclude spaces near the bot's current position to prevent getting stuck in tight spaces
                // But only for a limited time after leaving the space (2 seconds)
                if (!bot.leftSpaceTime) {
                    bot.leftSpaceTime = Date.now();
                }
                const timeSinceLeftSpace = Date.now() - bot.leftSpaceTime;
                if (timeSinceLeftSpace < 2000) {
                    excludeNearPosition = { x: bot.x, y: bot.y };
                    excludeRadius = 100; // Exclude spaces within 100px of bot's current position
                }
            }
            const collidesParking = !isMovingThroughEntrance && !isEnteringFromBelow && !allowMoveIntoTargetSpace && carCollidesWithParkingSpace(newBotX, newBotY, bot.direction, excludeSpace, excludeNearPosition, excludeRadius);
            const collidesWall = !isMovingThroughEntrance && !isEnteringFromBelow && carCollidesWithWall(newBotX, newBotY, bot.direction);
            // Bots don't check collisions with other bots or player car - they can pass through everything except walls and parking spaces
            if (isMovingThroughEntrance || isEnteringFromBelow || allowMoveIntoTargetSpace || (!collidesParking && !collidesWall)) {
                bot.x = newBotX;
                bot.y = newBotY;
                bot.wasBlocked = false; // Successfully moved
                
                // Snap bot to correct lane position (right side of road)
                snapBotToLane(bot);
            } else {
                bot.wasBlocked = true; // Mark as blocked
                
                // Special handling: If parking bot is blocked by its target space and close to it, don't change direction
                if (bot.state === 'parking' && bot.targetSpace && collidesParking) {
                    const spaceCenterX = bot.targetSpace.x + bot.targetSpace.width / 2;
                    const spaceCenterY = bot.targetSpace.y + bot.targetSpace.height / 2;
                    const distance = Math.sqrt(
                        Math.pow(bot.x - spaceCenterX, 2) +
                        Math.pow(bot.y - spaceCenterY, 2)
                    );
                    // If very close to target space (within 80px), maintain direction - parking check will handle it
                    if (distance < 80) {
                        // Skip direction change - we're close enough that parking might work
                        continue; // Continue to next bot in loop
                    }
                }
                
                // If blocked by collision, try alternative directions
                const oldDir = bot.direction;
                
                // Don't change direction every frame - use a cooldown to prevent spinning
                if (bot.lastDirectionChange === undefined) bot.lastDirectionChange = 0;
                const timeSinceLastChange = Date.now() - bot.lastDirectionChange;
                
                // Only change direction if it's been at least 300ms since last change (increased to prevent rapid spinning)
                if (timeSinceLastChange > 300) {
                    // For exiting bots, try to continue toward exit
                    if (bot.state === 'exiting' || bot.exiting) {
                        // Try alternative directions that might help reach exit, but exclude current failed direction
                        const alternatives = [];
                        for (let dir = 0; dir < 4; dir++) {
                            if (dir !== bot.direction) {
                                alternatives.push(dir);
                            }
                        }
                        // Prioritize SOUTH (toward exit) if it's not the failed direction
                        if (bot.direction !== DIRECTIONS.SOUTH && alternatives.includes(DIRECTIONS.SOUTH)) {
                            // Move SOUTH to front of array for higher chance
                            alternatives.splice(alternatives.indexOf(DIRECTIONS.SOUTH), 1);
                            alternatives.unshift(DIRECTIONS.SOUTH);
                        }
                        if (alternatives.length > 0) {
                            bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                        }
                    } else if (bot.state === 'parking' && bot.targetSpace) {
                    // For parking bots, try directions that might help reach the space
                    // But avoid the direction that just failed
                    const spaceCenterX = bot.targetSpace.x + bot.targetSpace.width / 2;
                    const spaceCenterY = bot.targetSpace.y + bot.targetSpace.height / 2;
                    const dx = spaceCenterX - bot.x;
                    const dy = spaceCenterY - bot.y;
                    // Try directions that are closer to the target, but avoid current failed direction
                    const alternatives = [];
                    if (Math.abs(dx) > Math.abs(dy)) {
                        // Prefer horizontal movement
                        if (dx > 0 && bot.direction !== DIRECTIONS.EAST) alternatives.push(DIRECTIONS.EAST);
                        if (dx < 0 && bot.direction !== DIRECTIONS.WEST) alternatives.push(DIRECTIONS.WEST);
                        if (dy > 0 && bot.direction !== DIRECTIONS.SOUTH) alternatives.push(DIRECTIONS.SOUTH);
                        if (dy < 0 && bot.direction !== DIRECTIONS.NORTH) alternatives.push(DIRECTIONS.NORTH);
                    } else {
                        // Prefer vertical movement
                        if (dy > 0 && bot.direction !== DIRECTIONS.SOUTH) alternatives.push(DIRECTIONS.SOUTH);
                        if (dy < 0 && bot.direction !== DIRECTIONS.NORTH) alternatives.push(DIRECTIONS.NORTH);
                        if (dx > 0 && bot.direction !== DIRECTIONS.EAST) alternatives.push(DIRECTIONS.EAST);
                        if (dx < 0 && bot.direction !== DIRECTIONS.WEST) alternatives.push(DIRECTIONS.WEST);
                    }
                    // If no alternatives, try any direction except current
                    if (alternatives.length === 0) {
                        for (let dir = 0; dir < 4; dir++) {
                            if (dir !== bot.direction) alternatives.push(dir);
                        }
                    }
                    if (alternatives.length > 0) {
                        bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                    }
                    } else {
                        // For searching bots, try to continue forward or turn at intersections
                        // Avoid U-turns and prefer directions that keep us on roads
                        const alternatives = [];
                        for (let dir = 0; dir < 4; dir++) {
                            if (dir !== bot.direction && !isOppositeDirection(bot.direction, dir)) {
                                alternatives.push(dir);
                            }
                        }
                        if (alternatives.length > 0) {
                            bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                            // Don't snap at intersection - allow smooth turning
                        }
                    }
                    bot.lastDirectionChange = Date.now();
                }
            }
        } else {
            // If blocked (not on road), try to get back on road
            bot.wasBlocked = true; // Mark as blocked
            
            // Don't change direction every frame - use a cooldown to prevent spinning
            if (bot.lastDirectionChange === undefined) bot.lastDirectionChange = 0;
            const timeSinceLastChange = Date.now() - bot.lastDirectionChange;
            
            // Only change direction if it's been at least 300ms since last change (increased to prevent rapid spinning)
            if (timeSinceLastChange > 300) {
                const oldDir = bot.direction;
                // For exiting bots, prioritize south
                if (bot.state === 'exiting' || bot.exiting) {
                    const alternatives = [];
                    for (let dir = 0; dir < 4; dir++) {
                        if (dir !== bot.direction) {
                            alternatives.push(dir);
                        }
                    }
                    // Prioritize SOUTH (toward exit) if it's not the failed direction
                    if (bot.direction !== DIRECTIONS.SOUTH && alternatives.includes(DIRECTIONS.SOUTH)) {
                        alternatives.splice(alternatives.indexOf(DIRECTIONS.SOUTH), 1);
                        alternatives.unshift(DIRECTIONS.SOUTH);
                    }
                    if (alternatives.length > 0) {
                        bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                    }
                } else {
                    // For other bots (including searching), pick any direction except current
                    // Avoid U-turns for better navigation
                    const alternatives = [];
                    for (let dir = 0; dir < 4; dir++) {
                        if (dir !== bot.direction && !isOppositeDirection(bot.direction, dir)) {
                            alternatives.push(dir);
                        }
                    }
                    // If no non-opposite alternatives, allow any direction except current
                    if (alternatives.length === 0) {
                        for (let dir = 0; dir < 4; dir++) {
                            if (dir !== bot.direction) {
                                alternatives.push(dir);
                            }
                        }
                    }
                    if (alternatives.length > 0) {
                        bot.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
                        // Don't snap at intersection or when off-road - allow movement first
                    }
                }
                bot.lastDirectionChange = Date.now();
            }
        }
        
        // Check if bot can park
        if (bot.targetSpace && !bot.targetSpace.occupied) {
            // Bot must be on a horizontal road to park
            if (!isOnHorizontalRoad(bot.x, bot.y)) {
                continue; // Skip parking check if not on horizontal road
            }
            
            // Determine which horizontal road the bot is on
            const currentRoad = getHorizontalRoad(bot.x, bot.y);
            if (!currentRoad) {
                continue; // Skip if not on a valid horizontal road
            }
            
            // Space must be adjacent to the current horizontal road
            if (!isSpaceAdjacentToHorizontalRoad(bot.targetSpace, currentRoad)) {
                continue; // Space is not adjacent to current road
            }
            
            // Car's body must horizontally overlap with the parking space
            if (!carHorizontallyOverlapsSpace(bot.x, bot.y, bot.direction, bot.targetSpace)) {
                continue; // No horizontal overlap
            }
            
            // If all conditions met, bot can park
            bot.state = 'parked';
            bot.targetSpace.occupied = true;
            bot.targetSpace.hasCar = true;
            // Clear path since bot is now parked
            bot.path = null;
            bot.pathIndex = 0;
            bot.pathTargetSpace = null;
            // Position car at the center of the parking space
            const spaceCenterX = bot.targetSpace.x + bot.targetSpace.width / 2;
            const spaceCenterY = bot.targetSpace.y + bot.targetSpace.height / 2;
            bot.x = spaceCenterX;
            bot.y = spaceCenterY;
            // Set direction based on which side of the square the space is on
            if (bot.targetSpace.side === 'top') {
                bot.direction = DIRECTIONS.NORTH;
            } else if (bot.targetSpace.side === 'bottom') {
                bot.direction = DIRECTIONS.SOUTH;
            } else if (bot.targetSpace.side === 'left') {
                bot.direction = DIRECTIONS.EAST;
            } else if (bot.targetSpace.side === 'right') {
                bot.direction = DIRECTIONS.WEST;
            }
        }
    }
}

// Find nearest road position to a parking space
function findNearestRoadPosition(space) {
    const spaceCenterX = space.x + space.width / 2;
    const spaceCenterY = space.y + space.height / 2;
    
    const topRoadY = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH / 2;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    const leftRoadX = WALL_SPACE + ROAD_WIDTH / 2;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH + ROAD_WIDTH / 2;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH / 2;
    
    // Calculate distances to all roads
    const roads = [
        // Horizontal roads
        { x: spaceCenterX, y: topRoadY, direction: DIRECTIONS.EAST },
        { x: spaceCenterX, y: middleRoadY, direction: DIRECTIONS.EAST },
        { x: spaceCenterX, y: bottomRoadY, direction: DIRECTIONS.EAST },
        // Vertical roads
        { x: leftRoadX, y: spaceCenterY, direction: DIRECTIONS.SOUTH },
        { x: middleRoadX, y: spaceCenterY, direction: DIRECTIONS.SOUTH },
        { x: rightRoadX, y: spaceCenterY, direction: DIRECTIONS.SOUTH },
    ];
    
    // Find nearest road
    let nearestRoad = null;
    let minDistance = Infinity;
    
    for (let road of roads) {
        const distance = Math.sqrt(
            Math.pow(spaceCenterX - road.x, 2) + 
            Math.pow(spaceCenterY - road.y, 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            nearestRoad = road;
        }
    }
    
    return nearestRoad;
}

// Count free parking spaces
function countFreeSpaces() {
    let freeCount = 0;
    for (let space of parkingSpaces) {
        if (!space.occupied) {
            freeCount++;
        }
    }
    return freeCount;
}

// Update parked cars (some leave)
function updateParkedCars(deltaTime) {
    // Wait 3 seconds after game start before allowing cars to leave
    if (gameStartTime === null) {
        gameStartTime = Date.now();
    }
    const elapsedTime = Date.now() - gameStartTime;
    if (elapsedTime < 5000) {
        // If we haven't selected the first spot to vacate yet, do it now (1 second before bot enters)
        // This ensures the bot knows its target when it spawns at T=4
        if (nextSpotToVacate === null && elapsedTime >= 3000) {
            // Find all parked cars and select one to leave
            const allParkedCars = [];
            
            // Add initial parked cars
            for (let parkedCar of parkedCars) {
                if (parkedCar.space && parkedCar.space.occupied) {
                    allParkedCars.push({
                        type: 'initial',
                        space: parkedCar.space,
                        car: parkedCar
                    });
                }
            }
            
            // Add parked bots
            for (let bot of botCars) {
                if (bot.state === 'parked' && bot.targetSpace && bot.targetSpace.occupied) {
                    allParkedCars.push({
                        type: 'bot',
                        space: bot.targetSpace,
                        bot: bot
                    });
                }
            }
            
            // Select a random parked car to leave and set its spot as next to vacate
            if (allParkedCars.length > 0) {
                const selectedCar = allParkedCars[Math.floor(Math.random() * allParkedCars.length)];
                nextSpotToVacate = selectedCar.space;
            }
        }
        return; // Don't allow cars to leave yet
    }
    
    // Always have one parked car leave every 3 seconds
    // Check if enough time has passed since last parked car left (3 second interval)
    if (lastParkedCarLeaveTime === null) {
        lastParkedCarLeaveTime = Date.now();
    } else {
        const timeSinceLastLeave = Date.now() - lastParkedCarLeaveTime;
        if (timeSinceLastLeave < PARKED_CAR_LEAVE_INTERVAL) {
            return; // Not enough time has passed, wait
        }
    }
    
    // Find all parked cars (both in parkedCars array and parked bots)
    const allParkedCars = [];
    
    // Add initial parked cars
    for (let parkedCar of parkedCars) {
        if (parkedCar.space && parkedCar.space.occupied) {
            allParkedCars.push({
                type: 'initial',
                space: parkedCar.space,
                car: parkedCar
            });
        }
    }
    
    // Add parked bots
    for (let bot of botCars) {
        if (bot.state === 'parked' && bot.targetSpace && bot.targetSpace.occupied) {
            allParkedCars.push({
                type: 'bot',
                space: bot.targetSpace,
                bot: bot
            });
        }
    }
    
    // If no parked cars, return
    if (allParkedCars.length === 0) {
        return;
    }
    
    // Use the pre-selected spot if available, otherwise select a random one
    let selectedCar = null;
    if (nextSpotToVacate) {
        // Find the car parked in the pre-selected spot
        for (let parkedCar of allParkedCars) {
            if (parkedCar.space === nextSpotToVacate) {
                selectedCar = parkedCar;
                break;
            }
        }
    }
    
    // If we couldn't find the pre-selected car (maybe it already left), select a random one
    if (!selectedCar) {
        selectedCar = allParkedCars[Math.floor(Math.random() * allParkedCars.length)];
    }
    
    // Select the next spot to vacate (for the bot that will enter in 1 second)
    // Choose a random parked car that's not the one currently leaving
    const remainingCars = allParkedCars.filter(car => car !== selectedCar);
    if (remainingCars.length > 0) {
        const nextCarToLeave = remainingCars[Math.floor(Math.random() * remainingCars.length)];
        nextSpotToVacate = nextCarToLeave.space;
    } else {
        nextSpotToVacate = null; // No more cars to leave
    }
    
    // Find nearest road to the parking space
    const nearestRoad = findNearestRoadPosition(selectedCar.space);
    
    if (nearestRoad) {
        // Verify the spawn position is actually on a road
        // If not, try to find a valid road position nearby
        let spawnX = nearestRoad.x;
        let spawnY = nearestRoad.y;
        
        if (!isOnRoad(spawnX, spawnY)) {
            // Try to find a nearby valid road position
            const offsets = [
                {dx: 0, dy: 0},
                {dx: 10, dy: 0}, {dx: -10, dy: 0},
                {dx: 0, dy: 10}, {dx: 0, dy: -10},
                {dx: 20, dy: 0}, {dx: -20, dy: 0},
                {dx: 0, dy: 20}, {dx: 0, dy: -20}
            ];
            
            let foundValid = false;
            for (let offset of offsets) {
                const testX = nearestRoad.x + offset.dx;
                const testY = nearestRoad.y + offset.dy;
                if (isOnRoad(testX, testY) && isWithinBoundary(testX, testY)) {
                    spawnX = testX;
                    spawnY = testY;
                    foundValid = true;
                    break;
                }
            }
            
            // If still not valid, use the road center anyway (it should be valid)
            if (!foundValid) {
                spawnX = nearestRoad.x;
                spawnY = nearestRoad.y;
            }
        }
        
        // Create a new bot car at the nearest road position
        // This car just left a parking space, so it should exit
        const newBotCar = {
            x: spawnX,
            y: spawnY,
            direction: nearestRoad.direction,
            speed: 1.5,
            targetSpace: null,
            state: 'exiting', // Cars that just left should exit
            exiting: true, // Flag to mark this car as exiting
            justLeftSpace: selectedCar.space // Track the space it just left to exclude from collisions
        };
        
        // Snap to correct lane for initial direction
        snapBotToLane(newBotCar);
        
        // Add to bot cars array
        botCars.push(newBotCar);
        
        // Free up the parking space
        selectedCar.space.occupied = false;
        selectedCar.space.hasCar = false;
        
        // Remove from appropriate array
        if (selectedCar.type === 'initial') {
            // Remove from parkedCars array
            const index = parkedCars.indexOf(selectedCar.car);
            if (index !== -1) {
                parkedCars.splice(index, 1);
            }
        } else if (selectedCar.type === 'bot') {
            // Remove bot from botCars array
            const index = botCars.indexOf(selectedCar.bot);
            if (index !== -1) {
                botCars.splice(index, 1);
            }
        }
        
        // Update last leave time
        lastParkedCarLeaveTime = Date.now();
    }
}

// Draw parking lot
function drawParkingLot() {
    // Constants for walls and entrance
    const WALL_WIDTH = 8;
    const WALL_COLOR = '#8B4513'; // Brown color for walls
    const ENTRANCE_WIDTH = 100; // Width of the entrance at the bottom
    const entranceX = (CANVAS_WIDTH - ENTRANCE_WIDTH) / 2;
    
    // Step 1: Draw dark gray background only for the exact parking square areas
    ctx.fillStyle = '#333333';
    for (let row = 0; row < PARKING_ROWS; row++) {
        for (let col = 0; col < PARKING_COLS; col++) {
            const squareX = WALL_SPACE + ROAD_WIDTH + col * (SQUARE_WIDTH + ROAD_WIDTH);
            const squareY = WALL_SPACE + ROAD_WIDTH + row * (SQUARE_HEIGHT + ROAD_WIDTH);
            // Draw background exactly matching the parking space area
            ctx.fillRect(squareX, squareY, SQUARE_WIDTH, SQUARE_HEIGHT);
        }
    }
    
    // Step 2: Draw parking spaces on top of background (all spaces are light blue)
    for (let space of parkingSpaces) {
        // All spaces are light blue, regardless of occupancy
        ctx.fillStyle = '#4ECDC4';
        ctx.fillRect(space.x, space.y, space.width, space.height);
        
        // Draw space outline
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(space.x, space.y, space.width, space.height);
    }
    
    // Step 3: Draw walls around the parking lot boundaries
    // Calculate the parking lot area (inside the boundary roads)
    const parkingLotTop = WALL_SPACE;
    const parkingLotLeft = WALL_SPACE;
    const parkingLotRight = CANVAS_WIDTH - WALL_SPACE;
    const parkingLotBottom = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH;
    
    // Top wall (outside top boundary road)
    ctx.fillStyle = WALL_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, WALL_SPACE);
    
    // Left wall (outside left boundary road)
    ctx.fillRect(0, 0, WALL_SPACE, CANVAS_HEIGHT);
    
    // Right wall (outside right boundary road)
    ctx.fillRect(CANVAS_WIDTH - WALL_SPACE, 0, WALL_SPACE, CANVAS_HEIGHT);
    
    // Bottom wall (outside bottom boundary road, with entrance in the middle)
    // Left side of bottom wall
    ctx.fillRect(0, parkingLotBottom, entranceX, WALL_SPACE);
    // Right side of bottom wall
    ctx.fillRect(entranceX + ENTRANCE_WIDTH, parkingLotBottom, 
                 CANVAS_WIDTH - (entranceX + ENTRANCE_WIDTH), WALL_SPACE);
    
    // Step 4: Draw parking lot boundary (around the parking lot area, not including entrance)
    const BOUNDARY_WIDTH = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = BOUNDARY_WIDTH;
    // Draw boundary around the parking lot (excluding entrance area at bottom)
    ctx.strokeRect(BOUNDARY_WIDTH / 2, BOUNDARY_WIDTH / 2, 
                   CANVAS_WIDTH - BOUNDARY_WIDTH, parkingLotBottom - BOUNDARY_WIDTH);
    
    // Step 5: Draw roads (gray) on top of parking spaces
    ctx.fillStyle = '#555555';
    
    // Calculate road positions accounting for wall space
    const topRoadY = WALL_SPACE;
    const middleRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT;
    const bottomRoadY = WALL_SPACE + ROAD_WIDTH + SQUARE_HEIGHT + ROAD_WIDTH + SQUARE_HEIGHT;
    
    const leftRoadX = WALL_SPACE;
    const middleRoadX = WALL_SPACE + ROAD_WIDTH + SQUARE_WIDTH;
    const rightRoadX = CANVAS_WIDTH - WALL_SPACE - ROAD_WIDTH;
    
    // Horizontal roads (3 roads: top edge, middle, bottom edge)
    // Top road
    ctx.fillRect(WALL_SPACE, topRoadY, CANVAS_WIDTH - 2 * WALL_SPACE, ROAD_WIDTH);
    // Middle road
    ctx.fillRect(WALL_SPACE, middleRoadY, CANVAS_WIDTH - 2 * WALL_SPACE, ROAD_WIDTH);
    // Bottom road (full width, no gap needed - entrance is below)
    ctx.fillRect(WALL_SPACE, bottomRoadY, CANVAS_WIDTH - 2 * WALL_SPACE, ROAD_WIDTH);
    
    // Draw entrance area as road (below bottom road, in the entrance gap)
    ctx.fillRect(entranceX, parkingLotBottom, ENTRANCE_WIDTH, ENTRANCE_AREA_HEIGHT);
    
    // Vertical roads (3 roads: left edge, middle, right edge)
    // Left road
    ctx.fillRect(leftRoadX, WALL_SPACE, ROAD_WIDTH, parkingLotBottom - WALL_SPACE);
    // Middle road
    ctx.fillRect(middleRoadX, WALL_SPACE, ROAD_WIDTH, parkingLotBottom - WALL_SPACE);
    // Right road
    ctx.fillRect(rightRoadX, WALL_SPACE, ROAD_WIDTH, parkingLotBottom - WALL_SPACE);
    
    // Step 6: Draw road markings (yellow lines) on top of roads
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    // Horizontal road markings
    ctx.beginPath();
    ctx.moveTo(WALL_SPACE, topRoadY + ROAD_WIDTH / 2);
    ctx.lineTo(CANVAS_WIDTH - WALL_SPACE, topRoadY + ROAD_WIDTH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WALL_SPACE, middleRoadY + ROAD_WIDTH / 2);
    ctx.lineTo(CANVAS_WIDTH - WALL_SPACE, middleRoadY + ROAD_WIDTH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WALL_SPACE, bottomRoadY + ROAD_WIDTH / 2);
    ctx.lineTo(CANVAS_WIDTH - WALL_SPACE, bottomRoadY + ROAD_WIDTH / 2);
    ctx.stroke();
    // Vertical road markings
    ctx.beginPath();
    ctx.moveTo(leftRoadX + ROAD_WIDTH / 2, WALL_SPACE);
    ctx.lineTo(leftRoadX + ROAD_WIDTH / 2, parkingLotBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(middleRoadX + ROAD_WIDTH / 2, WALL_SPACE);
    ctx.lineTo(middleRoadX + ROAD_WIDTH / 2, parkingLotBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightRoadX + ROAD_WIDTH / 2, WALL_SPACE);
    ctx.lineTo(rightRoadX + ROAD_WIDTH / 2, parkingLotBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Step 7: Draw entrance markers and text (on top of entrance road)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    // Left entrance marker
    ctx.beginPath();
    ctx.moveTo(entranceX, parkingLotBottom);
    ctx.lineTo(entranceX, CANVAS_HEIGHT);
    ctx.stroke();
    // Right entrance marker
    ctx.beginPath();
    ctx.moveTo(entranceX + ENTRANCE_WIDTH, parkingLotBottom);
    ctx.lineTo(entranceX + ENTRANCE_WIDTH, CANVAS_HEIGHT);
    ctx.stroke();
    
    // Draw "ENTRANCE" text in the entrance area (on top of road)
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRANCE', CANVAS_WIDTH / 2, parkingLotBottom + ENTRANCE_AREA_HEIGHT / 2 + 6);
}

// Draw car
function drawCar(x, y, direction, color, isPlayer = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((direction * Math.PI) / 2);
    
    // Car body
    ctx.fillStyle = color;
    ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
    
    // Car windows
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-CAR_WIDTH / 2 + 5, -CAR_HEIGHT / 2 + 5, CAR_WIDTH - 10, 15);
    ctx.fillRect(-CAR_WIDTH / 2 + 5, CAR_HEIGHT / 2 - 20, CAR_WIDTH - 10, 15);
    
    // Car outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
    
    if (isPlayer) {
        // Draw direction indicator
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -CAR_HEIGHT / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

// Draw all game elements
function draw() {
    drawParkingLot();
    
    // Draw orange bot cars on all occupied parking spaces
    for (let space of parkingSpaces) {
        if (space.occupied) {
            // Determine direction based on which side of the square the space is on
            let direction = DIRECTIONS.NORTH;
            if (space.side === 'top') {
                direction = DIRECTIONS.NORTH;
            } else if (space.side === 'bottom') {
                direction = DIRECTIONS.SOUTH;
            } else if (space.side === 'left') {
                direction = DIRECTIONS.EAST;
            } else if (space.side === 'right') {
                direction = DIRECTIONS.WEST;
            }
            // Draw orange bot car in the center of the parking space
            drawCar(space.x + space.width / 2, space.y + space.height / 2, direction, '#FFA500');
        }
    }
    
    // Draw moving bot cars (those not parked)
    for (let bot of botCars) {
        if (bot.state !== 'parked') {
            // Draw moving bot car
            drawCar(bot.x, bot.y, bot.direction, '#FFA500');
        }
    }
    
    // Draw player car
    if (!playerCar.parked) {
        drawCar(playerCar.x, playerCar.y, playerCar.direction, '#00FF00', true);
    } else {
        // Draw parked player car
        drawCar(playerCar.x, playerCar.y, playerCar.direction, '#00FF00');
    }
}

// Game loop
let lastTime = 0;
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    updatePlayerCar();
    updateBotCars();
    updateParkedCars(deltaTime);
    checkAndSpawnBots(); // Check if we should spawn new bots
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener('keydown', (e) => {
    // Prevent default behavior for arrow keys and game keys to avoid page scrolling
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 'p', 'P'];
    if (gameKeys.includes(e.key)) {
        e.preventDefault();
    }
    
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') {
        parkPlayer();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('parkButton').addEventListener('click', parkPlayer);
document.getElementById('restartButton').addEventListener('click', restartGame);

// Initialize and start game
gameStartTime = Date.now(); // Set game start time
lastBotSpawnTime = null; // Initialize spawn timer
initializeParkingLot();
initializeBotCars();
// Initialize road graph for pathfinding
roadGraph = initializeRoadGraph();

// Add click handler to focus canvas
canvas.addEventListener('click', () => {
    canvas.focus();
});

// Auto-focus canvas on page load
window.addEventListener('load', () => {
    canvas.focus();
});

gameLoop(0);
