// ============================================
// GAME CONFIGURATION - Easy to tweak!
// ============================================
const CONFIG = {
    TOTAL_SLOTS: 10,              // Total number of slots in line
    PLAYER_START_SLOT: 9,         // Starting position (0 = front, 9 = last)
    GAME_DURATION: 20,            // Seconds to reach front
    NPC_VISION_RANGE: 3,          // How many slots behind an NPC they can see
    DANGER_DECAY_RATE: 0.8,      // Per second when player is not moving
    DANGER_DECAY_FAST: 0.0,      // Per second when pressing S (no effect now)
    DANGER_GAIN_WATCHING: 25,    // When moving while NPC watching (medium increase)
    DANGER_GAIN_STARING: 70,     // When moving while NPC staring (very large increase)
    STARING_DURATION: 4.0,        // Base seconds NPC stays in staring state (longer red)
    WATCHING_CHANCE: 0.004,       // Per frame chance to enter watching (slightly higher)
    STARING_CHANCE: 0.0012,       // Per frame chance to enter staring (slightly higher)
    WATCHING_TO_IDLE_CHANCE: 0.01, // Per frame chance for watching NPC to return to idle (stays yellow longer)
    RANDOM_EVENT_INTERVAL: [10, 16], // (Unused now) Seconds between random cut-in events
    SCREEN_SHAKE_INTENSITY: 2,    // Pixels of screen shake
    LOW_FPS_FACTOR: 0.7,          // Lower = choppier feel (0.5-1.0)
    // Pretend (S key) mechanics
    PRETEND_COOLDOWN: 3.0,        // Seconds before S can be used again
    PRETEND_DANGER_REDUCE: 15,    // How much danger is reduced when using S
    // Final countdown pressure
    FINAL_COUNTDOWN_TIME: 5.0,   // Seconds remaining when pressure increases
    FINAL_COUNTDOWN_WATCHING_MULT: 2.0, // Multiplier for watching chance in final countdown
    FINAL_COUNTDOWN_STARING_MULT: 2.5,  // Multiplier for staring chance in final countdown
    FINAL_COUNTDOWN_DECAY_MULT: 0.5,    // Multiplier for danger decay in final countdown (slower decay)
};

// ============================================
// GAME STATE
// ============================================
let canvas, ctx;
let gameState = {
    playerSlot: CONFIG.PLAYER_START_SLOT,
    npcs: [],
    timeRemaining: CONFIG.GAME_DURATION,
    gameOver: false,
    won: false,
    gameOverReason: null, // 'timeout' or 'danger' or null
    lastRandomEvent: 0,
    nextRandomEvent: CONFIG.RANDOM_EVENT_INTERVAL[0] + Math.random() * (CONFIG.RANDOM_EVENT_INTERVAL[1] - CONFIG.RANDOM_EVENT_INTERVAL[0]),
    screenShakeX: 0,
    screenShakeY: 0,
    popups: [],
    danger: 0, // Global danger value (0-100)
    randomEventUsed: false, // Ensure only one cut-in per game
    started: false, // Game starts after player reads instructions
    pretendCooldown: 0, // Cooldown timer for S key (pretend) - starts at 0 (full), goes to CONFIG.PRETEND_COOLDOWN when used
};

// ============================================
// NPC CLASS
// ============================================
class NPC {
    constructor(slot) {
        this.slot = slot;
        this.state = 'idle'; // idle, watching, staring
        this.stateTimer = 0;
    }

    update(deltaTime, watchingChance = CONFIG.WATCHING_CHANCE, staringChance = CONFIG.STARING_CHANCE) {
        // State transitions
        if (this.state === 'idle') {
            if (Math.random() < watchingChance) {
                this.state = 'watching';
                this.stateTimer = 0;
            }
        } else if (this.state === 'watching') {
            this.stateTimer += deltaTime;
            // Yellow must last at least 3s before it can change
            if (this.stateTimer >= 3) {
                // Chance to return to idle (NPC loses interest)
                if (Math.random() < CONFIG.WATCHING_TO_IDLE_CHANCE) {
                    this.state = 'idle';
                    this.stateTimer = 0;
                }
                // Chance to start staring
                else if (Math.random() < staringChance) {
                    this.state = 'staring';
                    this.stateTimer = 0;
                }
            }
        } else if (this.state === 'staring') {
            this.stateTimer += deltaTime;
            // Red must last at least 3s, and up to STARING_DURATION
            const minRedTime = 3;
            const maxRedTime = Math.max(CONFIG.STARING_DURATION, minRedTime);
            if (this.stateTimer >= maxRedTime) {
                this.state = 'idle';
                this.stateTimer = 0;
            }
        }
    }

