using UnityEngine;
using UnityEngine.InputSystem;
using System.IO;

/// <summary>
/// Main player movement controller with auto-forward movement, turning, and collision detection
/// 
/// Collision System:
/// - Walls (solid colliders) = Game Over when hit
/// - Doors (triggers with Door.cs) = Pass through freely
/// - Turn Zones (triggers with LevelTrigger.cs) = Allow turning
/// - Dead Ends (triggers with LevelTrigger.cs) = Game Over
/// - Goals (triggers with LevelTrigger.cs) = Level Complete
/// </summary>
public class PlayerMovement : MonoBehaviour
{
    [Header("Movement Settings")]
    public float forwardSpeed = 16f; // Constant forward movement speed
    
    [Header("Turning Settings")]
    public float turnSpeed = 40f; // Speed of rotation (higher = instant, lower = smooth) - MUST be very high for consecutive turn zones
    public float turnInputCooldown = 0.3f; // Prevent multiple turns in quick succession
    public float turnSpeedMultiplier = 1.0f; // Speed multiplier during turns (1.0 = full speed, no slowdown) - KEEP AT 1.0 for consistent speed
    public bool enableTurnAssist = true; // Helps guide the ball during turns to avoid walls
    
    [Header("Jump Settings")]
    public float jumpHeight = 10f; // Height in Unity units
    public float gravityScale = 1f; // Higher = faster fall
    
    [Header("Input")]
    public InputActionAsset inputActions;
    public bool useOldInputSystem = false; // Fallback to old input if new input system fails
    
    [Header("Ground Detection")]
    public LayerMask groundLayer;
    public float groundCheckDistance = 0.1f;

    private Rigidbody rb;
    private bool isGrounded;
    private InputAction moveAction;
    private InputAction jumpAction;
    private float playerRadius;
    
    // Turning system
    private bool isInTurnZone = false;
    private Quaternion targetRotation;
    private bool isTurning = false;
    private float lastTurnTime = -999f; // Track when last turn happened
    private float turnDirection = 0f; // -1 for left, 1 for right, 0 for no turn
    private Vector3 turnStartPosition; // Position where turn started
    private Vector3 turnZoneCenter; // Center position of the current turn zone
    private bool justTurned = false; // Flag to prevent Move() from overriding velocity immediately after turn
    private Vector3 cachedForward; // Cache forward direction after turn to avoid Unity transform lag
    private bool useCachedForward = false; // Flag to use cached forward instead of transform.forward
    private float lastPlayerRotationY = 0f; // Track rotation changes for debugging

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        
        // Configure Rigidbody to prevent bouncing and shaking
        rb.constraints = RigidbodyConstraints.FreezeRotation; // Prevent the ball from rotating due to physics
        rb.interpolation = RigidbodyInterpolation.Extrapolate; // Smoother visual movement (predicts next position)
        rb.collisionDetectionMode = CollisionDetectionMode.Continuous; // Better collision detection at high speeds
        
        // Reduce bounciness and friction issues
        rb.linearDamping = 0f; // No drag in the air
        rb.angularDamping = 0f; // No rotational drag
        
        // Get player radius from sphere collider
        SphereCollider col = GetComponent<SphereCollider>();
        if (col != null)
        {
            playerRadius = col.radius * transform.localScale.x;
            
            // Create and assign a non-bouncy physics material if none exists
            if (col.sharedMaterial == null)
            {
                PhysicsMaterial noBounceMaterial = new PhysicsMaterial("NoBounceMaterial");
                noBounceMaterial.bounciness = 0f;
                noBounceMaterial.dynamicFriction = 0.4f;
                noBounceMaterial.staticFriction = 0.4f;
                noBounceMaterial.frictionCombine = PhysicsMaterialCombine.Average;
                noBounceMaterial.bounceCombine = PhysicsMaterialCombine.Minimum;
                col.material = noBounceMaterial;
                Debug.Log("✓ Created non-bouncy physics material for player");
            }
        }
        else
        {
            playerRadius = 0.5f; // Default
        }
        
