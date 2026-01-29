using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Simple welcome screen component that can be attached to a UI panel
/// Provides visual feedback and instructions for the player
/// </summary>
public class WelcomeScreen : MonoBehaviour
{
    [Header("UI Elements (Optional)")]
    [Tooltip("Text component to show blinking 'Click to Start' message")]
    public Text clickToStartText;
    
    [Header("Animation Settings")]
    public bool enableBlinking = true;
    public float blinkSpeed = 1f;

    private float blinkTimer = 0f;

    void Update()
    {
        // Make "Click to Start" text blink
        if (enableBlinking && clickToStartText != null)
        {
            blinkTimer += Time.unscaledDeltaTime * blinkSpeed;
            float alpha = (Mathf.Sin(blinkTimer * Mathf.PI) + 1f) / 2f; // Oscillates between 0 and 1
            
            Color color = clickToStartText.color;
            color.a = Mathf.Lerp(0.3f, 1f, alpha);
            clickToStartText.color = color;
        }
    }
}
