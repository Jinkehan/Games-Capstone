using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// 转向系统诊断工具 - 实时显示转向相关的所有状态
/// Turning System Diagnostic Tool - Real-time display of all turning-related states
/// </summary>
public class TurningDiagnostic : MonoBehaviour
{
    [Header("目标对象 / Target Objects")]
    public PlayerMovement playerMovement;
    public GameObject turnZone;
    
    [Header("显示设置 / Display Settings")]
    public bool showOnScreenDebug = true;
    public float updateInterval = 0.1f;
    
    private float lastUpdateTime = 0f;
    private InputAction moveAction;
    private string debugInfo = "";

    void Start()
    {
        // Auto-find player if not assigned
        if (playerMovement == null)
        {
            playerMovement = FindFirstObjectByType<PlayerMovement>();
            if (playerMovement != null)
            {
                Debug.Log("✓ TurningDiagnostic: Auto-found PlayerMovement");
            }
            else
            {
                Debug.LogError("❌ TurningDiagnostic: Cannot find PlayerMovement!");
            }
        }
        
        // Get input action
        if (playerMovement != null && playerMovement.inputActions != null)
        {
            moveAction = playerMovement.inputActions.FindActionMap("Player").FindAction("Move");
        }
        
        // Auto-find turn zone
        if (turnZone == null)
        {
            LevelTrigger[] triggers = FindObjectsByType<LevelTrigger>(FindObjectsSortMode.None);
            foreach (var trigger in triggers)
            {
                if (trigger.triggerType == LevelTrigger.TriggerType.TurnZone)
                {
                    turnZone = trigger.gameObject;
                    Debug.Log("✓ TurningDiagnostic: Auto-found TurnZone: " + turnZone.name);
                    break;
                }
            }
        }
    }

    void Update()
    {
        if (Time.time - lastUpdateTime > updateInterval)
        {
            UpdateDebugInfo();
            lastUpdateTime = Time.time;
        }
    }