        // Get the actions from the Input Action Asset
        if (inputActions != null)
        {
            try
            {
                moveAction = inputActions.FindActionMap("Player").FindAction("Move");
                jumpAction = inputActions.FindActionMap("Player").FindAction("Jump");
                
                // Enable the actions
                moveAction?.Enable();
                jumpAction?.Enable();
                
                if (moveAction != null && jumpAction != null)
                {
                    Debug.Log("✓ Input Actions successfully loaded!");
                    useOldInputSystem = false;
                }
                else
                {
                    Debug.LogWarning("⚠️ Input Actions found but Move/Jump actions missing! Using fallback input.");
                    useOldInputSystem = true;
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError("❌ Error loading Input Actions: " + e.Message + "\nUsing fallback input system.");
                useOldInputSystem = true;
            }
        }
        else
        {
            Debug.LogWarning("⚠️ Input Actions not assigned! Using fallback old input system (WASD/Arrows).");
            useOldInputSystem = true;
        }
        
        targetRotation = transform.rotation;
        
        // Set initial forward velocity based on player's starting rotation
        rb.linearVelocity = transform.forward * forwardSpeed;
        rb.angularVelocity = Vector3.zero;
        
        Debug.Log($"✓ Player initialized with velocity: {rb.linearVelocity}, forward: {transform.forward}");
    }

    void Update()
    {
        // #region agent log
        float rotY = transform.rotation.eulerAngles.y;
        if (Mathf.Abs(rotY - lastPlayerRotationY) > 45f && lastPlayerRotationY > 0) {
            File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:138\",\"message\":\"UPDATE START - rotation changed\",\"data\":{{\"oldRotY\":{lastPlayerRotationY},\"newRotY\":{rotY},\"velX\":{rb.linearVelocity.x},\"velZ\":{rb.linearVelocity.z},\"justTurned\":{justTurned.ToString().ToLower()}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_ROT_FLICKER\"}}\n");
        }
        lastPlayerRotationY = rotY;
        // #endregion
        
        CheckGround();
        
        // #region agent log
        float rotYBeforeTurn = transform.rotation.eulerAngles.y;
        // #endregion
        
        HandleTurning();
        
