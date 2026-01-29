# Collision System Setup Guide

## Overview
This guide explains how to set up the collision system so that players lose when they hit walls but can pass through doors.

## Quick Setup Checklist

### ✅ Player Setup
- [ ] Player has a **Sphere Collider** (not trigger)
- [ ] Player has a **Rigidbody** with:
  - Collision Detection: **Continuous**
  - Constraints: **Freeze Rotation** (X, Y, Z)
  - Interpolation: **Interpolate**
- [ ] Player tag is set to **"Player"**
- [ ] PlayerMovement.cs script is attached

### ✅ Wall Setup (These cause Game Over)
- [ ] Walls have **Box Colliders**
- [ ] Colliders are **NOT triggers** (Is Trigger: unchecked)
- [ ] Walls do NOT have any special tags
- [ ] Material can be anything (Wall material, etc.)

### ✅ Door Setup (Player passes through)
- [ ] Doors have **Box Colliders**
- [ ] Door.cs script is attached
- [ ] Door script will auto-set collider as trigger
- [ ] doorColor property set in Inspector ("Green" or "Red")

### ✅ Ground Setup
- [ ] Ground has a collider (Box or Mesh Collider)
- [ ] Ground is positioned below the player (Y position)
- [ ] Ground collisions are automatically filtered out by the system

### ✅ Special Triggers
- [ ] Turn Zones: Box Collider (Is Trigger: ✓) + LevelTrigger.cs (Type: TurnZone)
- [ ] Dead Ends: Box Collider (Is Trigger: ✓) + LevelTrigger.cs (Type: DeadEnd)
- [ ] Goals: Box Collider (Is Trigger: ✓) + LevelTrigger.cs (Type: Goal)

## How It Works

### Collision Detection Logic

The system uses `OnCollisionEnter()` in PlayerMovement.cs:

```
Player Collides with Something
    ↓
Is it the ground? (Check collision normal.y > 0.7)
    ↓
YES → Ignore (player can walk on ground)
    ↓
NO → It's a wall!
    ↓
Stop player movement
    ↓
Call GameManager.OnPlayerFailed()
    ↓
Show Game Over UI
```

### Why This Works

1. **Walls** = Solid colliders → Trigger `OnCollisionEnter()` → Game Over
2. **Doors** = Trigger colliders → Trigger `OnTriggerEnter()` (ignored) → Pass through
3. **Ground** = Solid collider BUT normal points up → Filtered out → Walk on it
4. **Triggers** = Never trigger `OnCollisionEnter()` → Don't interfere

## Step-by-Step: Converting Existing Scene

### If you already have a scene with walls and doors:

#### 1. Identify Your Doors
- Find all door GameObjects (Green Door, Red Door, etc.)

#### 2. Add Door Script to Each Door
```
1. Select door GameObject
2. Add Component → Door (or drag Door.cs script)
3. Set doorColor to "Green" or "Red" in Inspector
4. Script will automatically make collider a trigger
```

#### 3. Verify Walls
- Select each wall GameObject
- Check Inspector: Box Collider should have "Is Trigger" UNCHECKED ❌

#### 4. Test
```
1. Play the scene
2. Try to pass through doors → Should work ✓
3. Try to hit walls → Should trigger Game Over ✓
4. Walk on ground → Should work ✓
```

## Common Issues & Solutions

### Issue: Player falls through ground
**Cause:** Ground collider might be set as trigger  
**Fix:** Uncheck "Is Trigger" on ground collider

### Issue: Player can't pass through doors
**Cause:** Door collider not set as trigger  
**Fix:** 
1. Check if Door.cs is attached to door
2. Manually check "Is Trigger" on door's Box Collider
3. Verify door has a collider component

### Issue: Doors cause Game Over
**Cause:** Door colliders are solid (not triggers)  
**Fix:** Add Door.cs script or manually set collider as trigger

### Issue: Player passes through walls
**Cause:** Wall colliders set as triggers  
**Fix:** Uncheck "Is Trigger" on wall colliders

### Issue: Game Over triggers when landing after jump
**Cause:** Ground collision normal threshold too strict  
**Fix:** Check if ground is flat and level (rotation should be 0, 0, 0)

## Visual Guide

### Wall Configuration (Game Over on Hit)
```
Wall GameObject
├─ Transform
├─ Box Collider
│  └─ Is Trigger: ❌ (UNCHECKED)
└─ Mesh Renderer (with material)
```

### Door Configuration (Pass Through)
```
Door GameObject
├─ Transform
├─ Box Collider
│  └─ Is Trigger: ✓ (CHECKED - auto by Door.cs)
├─ Door (Script)
│  └─ doorColor: "Green" or "Red"
└─ Mesh Renderer (with door material)
```

### Player Configuration
```
Player GameObject
├─ Transform
├─ Sphere Collider
│  └─ Is Trigger: ❌ (UNCHECKED)
├─ Rigidbody
│  ├─ Collision Detection: Continuous
│  ├─ Constraints: Freeze Rotation (all axes)
│  └─ Interpolation: Interpolate
├─ PlayerMovement (Script)
└─ Tag: "Player"
```

## Testing Scenarios

### Test 1: Normal Play
1. Start game
2. Move forward through level
3. Turn at turn zone
4. Pass through green door ✓

### Test 2: Wall Collision (Turn Too Late)
1. Start game
2. Enter turn zone
3. Don't turn (or turn too late)
4. Hit wall → Game Over UI should appear ✓

### Test 3: Dead End
1. Start game
2. Turn at turn zone
3. Choose wrong path (dead end)
4. Hit dead end trigger → Game Over UI ✓

### Test 4: Goal
1. Start game
2. Turn correctly
3. Pass through green door
4. Reach goal → Level Complete UI ✓

## Debug Tips

### Enable Collider Gizmos
In Unity Editor:
1. Click "Gizmos" button in Scene view (top right)
2. Enable "Colliders" to see all colliders as colored outlines
3. Green = Solid, Yellow = Trigger

### Check Console for Messages
When player hits something, check Console:
- "Player hit dead end - Game Over!"
- "Player passed through Green door"
- No message = Wall collision (Game Over triggered)

### Use Debug Mode
If needed, temporarily add debug logs to `OnCollisionEnter()`:
```csharp
Debug.Log($"Collision with: {collision.gameObject.name}");
```

## Architecture Summary

**Collision Types in Game:**

| Object Type | Collider Type | Script | Result |
|-------------|---------------|--------|--------|
| Wall | Solid | None | Game Over |
| Door | Trigger | Door.cs | Pass through |
| Ground | Solid | None | Walk on it (filtered) |
| Turn Zone | Trigger | LevelTrigger.cs | Allow turning |
| Dead End | Trigger | LevelTrigger.cs | Game Over |
| Goal | Trigger | LevelTrigger.cs | Level Complete |

## Success!

Once configured correctly:
- ✅ Player loses when hitting walls
- ✅ Player can pass through doors
- ✅ Player can walk on ground
- ✅ Triggers work independently
- ✅ Turn timing matters!

Your maze runner now has a proper challenge system where timing and precision matter!
