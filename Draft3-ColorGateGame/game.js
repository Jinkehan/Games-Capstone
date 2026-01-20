// Game Constants
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const COLORS = {
    BLUE: '#4A90E2',
    RED: '#E74C3C',
    GREEN: '#2ECC71',
    GRAY: '#95A5A6'
};

const GRAVITY = 0.6;
const JUMP_STRENGTH = -12;
const MOVE_SPEED = 5;
const PLAYER_SIZE = 30;
const GATE_WIDTH = 20;
const GATE_HEIGHT = 100;
const GOAL_SIZE = 40;

// Player Class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.velocityX = 0;
        this.velocityY = 0;
        this.color = 'blue'; // 'blue' or 'red'
        this.isJumping = false;
        this.onGround = false;
    }

    switchColor() {
        this.color = this.color === 'blue' ? 'red' : 'blue';
    }

    getColorValue() {
        return this.color === 'blue' ? COLORS.BLUE : COLORS.RED;
    }

    update() {
        // Apply gravity
        this.velocityY += GRAVITY;
        
        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Ground collision
        const groundLevel = canvas.height - 50 - this.height;
        if (this.y >= groundLevel) {
            this.y = groundLevel;
            this.velocityY = 0;
            this.isJumping = false;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // Canvas boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        }

        // Reset horizontal velocity (no friction sliding)
        this.velocityX = 0;
    }

    jump() {
        if (this.onGround && !this.isJumping) {
            this.velocityY = JUMP_STRENGTH;
            this.isJumping = true;
        }
    }

    moveLeft() {
        this.velocityX = -MOVE_SPEED;
    }

    moveRight() {
        this.velocityX = MOVE_SPEED;
    }

    draw() {
        ctx.fillStyle = this.getColorValue();
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add a border for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    getBounds() {
        return {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height
        };
    }
}

// Gate Class
class Gate {
    constructor(x, color) {
        this.x = x;
        this.y = canvas.height - 50 - GATE_HEIGHT;
        this.width = GATE_WIDTH;
        this.height = GATE_HEIGHT;
        this.color = color; // 'blue' or 'red'
    }

    getColorValue() {
        return this.color === 'blue' ? COLORS.BLUE : COLORS.RED;
    }

    draw() {
        ctx.fillStyle = this.getColorValue();
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    getBounds() {
        return {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height
        };
    }

    checkCollision(player) {
        const pBounds = player.getBounds();
        const gBounds = this.getBounds();

        // Check if player overlaps with gate
        return !(pBounds.right < gBounds.left || 
                 pBounds.left > gBounds.right || 
                 pBounds.bottom < gBounds.top || 
                 pBounds.top > gBounds.bottom);
    }

    blocksPlayer(player) {
        // Gate blocks player if colors don't match
        return this.checkCollision(player) && player.color !== this.color;
    }
}

// Goal Class
class Goal {
    constructor(x) {
        this.x = x;
        this.y = canvas.height - 50 - GOAL_SIZE;
        this.width = GOAL_SIZE;
        this.height = GOAL_SIZE;
    }

    draw() {
        ctx.fillStyle = COLORS.GREEN;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw flag pole effect
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Draw "GOAL" text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GOAL', this.x + this.width/2, this.y + this.height/2 + 4);
    }

    checkReached(player) {
        const pBounds = player.getBounds();
        return !(pBounds.right < this.x || 
                 pBounds.left > this.x + this.width || 
                 pBounds.bottom < this.y || 
                 pBounds.top > this.y + this.height);
    }
}

// Level Class
class Level {
    constructor(name, playerStart, gates, goalX, timeLimit) {
        this.name = name;
        this.playerStart = playerStart;
        this.gates = gates;
        this.goal = new Goal(goalX);
        this.complete = false;
        this.timeLimit = timeLimit; // Time limit in seconds
    }
}

// Game State
let currentLevel = 0;
let player;
let levels = [];
let keys = {};
let levelComplete = false;
let playerDead = false;
let playerDeathReason = ''; // 'gate' or 'time'
let colorSwitchTimer = 0;
let lastColorSwitchTime = 0;
let levelTimer = 0; // Current level timer in seconds (with decimals)
let levelStartTime = 0; // Timestamp when level started
const BLUE_DURATION = 1000; // Blue lasts 1 second
const RED_DURATION = 500; // Red lasts 0.5 seconds

// Initialize Levels
function initLevels() {
    // Level 1 - Tutorial: Single blue gate (5 seconds)
    levels.push(new Level(
        "Level 1 - Tutorial",
        { x: 50, y: 200 },
        [
            new Gate(350, 'blue')
        ],
        700,
        5 // 5 seconds time limit
    ));

    // Level 2 - Challenge: Blue gate then red gate (5 seconds)
    levels.push(new Level(
        "Level 2 - Simple Challenge",
        { x: 50, y: 200 },
        [
            new Gate(300, 'blue'),
            new Gate(500, 'red')
        ],
        700,
        5 // 5 seconds time limit
    ));

    // Level 3 - HARD: Multiple gates with tight timing (5 seconds)
    // Strategic spacing: gates 3-4 are far apart to force timing challenge
    levels.push(new Level(
        "Level 3 - HARD CHALLENGE",
        { x: 50, y: 200 },
        [
            new Gate(200, 'blue'),   // Gate 1 - blue
            new Gate(280, 'red'),    // Gate 2 - red
            new Gate(360, 'blue'),   // Gate 3 - blue
            new Gate(550, 'red'),    // Gate 4 - red (larger gap!)
            new Gate(620, 'red'),    // Gate 5 - red (changed from blue)
            new Gate(690, 'blue')    // Gate 6 - blue (changed from red)
        ],
        750,
        5 // 5 seconds time limit
    ));
}

// Load Level
function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) {
        // All levels complete
        currentLevel = 0;
        levelIndex = 0;
    }
    
    const level = levels[levelIndex];
    player = new Player(level.playerStart.x, level.playerStart.y);
    levelComplete = false;
    playerDead = false;
    lastColorSwitchTime = Date.now();
    levelStartTime = Date.now();
    levelTimer = level.timeLimit;
    
    document.getElementById('levelText').textContent = level.name;
    updateTimerDisplay();
}


