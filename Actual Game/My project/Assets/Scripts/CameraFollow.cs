using UnityEngine;
using System.IO;

public class CameraFollow : MonoBehaviour
{
    public Transform target; // The player to follow
    public Vector3 offset = new Vector3(0f, 5f, -10f); // Camera position relative to player (in local space)
    public float positionSmoothSpeed = 0.125f; // How smoothly the camera follows position
    public float rotationSmoothSpeed = 0.1f; // How smoothly the camera rotates with player
    public bool useLookAt = true; // Whether to look at the target or maintain offset-based rotation
    public float instantRotationThreshold = 45f; // If player rotates more than this in one frame, camera snaps instantly

    private bool initialized = false;
    private Quaternion targetRotation;
    private float lastPlayerRotationY = 0f;

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
                transform.LookAt(target);
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

        // #region agent log
        float currentPlayerRotY = target.rotation.eulerAngles.y;
        float rotationDelta = Mathf.Abs(currentPlayerRotY - lastPlayerRotationY);
        if (rotationDelta > 180f) rotationDelta = 360f - rotationDelta; // Handle wrap-around
        bool playerTurnedInstantly = rotationDelta > instantRotationThreshold;
        if (rotationDelta > 45f) {
            File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"CameraFollow.cs:70\",\"message\":\"Player rotation changed significantly\",\"data\":{{\"playerRotY\":{currentPlayerRotY},\"lastPlayerRotY\":{lastPlayerRotationY},\"delta\":{rotationDelta},\"willSnapCamera\":{playerTurnedInstantly.ToString().ToLower()},\"cameraRotY\":{transform.rotation.eulerAngles.y},\"smoothSpeed\":{rotationSmoothSpeed}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H1\"}}\n");
        }
        lastPlayerRotationY = currentPlayerRotY;
        // #endregion

        // Calculate desired position in world space by rotating offset by target's rotation
        Vector3 rotatedOffset = target.rotation * offset;
        Vector3 desiredPosition = target.position + rotatedOffset;

        // Smoothly interpolate to the desired position
        Vector3 smoothedPosition = Vector3.Lerp(transform.position, desiredPosition, positionSmoothSpeed);
        transform.position = smoothedPosition;

        // Handle rotation
        if (useLookAt)
        {
            // Smoothly look at the target
            Vector3 directionToTarget = target.position - transform.position;
            if (directionToTarget != Vector3.zero)
            {
                Quaternion lookRotation = Quaternion.LookRotation(directionToTarget);
                
                // #region agent log
                float angleToTarget = Quaternion.Angle(transform.rotation, lookRotation);
                if (angleToTarget > 5f) {
                    File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"CameraFollow.cs:95\",\"message\":\"Camera rotating toward target\",\"data\":{{\"currentRotY\":{transform.rotation.eulerAngles.y},\"targetRotY\":{lookRotation.eulerAngles.y},\"angleDiff\":{angleToTarget},\"instantSnap\":{playerTurnedInstantly.ToString().ToLower()},\"useLookAt\":{useLookAt.ToString().ToLower()}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H2\"}}\n");
                }
                // #endregion
                
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
                
                // #region agent log
                float angleToTarget = Quaternion.Angle(transform.rotation, targetRotation);
                if (angleToTarget > 5f) {
                    File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"CameraFollow.cs:113\",\"message\":\"Camera rotating with offset\",\"data\":{{\"currentRotY\":{transform.rotation.eulerAngles.y},\"targetRotY\":{targetRotation.eulerAngles.y},\"angleDiff\":{angleToTarget},\"instantSnap\":{playerTurnedInstantly.ToString().ToLower()},\"useLookAt\":{useLookAt.ToString().ToLower()}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H4\"}}\n");
                }
                // #endregion
                
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