        // #region agent log
        float rotYAfterTurn = transform.rotation.eulerAngles.y;
        if (Mathf.Abs(rotYAfterTurn - rotYBeforeTurn) > 45f) {
            File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:148\",\"message\":\"Rotation changed by HandleTurning\",\"data\":{{\"beforeTurnRotY\":{rotYBeforeTurn},\"afterTurnRotY\":{rotYAfterTurn},\"velX\":{rb.linearVelocity.x},\"velZ\":{rb.linearVelocity.z}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_TURN_MOMENT\"}}\n");
        }
        // #endregion
        
        Move();
        
        // #region agent log
        float rotYAfter = transform.rotation.eulerAngles.y;
        if (Mathf.Abs(rotYAfter - rotY) > 1f) {
            File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:162\",\"message\":\"UPDATE END - rotation changed during Update\",\"data\":{{\"startRotY\":{rotY},\"endRotY\":{rotYAfter},\"velX\":{rb.linearVelocity.x},\"velZ\":{rb.linearVelocity.z}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_ROT_SOURCE\"}}\n");
        }
        // #endregion
        
        Jump();
        ApplyExtraGravity();
    }
    
    void LateUpdate()
    {
        // No longer needed - turns are instant and position is locked immediately
    }

    void ApplyExtraGravity()
    {
        // Apply extra downward force for snappier jumps
        rb.AddForce(Physics.gravity * (gravityScale - 1f) * rb.mass);
    }

    void CheckGround()
    {
        // Raycast downward to check if we're on the ground
        isGrounded = Physics.Raycast(transform.position, Vector3.down, playerRadius + groundCheckDistance);
    }

    void HandleTurning()
    {
        // Get input from either new or old input system
        Vector2 moveInput = GetMoveInput();
        
        // #region agent log
        if (isInTurnZone && Time.frameCount % 15 == 0) { File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:150\",\"message\":\"In zone checking\",\"data\":{{\"moveInputX\":{moveInput.x},\"isInZone\":{isInTurnZone.ToString().ToLower()},\"cooldownReady\":{(Time.time > lastTurnTime + turnInputCooldown).ToString().ToLower()}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_CAN_TURN\"}}\n"); }
        // #endregion
        
        // Check for turn input while in turn zone (only 1 turn allowed per zone)
        if (isInTurnZone && Time.time > lastTurnTime + turnInputCooldown)
        {
            // Lower threshold for easier turning
            if (moveInput.x < -0.5f)
            {
                // #region agent log
                File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:159\",\"message\":\"LEFT TURN\",\"data\":{{\"moveInputX\":{moveInput.x}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_TURN_INPUT\"}}\n");
                // #endregion
                
                Debug.Log($"⬅️ Left turn input detected!");
                InitiateTurn(-90f, -1f);
            }
            else if (moveInput.x > 0.5f)
            {
                // #region agent log
                File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:171\",\"message\":\"RIGHT TURN\",\"data\":{{\"moveInputX\":{moveInput.x}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_TURN_INPUT\"}}\n");
                // #endregion
                
                Debug.Log($"➡️ Right turn input detected!");
                InitiateTurn(90f, 1f);
            }
        }
    }

    void InitiateTurn(float angle, float direction)
    {
        // Get current velocity to determine direction
        Vector3 currentVel = rb.linearVelocity;
        Vector3 currentPos = transform.position;
        
        // #region agent log
        File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:245\",\"message\":\"InitiateTurn called\",\"data\":{{\"angle\":{angle},\"oldVelX\":{currentVel.x},\"oldVelZ\":{currentVel.z},\"posX\":{currentPos.x},\"posZ\":{currentPos.z},\"centerX\":{turnZoneCenter.x},\"centerZ\":{turnZoneCenter.z}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_TURN_START\"}}\n");
        // #endregion
        
        // STEP 1: Instantly snap position to turn zone center with corrected Y position
        // Ball is 1 unit tall (radius 0.5), ground top is at -0.25, so ball center should be at 0.25
        Vector3 correctedPosition = new Vector3(turnZoneCenter.x, 0.25f, turnZoneCenter.z);
        transform.position = correctedPosition;
        
        // STEP 2: Calculate new velocity by rotating current velocity by 90 degrees
        Vector3 newVel = Vector3.zero;
        
        if (direction < 0) // LEFT TURN
        {
            // Rotate velocity 90 degrees counterclockwise (left)
            // If moving +Z (0, 20), turn left = -X (-20, 0)
            // If moving -X (-20, 0), turn left = -Z (0, -20)
            // If moving -Z (0, -20), turn left = +X (20, 0)
            // If moving +X (20, 0), turn left = +Z (0, 20)
            newVel.x = -currentVel.z;
            newVel.z = currentVel.x;
        }
        else // RIGHT TURN
        {
            // Rotate velocity 90 degrees clockwise (right)
            // If moving +Z (0, 20), turn right = +X (20, 0)
            // If moving +X (20, 0), turn right = -Z (0, -20)
            // If moving -Z (0, -20), turn right = -X (-20, 0)
            // If moving -X (-20, 0), turn right = +Z (0, 20)
            newVel.x = currentVel.z;
            newVel.z = -currentVel.x;
        }
        
        // Preserve Y velocity (vertical movement)
        newVel.y = currentVel.y;
        
        // STEP 3: Apply new velocity instantly
        rb.linearVelocity = newVel;
        
        // STEP 4: Rotate transform to match velocity direction
        if (Mathf.Abs(newVel.x) > 0.1f)
        {
            // Moving along X axis
            if (newVel.x > 0)
                transform.rotation = Quaternion.Euler(0, 90, 0); // Facing +X (right)
            else
                transform.rotation = Quaternion.Euler(0, 270, 0); // Facing -X (left)
        }
        else if (Mathf.Abs(newVel.z) > 0.1f)
        {
            // Moving along Z axis
            if (newVel.z > 0)
                transform.rotation = Quaternion.Euler(0, 0, 0); // Facing +Z (forward)
            else
                transform.rotation = Quaternion.Euler(0, 180, 0); // Facing -Z (back)
        }
        
        // #region agent log
        File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:295\",\"message\":\"Turn completed - Player rotated\",\"data\":{{\"newVelX\":{rb.linearVelocity.x},\"newVelZ\":{rb.linearVelocity.z},\"newRotY\":{transform.rotation.eulerAngles.y},\"forwardX\":{transform.forward.x},\"forwardZ\":{transform.forward.z},\"frameCount\":{Time.frameCount}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H3\"}}\n");
        // #endregion
        
        // Mark that we just turned - prevents Move() from overriding velocity this frame
        justTurned = true;
        
        // Mark that we're done turning
        isInTurnZone = false; // Only allow 1 turn per turn zone
        lastTurnTime = Time.time;
        
        Debug.Log($"🔄 INSTANT Turn: direction={(direction < 0 ? "LEFT" : "RIGHT")}, newVel=({newVel.x}, {newVel.z}), rotation={transform.rotation.eulerAngles.y}°, pos={transform.position}");
    }

    void Move()
    {
        // Skip velocity adjustment if we just turned (prevents Move from overriding turn velocity)
        if (justTurned)
        {
            justTurned = false;
            return;
        }
        
        // Keep velocity constant at forwardSpeed (normalize and scale)
        Vector3 vel = rb.linearVelocity;
        Vector3 horizontalVel = new Vector3(vel.x, 0, vel.z);
        
        // If horizontal velocity is too low (shouldn't happen after Start()), reset to forward direction
        if (horizontalVel.magnitude < 0.1f)
        {
            // Set velocity based on current forward direction
            rb.linearVelocity = new Vector3(transform.forward.x * forwardSpeed, vel.y, transform.forward.z * forwardSpeed);
        }
        else
        {
            // Maintain constant speed in current direction
            horizontalVel = horizontalVel.normalized * forwardSpeed;
            rb.linearVelocity = new Vector3(horizontalVel.x, vel.y, horizontalVel.z);
        }
    }

    void Jump()
    {
        bool jumpPressed = false;
        
        // Check jump input from either system
        if (useOldInputSystem)
        {
            jumpPressed = Input.GetKeyDown(KeyCode.Space);
        }
        else if (jumpAction != null)
        {
            jumpPressed = jumpAction.triggered;
        }
        
        if (jumpPressed && isGrounded)
        {
            // Calculate velocity needed to reach desired height
            float totalGravity = Physics.gravity.magnitude * gravityScale;
            float jumpVelocity = Mathf.Sqrt(2f * totalGravity * jumpHeight);
            
            // Set Y velocity directly for consistent jump height
            Vector3 velocity = rb.linearVelocity;
            velocity.y = jumpVelocity;
            rb.linearVelocity = velocity;
        }
    }
    
    // Helper method to get input from either new or old input system
    private Vector2 GetMoveInput()
    {
        if (useOldInputSystem)
        {
            // Use old Input system as fallback
            float horizontal = Input.GetAxisRaw("Horizontal"); // A/D or Left/Right arrows
            float vertical = Input.GetAxisRaw("Vertical");     // W/S or Up/Down arrows
            return new Vector2(horizontal, vertical);
        }
        else if (moveAction != null)
        {
            // Use new Input System
            return moveAction.ReadValue<Vector2>();
        }
        
        return Vector2.zero;
    }

    // Called by TurnZone triggers
    public void EnterTurnZone(Vector3 zoneCenter)
    {
        // #region agent log
        File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"PlayerMovement.cs:326\",\"message\":\"EnterTurnZone\",\"data\":{{\"zoneCenterX\":{zoneCenter.x},\"zoneCenterZ\":{zoneCenter.z},\"isTurning\":{isTurning.ToString().ToLower()},\"turnAngle\":{Quaternion.Angle(transform.rotation, targetRotation)}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H_STILL_TURNING\"}}\n");
        // #endregion
        
        isInTurnZone = true;
        turnZoneCenter = zoneCenter;
        Debug.Log($"✅ EnterTurnZone called: zoneCenter={zoneCenter}, playerPos={transform.position}, playerForward={transform.forward}");
    }

    public void ExitTurnZone()
    {
        if (!isTurning)
        {
            isInTurnZone = false;
        }
    }

    void OnCollisionEnter(Collision collision)
    {
        // Check if player hit a wall (not a door or other special objects)
        // Doors and special objects should be triggers, walls should be solid colliders
        // We want to ignore collisions with the ground
        
        // Check if this is a ground collision
        bool isGroundCollision = false;
        foreach (ContactPoint contact in collision.contacts)
        {
            // If the collision normal is pointing mostly upward, it's the ground
            if (contact.normal.y > 0.7f)
            {
                isGroundCollision = true;
                break;
            }
        }
        
        // If not ground, it's a wall collision - player loses
        if (!isGroundCollision)
        {
            // Find and notify the GameManager
            GameManager gameManager = FindFirstObjectByType<GameManager>();
            if (gameManager != null)
            {
                gameManager.OnPlayerFailed();
            }
            
            // Stop the player movement to prevent further collisions
            rb.linearVelocity = Vector3.zero;
        }
    }

    void OnDisable()
    {
        // Disable actions when the script is disabled
        moveAction?.Disable();
        jumpAction?.Disable();
    }
}

