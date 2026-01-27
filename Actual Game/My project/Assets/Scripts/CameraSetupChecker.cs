using UnityEngine;

/// <summary>
/// 相机设置检查器 - 帮助诊断相机跟随问题
/// Camera Setup Checker - Helps diagnose camera follow issues
/// </summary>
public class CameraSetupChecker : MonoBehaviour
{
    [Header("执行检查 / Run Check")]
    [Tooltip("点击这个按钮在Inspector中")]
    public bool runCheck = false;

    void Start()
    {
        CheckCameraSetup();
    }

    void OnValidate()
    {
        if (runCheck)
        {
            runCheck = false;
            CheckCameraSetup();
        }
    }

    [ContextMenu("检查相机设置 / Check Camera Setup")]
    public void CheckCameraSetup()
    {
        Debug.Log("========== 开始检查相机设置 / Checking Camera Setup ==========");
        
        // 查找主相机
        Camera mainCamera = Camera.main;
        if (mainCamera == null)
        {
            Debug.LogError("❌ 错误: 找不到主相机! / ERROR: Main Camera not found!");
            Debug.LogError("   解决方案: 确保场景中有一个相机，并且Tag设置为'MainCamera'");
            return;
        }
        else
        {
            Debug.Log("✓ 主相机找到: " + mainCamera.gameObject.name);
        }

        // 检查CameraFollow脚本
        CameraFollow cameraFollow = mainCamera.GetComponent<CameraFollow>();
        if (cameraFollow == null)
        {
            Debug.LogError("❌ 错误: 相机上没有CameraFollow脚本! / ERROR: CameraFollow script not found on camera!");
            Debug.LogError("   解决方案: 选择Main Camera，点击Add Component，添加CameraFollow脚本");
            return;
        }
        else
        {
            Debug.Log("✓ CameraFollow脚本已添加");
        }

        // 检查Target是否设置
        if (cameraFollow.target == null)
        {
            Debug.LogError("❌ 错误: CameraFollow的Target未设置! / ERROR: CameraFollow Target is not assigned!");
            Debug.LogError("   解决方案: 选择Main Camera，在CameraFollow组件中，将Player小球拖拽到Target字段");
            
            // 尝试自动找到Player
            GameObject player = GameObject.FindGameObjectWithTag("Player");
            if (player != null)
            {
                Debug.LogWarning("   💡 提示: 找到了Player对象: " + player.name);
                Debug.LogWarning("   将这个对象拖拽到CameraFollow的Target字段");
            }
            else
            {
                Debug.LogError("   未找到带'Player'标签的对象。请确保Player小球的Tag设置为'Player'");
            }
            return;
        }
        else
        {
            Debug.Log("✓ Target已设置: " + cameraFollow.target.name);
        }

        // 显示当前配置
        Debug.Log("========== 当前相机配置 / Current Camera Configuration ==========");
        Debug.Log("相机位置 / Camera Position: " + mainCamera.transform.position);
        Debug.Log("相机旋转 / Camera Rotation: " + mainCamera.transform.rotation.eulerAngles);
        Debug.Log("目标位置 / Target Position: " + cameraFollow.target.position);
        Debug.Log("偏移量 / Offset: " + cameraFollow.offset);
        Debug.Log("位置平滑速度 / Position Smooth Speed: " + cameraFollow.positionSmoothSpeed);
        Debug.Log("旋转平滑速度 / Rotation Smooth Speed: " + cameraFollow.rotationSmoothSpeed);
        Debug.Log("使用LookAt / Use Look At: " + cameraFollow.useLookAt);
        
        Debug.Log("========== ✓ 相机设置检查完成! / Camera Setup Check Complete! ==========");
    }
}