    canSeePlayer() {
        // Only the NPC directly in front can see the player
        // Front: slot < playerSlot && playerSlot - slot == 1
        if (this.slot < gameState.playerSlot) {
            // NPC is in front
            return (gameState.playerSlot - this.slot) === 1;
        }
        return false;
    }

    reactToPlayerMove() {
        if (!this.canSeePlayer()) return;
        if (gameState.gameOver || gameState.won) return; // Already ended, don't process
        
        // Only increase danger if NPC is not idle (gray)
        // Yellow (watching) = small increase, Red (staring) = large increase
        if (this.state === 'idle') {
            return; // Gray NPCs don't increase danger
        }

        let dangerGain = 0;
        if (this.state === 'watching') {
            dangerGain = CONFIG.DANGER_GAIN_WATCHING; // Small increase
        } else if (this.state === 'staring') {
            dangerGain = CONFIG.DANGER_GAIN_STARING; // Large increase
        }

        gameState.danger += dangerGain;
        gameState.danger = Math.min(100, gameState.danger);

        // Ensure UI danger bar immediately shows as full when capped
        if (gameState.danger >= 100) {
            gameState.danger = 100; // Clamp to exactly 100
            const dangerFillEl = document.getElementById('dangerFill');
            if (dangerFillEl) {
                dangerFillEl.style.width = '100%';
            }
            
            // If danger is full, immediately end the game
            if (!gameState.gameOver && !gameState.won) {
                gameState.gameOver = true;
                gameState.gameOverReason = 'danger';
            }
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize NPCs - all start in watching (yellow) state
    gameState.npcs = [];
    for (let i = 0; i < CONFIG.TOTAL_SLOTS; i++) {
        if (i === gameState.playerSlot) continue; // Skip player slot

        // All NPCs start in watching (yellow) state
        const npc = new NPC(i);
        npc.state = 'watching';
        npc.stateTimer = 0;
        gameState.npcs.push(npc);
    }
    
    // Initialize pretend bar to full (ready)
    updatePretendBar();
    
    // Input handling
    document.addEventListener('keydown', handleKeyPress);

    // Mouse click restart buttons
    const restartBtn = document.getElementById('restartBtn');
    const restartBtnWin = document.getElementById('restartBtnWin');
    if (restartBtn) restartBtn.addEventListener('click', resetGame);
    if (restartBtnWin) restartBtnWin.addEventListener('click', resetGame);
    
    // Start game loop
    let lastTime = performance.now();
    let frameSkip = 0;
    
    function gameLoop(currentTime) {
        const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
        lastTime = currentTime;
        
        // Low FPS feel - skip some frames
        frameSkip++;
        if (frameSkip % Math.floor(1 / CONFIG.LOW_FPS_FACTOR) === 0) {
            update(deltaTime);
        }
        
        render();
        requestAnimationFrame(gameLoop);
    }
    
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// ============================================
// INPUT HANDLING
// ============================================
function handleKeyPress(e) {
    // If game hasn't started yet, only SPACE starts the run
    if (!gameState.started) {
        if (e.key === ' ' || e.code === 'Space') {
            gameState.started = true;
            const start = document.getElementById('startScreen');
            if (start) start.classList.add('hidden');
        }
        return;
    }

    if (gameState.gameOver || gameState.won) {
        if (e.key.toLowerCase() === 'r') {
            resetGame();
        }
        return;
    }
    
    if (e.key.toLowerCase() === 'w') {
        moveForward();
    } else if (e.key.toLowerCase() === 's') {
        pretend();
    }
}

function moveForward() {
    if (gameState.playerSlot === 0) return; // Already at front
    if (gameState.gameOver || gameState.won) return; // Game already ended
    
    // Check the NPC that is currently in front BEFORE moving
    // This is the NPC the player sees before moving
    const npcInFront = gameState.npcs.find(npc => npc.slot === gameState.playerSlot - 1);
    
    // Only react if the NPC in front is not idle (gray)
    if (npcInFront && npcInFront.state !== 'idle') {
        // Calculate danger gain based on NPC state
        let dangerGain = 0;
        if (npcInFront.state === 'watching') {
            dangerGain = CONFIG.DANGER_GAIN_WATCHING;
        } else if (npcInFront.state === 'staring') {
            dangerGain = CONFIG.DANGER_GAIN_STARING;
        }
        
        gameState.danger += dangerGain;
        gameState.danger = Math.min(100, gameState.danger);
        
        // Ensure UI danger bar immediately shows as full when capped
        if (gameState.danger >= 100) {
            gameState.danger = 100; // Clamp to exactly 100
            const dangerFillEl = document.getElementById('dangerFill');
            if (dangerFillEl) {
                dangerFillEl.style.width = '100%';
            }
            
            // If danger is full, immediately end the game
            if (!gameState.gameOver && !gameState.won) {
                gameState.gameOver = true;
                gameState.gameOverReason = 'danger';
                return; // Don't move if game ended
            }
        }
    }
    
    // Move player forward (only if game didn't end)
    if (gameState.gameOver || gameState.won) return;
    gameState.playerSlot--;
    
    // Immediately update UI to reflect new position
    document.getElementById('positionValue').textContent = gameState.playerSlot;
    
    // Screen shake
    gameState.screenShakeX = (Math.random() - 0.5) * CONFIG.SCREEN_SHAKE_INTENSITY * 2;
    gameState.screenShakeY = (Math.random() - 0.5) * CONFIG.SCREEN_SHAKE_INTENSITY * 2;
    
    // Check win condition - reach position 0 (front of the line) with danger not full
    if (!gameState.gameOver && gameState.playerSlot === 0 && gameState.danger < 100) {
        gameState.won = true;
        // Immediately show win screen
        document.getElementById('winScreen').classList.remove('hidden');
    }
}

function pretend() {
    if (gameState.gameOver || gameState.won) return;
    if (!gameState.started) return;
    
    // Check if pretend is ready (cooldown must be 0)
    if (gameState.pretendCooldown > 0) {
        return; // Can't use yet
    }
    
    // Reduce danger
    gameState.danger = Math.max(0, gameState.danger - CONFIG.PRETEND_DANGER_REDUCE);
    
    // Start cooldown (goes from 0 to CONFIG.PRETEND_COOLDOWN, then back to 0)
    gameState.pretendCooldown = CONFIG.PRETEND_COOLDOWN;
    
    // Update UI immediately
    updatePretendBar();
    
    // Visual feedback - add a popup
    const npcInFront = gameState.npcs.find(npc => npc.slot === gameState.playerSlot - 1);
    if (npcInFront) {
        gameState.popups.push({
            slot: gameState.playerSlot - 1,
            text: 'acting natural...',
            type: 'pretend',
            duration: 1.5,
        });
    }
}

// ============================================
// UPDATE LOOP
// ============================================
function update(deltaTime) {
    // If game hasn't started yet, keep UI static and don't advance time
    if (!gameState.started) {
        document.getElementById('timeValue').textContent = Math.ceil(gameState.timeRemaining);
        document.getElementById('positionValue').textContent = gameState.playerSlot;
        document.getElementById('dangerFill').style.width = gameState.danger + '%';
        updatePretendBar();
        return;
    }

    // If already won, freeze game logic but keep UI and win screen updated
    if (gameState.won) {
        document.getElementById('timeValue').textContent = Math.ceil(Math.max(0, gameState.timeRemaining));
        document.getElementById('positionValue').textContent = gameState.playerSlot;
        document.getElementById('dangerFill').style.width = gameState.danger + '%';
        document.getElementById('winScreen').classList.remove('hidden');
        return;
    }

    // If game is over (failed), let render handle black screen, but still sync danger bar
    if (gameState.gameOver) {
        document.getElementById('dangerFill').style.width = gameState.danger + '%';
        return;
    }
    
    // Update timer
    gameState.timeRemaining -= deltaTime;
    if (gameState.timeRemaining <= 0) {
        gameState.gameOver = true;
        gameState.gameOverReason = 'timeout'; // Time's up - couldn't hold it
        return;
    }
    
    // Update pretend cooldown
    // Cooldown works backwards: starts at CONFIG.PRETEND_COOLDOWN (empty), decreases to 0 (full)
    if (gameState.pretendCooldown > 0) {
        gameState.pretendCooldown = Math.max(0, gameState.pretendCooldown - deltaTime);
    }
    
    // Update pretend bar UI
    updatePretendBar();
    
    // Check if we're in final countdown (last 5 seconds)
    const isFinalCountdown = gameState.timeRemaining <= CONFIG.FINAL_COUNTDOWN_TIME;
    
    // Update NPCs with final countdown pressure
    // Calculate adjusted chances for final countdown
    const watchingChance = isFinalCountdown 
        ? CONFIG.WATCHING_CHANCE * CONFIG.FINAL_COUNTDOWN_WATCHING_MULT
        : CONFIG.WATCHING_CHANCE;
    const staringChance = isFinalCountdown
        ? CONFIG.STARING_CHANCE * CONFIG.FINAL_COUNTDOWN_STARING_MULT
        : CONFIG.STARING_CHANCE;
    
    gameState.npcs.forEach(npc => {
        npc.update(deltaTime, watchingChance, staringChance);
    });
    
    // Decay danger over time (slower in final countdown)
    const decayRate = isFinalCountdown 
        ? CONFIG.DANGER_DECAY_RATE * CONFIG.FINAL_COUNTDOWN_DECAY_MULT
        : CONFIG.DANGER_DECAY_RATE;
    gameState.danger = Math.max(0, gameState.danger - decayRate * deltaTime);
    
    // Check failure condition - danger bar full (forced to leave)
    if (gameState.danger >= 100) {
        // Clamp and sync UI bar in case this is where it first hits 100
        gameState.danger = 100;
        const dangerFillEl = document.getElementById('dangerFill');
        if (dangerFillEl) {
            dangerFillEl.style.width = '100%';
        }
        gameState.gameOver = true;
        gameState.gameOverReason = 'danger'; // Danger bar full - forced to leave
    }
    
    // Update popups
    gameState.popups = gameState.popups.filter(popup => {
        popup.duration -= deltaTime;
        return popup.duration > 0;
    });
    
    // Random event: NPC cuts in front (DISABLED)
    
    // Decay screen shake
    gameState.screenShakeX *= 0.9;
    gameState.screenShakeY *= 0.9;
    
    // Update UI
    const timeValueEl = document.getElementById('timeValue');
    const timeEl = document.getElementById('timer');
    timeValueEl.textContent = Math.ceil(gameState.timeRemaining);
    
    // Make timer red in final countdown
    if (isFinalCountdown) {
        timeEl.style.color = '#ff0000';
        timeEl.style.fontWeight = 'bold';
    } else {
        timeEl.style.color = '';
        timeEl.style.fontWeight = '';
    }
    
    document.getElementById('positionValue').textContent = gameState.playerSlot;
    
    // Update danger bar during normal gameplay
    document.getElementById('dangerFill').style.width = gameState.danger + '%';
}

// ============================================
// PRETEND BAR UPDATE
// ============================================
function updatePretendBar() {
    const pretendFillEl = document.getElementById('pretendFill');
    if (!pretendFillEl) return;
    
    // Calculate fill percentage: 0 = empty (just used), CONFIG.PRETEND_COOLDOWN = full (ready)
    // When cooldown is 0, bar is 100% (ready)
    // When cooldown is CONFIG.PRETEND_COOLDOWN, bar is 0% (just used)
    const fillPercent = (1 - (gameState.pretendCooldown / CONFIG.PRETEND_COOLDOWN)) * 100;
    
    pretendFillEl.style.width = fillPercent + '%';
    
    // Change color based on readiness
    if (gameState.pretendCooldown <= 0) {
        // Ready - green
        pretendFillEl.classList.add('ready');
    } else {
        // On cooldown - gray
        pretendFillEl.classList.remove('ready');
    }
}

// ============================================
// RENDERING
// ============================================
function render() {
    // If game is over, show black screen with failure text
    if (gameState.gameOver && !gameState.won) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 64px Impact, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const mainText = gameState.gameOverReason === 'timeout'
            ? 'COULDN\'T HOLD IT'
            : 'KICKED OUT OF LINE';
        const subText = gameState.gameOverReason === 'timeout'
            ? 'TIME UP'
            : 'TOO SUSPICIOUS';

        ctx.fillText(mainText, canvas.width / 2, canvas.height / 2 - 40);

        ctx.fillStyle = '#ffaaaa';
        ctx.font = 'bold 28px Arial';
        ctx.fillText(subText, canvas.width / 2, canvas.height / 2 + 10);

        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 60);

        return;
    }

    // Normal game rendering below
    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply screen shake
    ctx.save();
    ctx.translate(gameState.screenShakeX, gameState.screenShakeY);
    
    // Calculate center position for horizontal line
    const centerY = canvas.height / 2;
    const slotWidth = 80;
    const slotHeight = 100;
    const totalWidth = CONFIG.TOTAL_SLOTS * slotWidth;
    const startX = (canvas.width - totalWidth) / 2;
    
    // Draw toilet icon on the left side, vertically aligned with queue
    const toiletX = startX - 60;
    const toiletY = centerY; // center of the line
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚽', toiletX, toiletY);
    ctx.restore();
    
    // Draw NPCs and player
    for (let slot = 0; slot < CONFIG.TOTAL_SLOTS; slot++) {
        const x = startX + slot * slotWidth;
        const y = centerY - slotHeight / 2;
        
        if (slot === gameState.playerSlot) {
            // Draw player
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x + 10, y + 10, slotWidth - 20, slotHeight - 20);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 10, y + 10, slotWidth - 20, slotHeight - 20);
            
            // Draw face for player
            const faceX = x + slotWidth / 2;
            const faceY = y + slotHeight / 2;
            // Eyes
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(faceX - 12, faceY - 8, 3, 0, Math.PI * 2);
            ctx.arc(faceX + 12, faceY - 8, 3, 0, Math.PI * 2);
            ctx.fill();
            // Mouth (smile)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(faceX, faceY + 5, 8, 0.2, Math.PI - 0.2);
            ctx.stroke();
        } else {
            // Find NPC for this slot
            const npc = gameState.npcs.find(n => n.slot === slot);
            if (!npc) continue;
            
            // Draw NPC based on state color
            // Only the NPC directly in front of the player is fully bright.
            // Others are dimmed so the player focuses on the next one.
            const isFrontNPC = slot === gameState.playerSlot - 1;
            let npcColor;
            if (npc.state === 'watching') {
                npcColor = isFrontNPC ? '#ffaa00' : '#665500'; // bright yellow vs dim yellow-brown
            } else if (npc.state === 'staring') {
                npcColor = isFrontNPC ? '#ff0000' : '#661111'; // bright red vs dark red
            } else {
                npcColor = isFrontNPC ? '#888888' : '#444444'; // front gray vs dim gray
            }

            ctx.fillStyle = npcColor;
            ctx.fillRect(x + 10, y + 10, slotWidth - 20, slotHeight - 20);
            ctx.strokeStyle = isFrontNPC ? '#ffffff' : '#777777';
            ctx.lineWidth = isFrontNPC ? 2 : 1;
            ctx.strokeRect(x + 10, y + 10, slotWidth - 20, slotHeight - 20);
            
            // Draw face for NPC based on state
            const faceX = x + slotWidth / 2;
            const faceY = y + slotHeight / 2;
            const eyeColor = isFrontNPC ? '#000000' : '#333333';
            
            if (npc.state === 'idle') {
                // Happy face - small eyes, smile mouth
                ctx.fillStyle = eyeColor;
                ctx.beginPath();
                ctx.arc(faceX - 12, faceY - 8, 2.5, 0, Math.PI * 2);
                ctx.arc(faceX + 12, faceY - 8, 2.5, 0, Math.PI * 2);
                ctx.fill();
                // Smile mouth (upward arc)
                ctx.strokeStyle = eyeColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(faceX, faceY + 5, 8, 0.2, Math.PI - 0.2);
                ctx.stroke();
            } else if (npc.state === 'watching') {
                // Watching face - slightly larger eyes, neutral mouth
                ctx.fillStyle = eyeColor;
                ctx.beginPath();
                ctx.arc(faceX - 12, faceY - 8, 3, 0, Math.PI * 2);
                ctx.arc(faceX + 12, faceY - 8, 3, 0, Math.PI * 2);
                ctx.fill();
                // Neutral mouth (straight line)
                ctx.strokeStyle = eyeColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(faceX - 8, faceY + 5);
                ctx.lineTo(faceX + 8, faceY + 5);
                ctx.stroke();
            } else if (npc.state === 'staring') {
                // Staring face - large eyes, angry mouth
                ctx.fillStyle = eyeColor;
                ctx.beginPath();
                ctx.arc(faceX - 12, faceY - 8, 4, 0, Math.PI * 2);
                ctx.arc(faceX + 12, faceY - 8, 4, 0, Math.PI * 2);
                ctx.fill();
                // Angry mouth (inverted arc)
                ctx.strokeStyle = eyeColor;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(faceX, faceY + 10, 6, Math.PI + 0.3, Math.PI * 2 - 0.3);
                ctx.stroke();
            }
        }
    }
    
    ctx.restore();
    
    // Draw popups
    gameState.popups.forEach(popup => {
        // Recalculate popup position based on slot for horizontal layout
        const px = startX + popup.slot * slotWidth + slotWidth / 2;
        const py = centerY - slotHeight / 2 - 30;

        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(popup.text, 0, 0);
        ctx.fillText(popup.text, 0, 0);
        ctx.restore();
    });
    
    // Draw legend in corner for NPC states
    const legendX = canvas.width - 180;
    const legendY = canvas.height - 90;
    const boxSize = 16;
    ctx.save();
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // idle
    ctx.fillStyle = '#666666';
    ctx.fillRect(legendX, legendY, boxSize, boxSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GRAY: CHILL', legendX + boxSize + 8, legendY + boxSize / 2);

    // watching
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(legendX, legendY + 24, boxSize, boxSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('YELLOW: WATCHING', legendX + boxSize + 8, legendY + 24 + boxSize / 2);

    // staring
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(legendX, legendY + 48, boxSize, boxSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RED: SUSPICIOUS', legendX + boxSize + 8, legendY + 48 + boxSize / 2);

    ctx.restore();
}

// ============================================
// GAME RESET
// ============================================
function resetGame() {
    gameState.playerSlot = CONFIG.PLAYER_START_SLOT;
    gameState.timeRemaining = CONFIG.GAME_DURATION;
    gameState.gameOver = false;
    gameState.won = false;
    gameState.gameOverReason = null;
    gameState.lastRandomEvent = 0;
    gameState.nextRandomEvent = CONFIG.RANDOM_EVENT_INTERVAL[0] + 
        Math.random() * (CONFIG.RANDOM_EVENT_INTERVAL[1] - CONFIG.RANDOM_EVENT_INTERVAL[0]);
    gameState.screenShakeX = 0;
    gameState.screenShakeY = 0;
    gameState.popups = [];
    gameState.randomEventUsed = false;
    gameState.started = false;
    gameState.pretendCooldown = 0; // Start at 0 = full/ready
    
    // Reset danger
    gameState.danger = 0;
    
    // Reset NPCs - all start in watching (yellow) state
    gameState.npcs.forEach(npc => {
        npc.state = 'watching';
        npc.stateTimer = 0;
    });
    
    // Update pretend bar to show ready state
    updatePretendBar();
    
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('winScreen').classList.add('hidden');
    const start = document.getElementById('startScreen');
    if (start) start.classList.remove('hidden');
}

// ============================================
// START GAME
// ============================================
init();

