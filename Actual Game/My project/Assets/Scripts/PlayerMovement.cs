using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerMovement : MonoBehaviour
{
    [Header("Movement Settings")]
    public float forwardSpeed = 8f; // Constant forward movement speed
    
    [Header("Turning Settings")]
    public float turnSpeed = 10f; // Speed of rotation (higher = instant, lower = smooth) - INCREASED for sharper turns
    public float turnInputCooldown = 0.3f; // Prevent multiple turns in quick succession
    public float turnSpeedMultiplier = 0.5f; // Speed multiplier during turns (0.5 = 50% speed)
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

    void Start()
    {
        rb = GetComponent<Rigidbody>();
        
        // Ensure the rigidbody starts with zero velocity
        rb.linearVelocity = Vector3.zero;
        rb.angularVelocity = Vector3.zero;
        
        // Get player radius from sphere collider
        SphereCollider col = GetComponent<SphereCollider>();
        if (col != null)
        {
            playerRadius = col.radius * transform.localScale.x;
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
    }

    void Update()
    {
        // #region agent log
        if (Time.frameCount % 60 == 0) { // Log every 60 frames (~1 second)
            System.IO.File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", 
                Newtonsoft.Json.JsonConvert.SerializeObject(new {
                    location = "PlayerMovement.cs:Update",
                    message = "Player state",
                    data = new {
                        position = transform.position.ToString(),
                        rotation = transform.rotation.eulerAngles.y,
                        isInTurnZone = isInTurnZone,
                        isTurning = isTurning,
                        forwardDirection = transform.forward.ToString()
                    },
                    timestamp = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    sessionId = "debug-session",
                    hypothesisId = "A"
                }) + "\n");
        }
        // #endregion
        
        CheckGround();
        HandleTurning();
        Move();
        Jump();
        ApplyExtraGravity();
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
        
        // Debug input when in turn zone
        if (isInTurnZone && Mathf.Abs(moveInput.x) > 0.1f)
        {
            Debug.Log($"[DEBUG] In TurnZone - Input X: {moveInput.x:F2}, isTurning: {isTurning}, Cooldown OK: {Time.time > lastTurnTime + turnInputCooldown}");
        }
        
        // Check for turn input while in turn zone
        if (isInTurnZone && !isTurning && Time.time > lastTurnTime + turnInputCooldown)
        {
            // Lower threshold for easier turning
            if (moveInput.x < -0.5f)
            {
                // Turn left (90 degrees counterclockwise)
                InitiateTurn(-90f, -1f);
                lastTurnTime = Time.time;
                Debug.Log("✓ Player turning LEFT - Input: " + moveInput.x);
            }
            else if (moveInput.x > 0.5f)
            {
                // Turn right (90 degrees clockwise)
                InitiateTurn(90f, 1f);
                lastTurnTime = Time.time;
                Debug.Log("✓ Player turning RIGHT - Input: " + moveInput.x);
            }
        }
        
        // Smoothly rotate to target rotation
        if (isTurning)
        {
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, Time.deltaTime * turnSpeed);
            
            // Check if rotation is complete
            if (Quaternion.Angle(transform.rotation, targetRotation) < 0.1f)
            {
                transform.rotation = targetRotation;
                isTurning = false;
                turnDirection = 0f;
                isInTurnZone = false; // Exit turn zone after turning
                Debug.Log("✓ Turn complete. New forward direction: " + transform.forward);
            }
        }
    }

    void InitiateTurn(float angle, float direction)
    {
        targetRotation = transform.rotation * Quaternion.Euler(0f, angle, 0f);
        isTurning = true;
        turnDirection = direction;
        turnStartPosition = transform.position;
    }

    void Move()
    {
        // Reduce speed while turning to prevent wall collisions
        float currentSpeed = isTurning ? forwardSpeed * turnSpeedMultiplier : forwardSpeed;
        
        // Constant forward movement along the player's current forward direction
        Vector3 forwardMovement = transform.forward * currentSpeed;
        
        // Apply turn assist to help guide the ball around corners
        if (isTurning && enableTurnAssist)
        {
            // Calculate how far through the turn we are (0 to 1)
            float turnProgress = 1f - (Quaternion.Angle(transform.rotation, targetRotation) / 90f);
            
            // Get the right vector (perpendicular to forward)
            Vector3 turnAdjustment = transform.right * (-turnDirection) * currentSpeed * 0.3f * Mathf.Sin(turnProgress * Mathf.PI);
            
            forwardMovement += turnAdjustment;
        }
        
        // Get current velocity
        Vector3 velocity = rb.linearVelocity;
        
        // Only move forward (no left/right movement outside of turn zones)
        // This ensures the player stays on track and only turns at designated intersections
        rb.linearVelocity = new Vector3(forwardMovement.x, velocity.y, forwardMovement.z);
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
    public void EnterTurnZone()
    {
        isInTurnZone = true;
        Debug.Log(">>> Player ENTERED TurnZone - Can now turn!");
        
        // #region agent log
        System.IO.File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", 
            Newtonsoft.Json.JsonConvert.SerializeObject(new {
                location = "PlayerMovement.cs:EnterTurnZone",
                message = "TurnZone entered successfully",
                data = new {
                    position = transform.position.ToString(),
                    time = Time.time
                },
                timestamp = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                sessionId = "debug-session",
                hypothesisId = "D"
            }) + "\n");
        // #endregion
    }

    public void ExitTurnZone()
    {
        if (!isTurning)
        {
            isInTurnZone = false;
            Debug.Log("<<< Player EXITED TurnZone");
        }
        else
        {
            Debug.Log(">>> Player still turning, keeping in TurnZone");
        }
    }

    void OnDisable()
    {
        // Disable actions when the script is disabled
        moveAction?.Disable();
        jumpAction?.Disable();
    }
}

