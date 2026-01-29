using UnityEngine;
using UnityEngine.InputSystem;

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
    public float turnDuration = 0.1f; // Duration of turn animation in seconds
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
    private Vector3 turnZoneCenter; // Center position of the current turn zone
    private bool justTurned = false; // Flag to prevent Move() from overriding velocity immediately after turn
    private Vector3 pendingNewVelocity; // Velocity to apply after turn completes
    private Coroutine turnCoroutine; // Reference to the turn coroutine

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
        CheckGround();
        HandleTurning();
        
        // Only move if not currently turning
        if (!isTurning)
        {
            Move();
        }
        else
        {
            // Keep ball at turn zone center while turning
            Vector3 correctedPosition = new Vector3(turnZoneCenter.x, 0.25f, turnZoneCenter.z);
            transform.position = correctedPosition;
            rb.linearVelocity = Vector3.zero; // Stop movement during turn
        }
        
        Jump();
        ApplyExtraGravity();
    }
    
    void LateUpdate()
    {
        // No longer needed - rotation is handled in coroutine
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
        
        // Check for turn input while in turn zone (only 1 turn allowed per zone)
        if (isInTurnZone && Time.time > lastTurnTime + turnInputCooldown)
        {
            // Lower threshold for easier turning
            if (moveInput.x < -0.5f)
            {
                Debug.Log($"⬅️ Left turn input detected!");
                InitiateTurn(-90f, -1f);
            }
            else if (moveInput.x > 0.5f)
            {
                Debug.Log($"➡️ Right turn input detected!");
                InitiateTurn(90f, 1f);
            }
        }
    }

    void InitiateTurn(float angle, float direction)
    {
        // Prevent multiple turns
        if (isTurning) return;
        
        // Get current velocity to determine direction
        Vector3 currentVel = rb.linearVelocity;
        
        // STEP 1: Instantly snap position to turn zone center with corrected Y position
        // Ball is 1 unit tall (radius 0.5), ground top is at -0.25, so ball center should be at 0.25
        Vector3 correctedPosition = new Vector3(turnZoneCenter.x, 0.25f, turnZoneCenter.z);
        transform.position = correctedPosition;
        
        // STEP 2: Stop velocity immediately - ball stays at center
        rb.linearVelocity = Vector3.zero;
        
        // STEP 3: Calculate new velocity by rotating current velocity by 90 degrees
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
        
        // Store the new velocity to apply after turn completes
        pendingNewVelocity = newVel;
        
        // STEP 4: Calculate target rotation based on new velocity direction
        if (Mathf.Abs(newVel.x) > 0.1f)
        {
            // Moving along X axis
            if (newVel.x > 0)
                targetRotation = Quaternion.Euler(0, 90, 0); // Facing +X (right)
            else
                targetRotation = Quaternion.Euler(0, 270, 0); // Facing -X (left)
        }
        else if (Mathf.Abs(newVel.z) > 0.1f)
        {
            // Moving along Z axis
            if (newVel.z > 0)
                targetRotation = Quaternion.Euler(0, 0, 0); // Facing +Z (forward)
            else
                targetRotation = Quaternion.Euler(0, 180, 0); // Facing -Z (back)
        }
        else
        {
            // Fallback: rotate by angle
            targetRotation = transform.rotation * Quaternion.Euler(0, angle, 0);
        }
        
        // Mark that we're turning
        isTurning = true;
        isInTurnZone = false; // Only allow 1 turn per turn zone
        lastTurnTime = Time.time;
        
        // Start the turn coroutine
        if (turnCoroutine != null)
        {
            StopCoroutine(turnCoroutine);
        }
        turnCoroutine = StartCoroutine(CompleteTurn());
        
        Debug.Log($"🔄 Starting Turn: direction={(direction < 0 ? "LEFT" : "RIGHT")}, newVel=({newVel.x}, {newVel.z}), targetRotation={targetRotation.eulerAngles.y}°, pos={transform.position}");
    }
    
    private System.Collections.IEnumerator CompleteTurn()
    {
        // Store starting rotation
        Quaternion startRotation = transform.rotation;
        float elapsedTime = 0f;
        
        // Smoothly rotate over turn duration
        while (elapsedTime < turnDuration)
        {
            elapsedTime += Time.deltaTime;
            float t = elapsedTime / turnDuration;
            
            // Smooth interpolation (easing can be adjusted if needed)
            transform.rotation = Quaternion.Slerp(startRotation, targetRotation, t);
            
            yield return null; // Wait for next frame
        }
        
        // Ensure rotation is exactly at target
        transform.rotation = targetRotation;
        
        // Apply the new velocity
        rb.linearVelocity = pendingNewVelocity;
        
        // Mark that we're done turning
        isTurning = false;
        justTurned = true; // Prevent Move() from overriding velocity this frame
        
        Debug.Log($"✅ Turn Complete: newVel=({pendingNewVelocity.x}, {pendingNewVelocity.z}), rotation={transform.rotation.eulerAngles.y}°");
    }

    void Move()
    {
        // Don't move while turning
        if (isTurning)
        {
            return;
        }
        
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
    
    void OnDisable()
    {
        // Stop any ongoing turn coroutine
        if (turnCoroutine != null)
        {
            StopCoroutine(turnCoroutine);
            turnCoroutine = null;
        }
        
        // Disable actions when the script is disabled
        moveAction?.Disable();
        jumpAction?.Disable();
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

}

