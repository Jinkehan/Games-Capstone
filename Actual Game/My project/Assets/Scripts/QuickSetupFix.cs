using UnityEngine;

/// <summary>
/// 快速设置修复工具 - 自动检测并修复常见问题
/// </summary>
public class QuickSetupFix : MonoBehaviour
{
    [Header("一键修复 / One-Click Fix")]
    [Tooltip("勾选后会自动检查并修复问题")]
    public bool autoFix = true;

    void Start()
    {
        if (autoFix)
        {
            CheckAndFix();
        }
    }

    [ContextMenu("检查并修复设置 / Check and Fix Setup")]
    public void CheckAndFix()
    {
        Debug.Log("========================================");
        Debug.Log("开始检查设置 / Starting Setup Check...");
        Debug.Log("========================================");
        
        bool hasIssues = false;
        
        // 1. 检查Player
        GameObject player = GameObject.FindGameObjectWithTag("Player");
        if (player == null)
        {
            Debug.LogError("❌ 找不到Player! 请确保Player的Tag设置为'Player'");
            hasIssues = true;
        }
        else
        {
            Debug.Log("✓ Player找到: " + player.name);
            
            // 检查PlayerMovement
            PlayerMovement pm = player.GetComponent<PlayerMovement>();
            if (pm == null)
            {
                Debug.LogError("❌ Player上没有PlayerMovement组件!");
                hasIssues = true;
            }
            else
            {
                Debug.Log("✓ PlayerMovement组件存在");
                
                // 检查Input Actions
                if (pm.inputActions == null)
                {
                    Debug.LogWarning("⚠️ Input Actions未分配，但系统会使用备用输入(WASD/方向键)");
                    Debug.Log("  → 可以正常游戏，无需担心");
                }
                else
                {
                    Debug.Log("✓ Input Actions已分配");
                }
            }
            
            // 检查Rigidbody
            Rigidbody rb = player.GetComponent<Rigidbody>();
            if (rb == null)
            {
                Debug.LogError("❌ Player需要Rigidbody组件!");
                hasIssues = true;
            }
            else
            {
                Debug.Log("✓ Rigidbody存在");
                
                // 检查Y轴旋转约束
                if ((rb.constraints & RigidbodyConstraints.FreezeRotationY) != 0)
                {
                    Debug.LogError("❌ Rigidbody的Y轴旋转被冻结了! 小球无法转向!");
                    Debug.LogError("  → 修复: 选择Player → Rigidbody → Constraints → 取消勾选 Freeze Rotation Y");
                    hasIssues = true;
                }
                else
                {
                    Debug.Log("✓ Y轴旋转未冻结，可以转向");
                }
            }
        }
        
        // 2. 检查TurnZone
        LevelTrigger[] triggers = FindObjectsByType<LevelTrigger>(FindObjectsSortMode.None);
        bool foundTurnZone = false;
        
        foreach (var trigger in triggers)
        {
            if (trigger.triggerType == LevelTrigger.TriggerType.TurnZone)
            {
                foundTurnZone = true;
                Debug.Log("✓ TurnZone找到: " + trigger.gameObject.name);
                
                // 检查Collider
                Collider col = trigger.GetComponent<Collider>();
                if (col == null)
                {
                    Debug.LogError("❌ TurnZone需要Collider组件!");
                    hasIssues = true;
                }
                else
                {
                    if (!col.isTrigger)
                    {
                        Debug.LogError("❌ TurnZone的Collider必须勾选'Is Trigger'!");
                        Debug.LogError("  → 修复: 选择 " + trigger.gameObject.name + " → Collider → 勾选 Is Trigger");
                        hasIssues = true;
                    }
                    else
                    {
                        Debug.Log("✓ TurnZone的Is Trigger已勾选");
                    }
                }
                
                // 显示位置和大小
                Debug.Log($"  位置: {trigger.transform.position}");
                if (col is BoxCollider box)
                {
                    Debug.Log($"  大小: {box.size}");
                }
            }
        }
        
        if (!foundTurnZone)
        {
            Debug.LogWarning("⚠️ 场景中没有TurnZone! 小球无法转向!");
            Debug.LogWarning("  → 需要创建一个GameObject，添加BoxCollider(Is Trigger)和LevelTrigger(TurnZone)");
            hasIssues = true;
        }
        
        // 3. 检查相机
        Camera mainCam = Camera.main;
        if (mainCam == null)
        {
            Debug.LogWarning("⚠️ 没有主相机");
        }
        else
        {
            Debug.Log("✓ 主相机存在");
            CameraFollow camFollow = mainCam.GetComponent<CameraFollow>();
            if (camFollow == null)
            {
                Debug.LogWarning("⚠️ 相机上没有CameraFollow组件");
            }
            else
            {
                if (camFollow.target == null)
                {
                    Debug.LogWarning("⚠️ CameraFollow的Target未设置");
                }
                else
                {
                    Debug.Log("✓ CameraFollow设置正确");
                }
            }
        }
        
        // 总结
        Debug.Log("========================================");
        if (!hasIssues)
        {
            Debug.Log("✅ 所有检查通过! 系统应该可以正常工作!");
            Debug.Log("现在运行游戏，进入蓝色TurnZone区域，按A或D键转向");
        }
        else
        {
            Debug.LogWarning("⚠️ 发现一些问题，请根据上面的提示修复");
        }
        Debug.Log("========================================");
    }
    
    [ContextMenu("显示输入测试 / Show Input Test")]
    public void TestInput()
    {
        Debug.Log("===== 输入测试 / Input Test =====");
        Debug.Log("按键测试 - 按下WASD或方向键查看反应");
        Debug.Log("Horizontal: " + Input.GetAxisRaw("Horizontal"));
        Debug.Log("Vertical: " + Input.GetAxisRaw("Vertical"));
        Debug.Log("A键: " + Input.GetKey(KeyCode.A));
        Debug.Log("D键: " + Input.GetKey(KeyCode.D));
        Debug.Log("左箭头: " + Input.GetKey(KeyCode.LeftArrow));
        Debug.Log("右箭头: " + Input.GetKey(KeyCode.RightArrow));
    }
}