// Update timer display
function updateTimerDisplay() {
    const timerSpan = document.getElementById('levelTimer');
    timerSpan.textContent = Math.ceil(levelTimer).toString() + 's';
    
    // Change color based on time remaining
    if (levelTimer <= 2) {
        timerSpan.style.color = '#E74C3C'; // Red when low
    } else if (levelTimer <= 4) {
        timerSpan.style.color = '#F39C12'; // Orange when medium
    } else {
        timerSpan.style.color = '#2ECC71'; // Green when good
    }
}

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Jump
    if (e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') {
        player.jump();
    }
    
    // Manual color switch disabled - now automatic
    // if (e.key === ' ' || e.key.toLowerCase() === 'c') {
    //     e.preventDefault(); // Prevent space from scrolling page
    //     player.switchColor();
    // }
    
    // Restart level
    if (e.key.toLowerCase() === 'r') {
        loadLevel(currentLevel);
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Handle movement
function handleInput() {
    if (levelComplete || playerDead) return;
    
    if (keys['a'] || keys['arrowleft']) {
        player.moveLeft();
    }
    if (keys['d'] || keys['arrowright']) {
        player.moveRight();
    }
}

// Handle automatic color switching with different durations per color
function handleAutoColorSwitch() {
    if (playerDead || levelComplete) return;
    
    const currentTime = Date.now();
    const timeSinceLastSwitch = currentTime - lastColorSwitchTime;
    
    // Determine the duration based on current color
    const currentDuration = player.color === 'blue' ? BLUE_DURATION : RED_DURATION;
    
    if (timeSinceLastSwitch >= currentDuration) {
        player.switchColor();
        lastColorSwitchTime = currentTime;
    }
}

// Update level timer
function updateLevelTimer() {
    if (playerDead || levelComplete) return;
    
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - levelStartTime) / 1000;
    const level = levels[currentLevel];
    levelTimer = level.timeLimit - elapsedSeconds;
    
    updateTimerDisplay();
    
    // Check if time ran out
    if (levelTimer <= 0) {
        playerDead = true;
        playerDeathReason = 'time'; // Track death reason
        levelTimer = 0;
        updateTimerDisplay();
        
        // Respawn after 1.5 seconds
        setTimeout(() => {
            loadLevel(currentLevel);
        }, 1500);
    }
}

// Gate collision resolution - now causes death instead of blocking
function handleGateCollisions() {
    const level = levels[currentLevel];
    
    for (let gate of level.gates) {
        if (gate.blocksPlayer(player)) {
            // Player dies when hitting wrong color gate
            playerDead = true;
            playerDeathReason = 'gate'; // Track death reason
            
            // Respawn after 1.5 seconds
            setTimeout(() => {
                loadLevel(currentLevel);
            }, 1500);
            
            return; // Stop checking other gates
        }
    }
}

// Draw ground
function drawGround() {
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
}

// Show level complete popup
function showLevelCompletePopup() {
    const popup = document.getElementById('levelCompletePopup');
    const message = document.getElementById('popupMessage');
    const button = document.getElementById('nextLevelBtn');
    
    if (currentLevel < levels.length - 1) {
        message.textContent = `Level ${currentLevel + 1} Complete!`;
        button.textContent = 'Next Level';
    } else {
        message.textContent = 'All Levels Complete!';
        button.textContent = 'Restart Game';
    }
    
    popup.classList.add('show');
}

// Hide level complete popup
function hideLevelCompletePopup() {
    const popup = document.getElementById('levelCompletePopup');
    popup.classList.remove('show');
}

// Draw death message
function drawDeathScreen() {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED!', canvas.width/2, canvas.height/2 - 20);
    
    ctx.font = '24px Arial';
    if (playerDeathReason === 'time') {
        ctx.fillText('Time ran out!', canvas.width/2, canvas.height/2 + 20);
    } else {
        ctx.fillText('Wrong color gate!', canvas.width/2, canvas.height/2 + 20);
    }
    ctx.fillText('Respawning...', canvas.width/2, canvas.height/2 + 50);
}

// Game Loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ground
    drawGround();
    
    // Draw level elements
    const level = levels[currentLevel];
    
    // Draw gates
    for (let gate of level.gates) {
        gate.draw();
    }
    
    // Draw goal
    level.goal.draw();
    
    // Handle input and update player
    if (!levelComplete && !playerDead) {
        handleInput();
        handleAutoColorSwitch();
        updateLevelTimer();
        player.update();
        handleGateCollisions();
        
        // Check if goal reached
        if (level.goal.checkReached(player) && !levelComplete) {
            levelComplete = true;
            showLevelCompletePopup();
        }
    }
    
    // Draw player
    player.draw();
    
    // Draw death overlay
    if (playerDead) {
        drawDeathScreen();
    }
    
    requestAnimationFrame(gameLoop);
}

// Handle next level button click
document.getElementById('nextLevelBtn').addEventListener('click', () => {
    hideLevelCompletePopup();
    currentLevel++;
    loadLevel(currentLevel);
});

// Initialize game
initLevels();
loadLevel(0);
gameLoop();
