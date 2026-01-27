using UnityEngine;

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
        // #region agent log
        System.IO.File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", 
            Newtonsoft.Json.JsonConvert.SerializeObject(new {
                location = "LevelTrigger.cs:OnTriggerEnter",
                message = "Trigger collision detected",
                data = new {
                    otherName = other.gameObject.name,
                    otherTag = other.tag,
                    hasPlayerTag = other.CompareTag("Player"),
                    triggerType = triggerType.ToString(),
                    triggerPosition = transform.position.ToString()
                },
                timestamp = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                sessionId = "debug-session",
                hypothesisId = "B,C,D"
            }) + "\n");
        // #endregion
        
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
        System.IO.File.AppendAllText("/Users/kehanjin/Desktop/Programming/Games-Capstone/Actual Game/.cursor/debug.log", 
            Newtonsoft.Json.JsonConvert.SerializeObject(new {
                location = "LevelTrigger.cs:HandleTurnZoneEntry",
                message = "HandleTurnZoneEntry called",
                data = new {
                    playerName = playerCollider.gameObject.name,
                    hasPlayerMovement = playerCollider.GetComponent<PlayerMovement>() != null
                },
                timestamp = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                sessionId = "debug-session",
                hypothesisId = "D"
            }) + "\n");
        // #endregion
        
        PlayerMovement playerMovement = playerCollider.GetComponent<PlayerMovement>();
        if (playerMovement != null)
        {
            playerMovement.EnterTurnZone();
            Debug.Log("🔵 TurnZone Trigger: Player entered - Press A (Left) or D (Right) to turn!");
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