    void UpdateDebugInfo()
    {
        if (playerMovement == null)
        {
            debugInfo = "❌ PlayerMovement not found!";
            return;
        }

        System.Text.StringBuilder sb = new System.Text.StringBuilder();
        sb.AppendLine("═══════════════════════════════════");
        sb.AppendLine("    转向系统诊断 / Turning Diagnostic");
        sb.AppendLine("═══════════════════════════════════");
        
        // Input state
        if (moveAction != null)
        {
            Vector2 moveInput = moveAction.ReadValue<Vector2>();
            sb.AppendLine($"📥 Input X: {moveInput.x:F2} (Need > 0.5 or < -0.5)");
            sb.AppendLine($"   Input Y: {moveInput.y:F2}");
            
            if (moveInput.x < -0.5f)
                sb.AppendLine("   ⬅️  LEFT input detected!");
            else if (moveInput.x > 0.5f)
                sb.AppendLine("   ➡️  RIGHT input detected!");
            else
                sb.AppendLine("   ⏺️  No strong input");
        }
        else
        {
            sb.AppendLine("❌ Input Action not found!");
        }
        
        // Check if InputActions is assigned
        sb.AppendLine($"\n🎮 Input Actions Assigned: {(playerMovement.inputActions != null ? "✓ YES" : "❌ NO")}");
        
        // Player position and rotation
        sb.AppendLine($"\n📍 Player Position: {playerMovement.transform.position}");
        sb.AppendLine($"🧭 Player Forward: {playerMovement.transform.forward}");
        sb.AppendLine($"🔄 Player Rotation: {playerMovement.transform.rotation.eulerAngles.y:F1}°");
        
        // Turn zone proximity
        if (turnZone != null)
        {
            float distance = Vector3.Distance(playerMovement.transform.position, turnZone.transform.position);
            sb.AppendLine($"\n🎯 Distance to TurnZone: {distance:F2}");
            
            // Check if player is inside turn zone collider
            BoxCollider boxCol = turnZone.GetComponent<BoxCollider>();
            if (boxCol != null)
            {
                Bounds bounds = boxCol.bounds;
                bool isInside = bounds.Contains(playerMovement.transform.position);
                sb.AppendLine($"🔵 Inside TurnZone Collider: {(isInside ? "✓ YES" : "❌ NO")}");
            }
        }
        else
        {
            sb.AppendLine("\n❌ TurnZone not found!");
        }
        
        // Turning state (using reflection to access private fields)
        System.Type type = playerMovement.GetType();
        var isInTurnZoneField = type.GetField("isInTurnZone", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        var isTurningField = type.GetField("isTurning", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
        
        if (isInTurnZoneField != null && isTurningField != null)
        {
            bool isInTurnZone = (bool)isInTurnZoneField.GetValue(playerMovement);
            bool isTurning = (bool)isTurningField.GetValue(playerMovement);
            
            sb.AppendLine($"\n🔵 isInTurnZone: {(isInTurnZone ? "✓ TRUE" : "❌ FALSE")}");
            sb.AppendLine($"🔄 isTurning: {(isTurning ? "✓ TRUE" : "❌ FALSE")}");
            
            if (!isInTurnZone)
            {
                sb.AppendLine("\n⚠️  NOT IN TURN ZONE - Cannot turn!");
                sb.AppendLine("   Solution: Move into blue TurnZone area");
            }
            else if (isTurning)
            {
                sb.AppendLine("\n⏳ Currently turning...");
            }
            else
            {
                sb.AppendLine("\n✅ Ready to turn! Press A (left) or D (right)");
            }
        }
        
        // Movement parameters
        sb.AppendLine($"\n⚙️  Forward Speed: {playerMovement.forwardSpeed}");
        sb.AppendLine($"⚙️  Turn Duration: {playerMovement.turnDuration}");
        sb.AppendLine($"⚙️  Turn Cooldown: {playerMovement.turnInputCooldown}");
        
        sb.AppendLine("\n═══════════════════════════════════");
        sb.AppendLine("提示 / Tips:");
        sb.AppendLine("1. 进入蓝色TurnZone区域");
        sb.AppendLine("2. 按住 A (左) 或 D (右)");
        sb.AppendLine("3. 查看Console日志输出");
        sb.AppendLine("═══════════════════════════════════");
        
        debugInfo = sb.ToString();
        
        // Print to console every 2 seconds
        if (Time.frameCount % 120 == 0)
        {
            Debug.Log(debugInfo);
        }
    }

    void OnGUI()
    {
        if (!showOnScreenDebug) return;
        
        // Create a styled box for the debug info
        GUIStyle style = new GUIStyle(GUI.skin.box);
        style.alignment = TextAnchor.UpperLeft;
        style.fontSize = 12;
        style.normal.textColor = Color.white;
        style.normal.background = MakeTex(2, 2, new Color(0, 0, 0, 0.8f));
        
        GUI.Box(new Rect(10, 10, 400, 600), debugInfo, style);
    }
    
    private Texture2D MakeTex(int width, int height, Color col)
    {
        Color[] pix = new Color[width * height];
        for (int i = 0; i < pix.Length; i++)
            pix[i] = col;
        
        Texture2D result = new Texture2D(width, height);
        result.SetPixels(pix);
        result.Apply();
        return result;
    }

    // Visualize turn zone in Scene view
    void OnDrawGizmos()
    {
        if (turnZone != null && playerMovement != null)
        {
            // Draw line from player to turn zone
            Gizmos.color = Color.yellow;
            Gizmos.DrawLine(playerMovement.transform.position, turnZone.transform.position);
            
            // Draw player forward direction
            Gizmos.color = Color.blue;
            Gizmos.DrawRay(playerMovement.transform.position, playerMovement.transform.forward * 3f);
        }
    }
}
