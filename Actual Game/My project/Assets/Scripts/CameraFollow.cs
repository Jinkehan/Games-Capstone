using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    public Transform target; // The player to follow
    public Vector3 offset = new Vector3(0f, 5f, -10f); // Camera position relative to player (in local space)
    public float positionSmoothSpeed = 0.125f; // How smoothly the camera follows position
    public float rotationSmoothSpeed = 0.1f; // How smoothly the camera rotates with player
    public bool useLookAt = true; // Whether to look at the target or maintain offset-based rotation
    public float instantRotationThreshold = 45f; // If player rotates more than this in one frame, camera snaps instantly
    
    [Header("Framing")]
    public float verticalBias = 2.0f; // Height above the ball to look at (positive = ball appears lower on screen)

    private bool initialized = false;
    private Quaternion targetRotation;
    private float lastPlayerRotationY = 0f; // Track player rotation changes for instant snap detection

    void Start()
    {
        // CRITICAL: Check if this script is mistakenly on the target object itself
        if (target != null && target.gameObject == gameObject)
        {
            Debug.LogError("CameraFollow ERROR: This script is attached to the same GameObject as the target! " +
                         "The CameraFollow script should be on the Camera, not the Player. " +
                         "Please move this script to your Main Camera GameObject.");
            enabled = false;
            return;
        }
        
        // Set initial position immediately to avoid any startup issues
        if (target != null)
        {
            // Calculate position using target's rotation
            Vector3 rotatedOffset = target.rotation * offset;
            transform.position = target.position + rotatedOffset;
            
            if (useLookAt)
            {
                // Look at a point above the ball to push it lower on screen
                Vector3 lookTarget = target.position + Vector3.up * verticalBias;
                transform.LookAt(lookTarget);
            }
            else
            {
                // Calculate initial rotation based on offset
                targetRotation = Quaternion.LookRotation(target.position - transform.position);
                transform.rotation = targetRotation;
            }
            
            initialized = true;
        }
    }

    void LateUpdate()
    {
        if (target == null)
        {
            Debug.LogWarning("CameraFollow: No target assigned!");
            return;
        }

        if (!initialized)
        {
            // Safety check - set position immediately first frame
            Vector3 initialRotatedOffset = target.rotation * offset;
            transform.position = target.position + initialRotatedOffset;
            initialized = true;
        }

        // Detect if player made an instant turn (>45 degrees in one frame)
        float currentPlayerRotY = target.rotation.eulerAngles.y;
        float rotationDelta = Mathf.Abs(currentPlayerRotY - lastPlayerRotationY);
        if (rotationDelta > 180f) rotationDelta = 360f - rotationDelta; // Handle wrap-around
        bool playerTurnedInstantly = rotationDelta > instantRotationThreshold;
        lastPlayerRotationY = currentPlayerRotY;

        // Calculate desired position in world space by rotating offset by target's rotation
        Vector3 rotatedOffset = target.rotation * offset;
        Vector3 desiredPosition = target.position + rotatedOffset;

        // Smoothly interpolate to the desired position
        Vector3 smoothedPosition = Vector3.Lerp(transform.position, desiredPosition, positionSmoothSpeed);
        transform.position = smoothedPosition;

        // Handle rotation
        if (useLookAt)
        {
            // Look at a point above the ball to push it lower on screen
            Vector3 lookTarget = target.position + Vector3.up * verticalBias;
            Vector3 directionToTarget = lookTarget - transform.position;
            if (directionToTarget != Vector3.zero)
            {
                Quaternion lookRotation = Quaternion.LookRotation(directionToTarget);
                
                // If player just did an instant 90-degree turn, snap camera instantly too
                if (playerTurnedInstantly)
                {
                    transform.rotation = lookRotation;
                }
                else
                {
                    transform.rotation = Quaternion.Slerp(transform.rotation, lookRotation, rotationSmoothSpeed);
                }
            }
        }
        else
        {
            // Maintain the offset angle relative to player's rotation
            // This keeps the camera at a fixed angle behind the player even after turns
            Vector3 direction = -rotatedOffset.normalized;
            if (direction != Vector3.zero)
            {
                targetRotation = Quaternion.LookRotation(direction);
                
                // If player just did an instant 90-degree turn, snap camera instantly too
                if (playerTurnedInstantly)
                {
                    transform.rotation = targetRotation;
                }
                else
                {
                    transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationSmoothSpeed);
                }
            }
        }
    }
}
