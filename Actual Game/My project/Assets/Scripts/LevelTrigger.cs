using UnityEngine;
using System.IO;

public class LevelTrigger : MonoBehaviour
{
    public enum TriggerType
    {
        TurnZone,
        DeadEnd,
        Goal
    }

    [Header("Trigger Configuration")]
    public TriggerType triggerType = TriggerType.TurnZone;
    
    [Header("Turn Zone Settings")]
    [Tooltip("Only used for TurnZone type. Shows a visual indicator in the editor.")]
    public bool showGizmo = true;

    private void OnTriggerEnter(Collider other)
    {
        // Check if the player entered the trigger
        if (other.CompareTag("Player"))
        {
            switch (triggerType)
            {
                case TriggerType.TurnZone:
                    HandleTurnZoneEntry(other);
                    break;
                    
                case TriggerType.DeadEnd:
                    HandleDeadEnd(other);
                    break;
                    
                case TriggerType.Goal:
                    HandleGoal(other);
                    break;
            }
        }
    }

    private void OnTriggerExit(Collider other)
    {
        // Only handle exit for turn zones
        if (triggerType == TriggerType.TurnZone && other.CompareTag("Player"))
        {
            HandleTurnZoneExit(other);
        }
    }

    private void HandleTurnZoneEntry(Collider playerCollider)
    {
        // #region agent log
        File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", $"{{\"location\":\"LevelTrigger.cs:52\",\"message\":\"TurnZone Entry\",\"data\":{{\"zoneName\":\"{gameObject.name}\",\"zonePosX\":{transform.position.x},\"zonePosZ\":{transform.position.z}}},\"timestamp\":{System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()},\"sessionId\":\"debug-session\",\"hypothesisId\":\"H1\"}}\n");
        // #endregion
        
        PlayerMovement playerMovement = playerCollider.GetComponent<PlayerMovement>();
        if (playerMovement != null)
        {
            // Pass the turn zone's center position to the player
            Vector3 turnZoneCenter = transform.position;
            playerMovement.EnterTurnZone(turnZoneCenter);
            Debug.Log($"🔵 TurnZone Trigger: Player entered at position {turnZoneCenter} - Press A (Left) or D (Right) to turn!");
        }
        else
        {
            Debug.LogWarning("TurnZone: Player object doesn't have PlayerMovement component!");
        }
    }

    private void HandleTurnZoneExit(Collider playerCollider)
    {
        PlayerMovement playerMovement = playerCollider.GetComponent<PlayerMovement>();
        if (playerMovement != null)
        {
            playerMovement.ExitTurnZone();
            Debug.Log("🔵 TurnZone Trigger: Player exited");
        }
    }

    private void HandleDeadEnd(Collider playerCollider)
    {
        Debug.Log("Player hit dead end - Game Over!");
        
        // Find and notify the GameManager
        GameManager gameManager = FindFirstObjectByType<GameManager>();
        if (gameManager != null)
        {
            gameManager.OnPlayerFailed();
        }
        else
        {
            Debug.LogWarning("LevelTrigger: No GameManager found in scene!");
        }
    }

    private void HandleGoal(Collider playerCollider)
    {
        Debug.Log("Player reached goal - Level Complete!");
        
        // Find and notify the GameManager
        GameManager gameManager = FindFirstObjectByType<GameManager>();
        if (gameManager != null)
        {
            gameManager.OnPlayerWon();
        }
        else
        {
            Debug.LogWarning("LevelTrigger: No GameManager found in scene!");
        }
    }

    private void OnDrawGizmos()
    {
        if (!showGizmo) return;

        // Draw different colored boxes based on trigger type
        BoxCollider boxCollider = GetComponent<BoxCollider>();
        if (boxCollider != null && boxCollider.isTrigger)
        {
            Gizmos.matrix = transform.localToWorldMatrix;
            
            switch (triggerType)
            {
                case TriggerType.TurnZone:
                    Gizmos.color = new Color(0f, 1f, 1f, 0.3f); // Cyan
                    break;
                case TriggerType.DeadEnd:
                    Gizmos.color = new Color(1f, 0f, 0f, 0.3f); // Red
                    break;
                case TriggerType.Goal:
                    Gizmos.color = new Color(0f, 1f, 0f, 0.3f); // Green
                    break;
            }
            
            Gizmos.DrawCube(boxCollider.center, boxCollider.size);
            
            // Draw wireframe
            Gizmos.color = new Color(Gizmos.color.r, Gizmos.color.g, Gizmos.color.b, 1f);
            Gizmos.DrawWireCube(boxCollider.center, boxCollider.size);
        }
    }
}
