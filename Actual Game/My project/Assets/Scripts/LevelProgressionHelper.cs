using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Helper script to manage level progression
/// This ensures the game starts at Level 1 and progresses through levels in order
/// </summary>
public class LevelProgressionHelper : MonoBehaviour
{
    [Header("Level Management")]
    [Tooltip("If true, will automatically load Level 1 when the game starts")]
    public bool ensureStartAtLevel1 = true;
    
    void Awake()
    {
        // This runs before Start() to ensure we're on the right level
        if (ensureStartAtLevel1)
        {
            Scene currentScene = SceneManager.GetActiveScene();
            
            // If we're not on Level_1 (build index 0), load it
            if (currentScene.buildIndex != 0)
            {
                Debug.Log("LevelProgressionHelper: Loading Level 1 to start the game...");
                SceneManager.LoadScene(0); // Load the first scene (Level_1)
            }
        }
    }
    
    /// <summary>
    /// Call this method to load the next level in sequence
    /// </summary>
    public static void LoadNextLevel()
    {
        int currentSceneIndex = SceneManager.GetActiveScene().buildIndex;
        int nextSceneIndex = currentSceneIndex + 1;
        
        if (nextSceneIndex < SceneManager.sceneCountInBuildSettings)
        {
            Debug.Log($"Loading Level {nextSceneIndex + 1}...");
            SceneManager.LoadScene(nextSceneIndex);
        }
        else
        {
            Debug.Log("All levels completed! No more levels available.");
            // You could load a "game complete" scene here or restart from Level 1
        }
    }
    
    /// <summary>
    /// Restart the current level
    /// </summary>
    public static void RestartCurrentLevel()
    {
        Scene currentScene = SceneManager.GetActiveScene();
        Debug.Log($"Restarting {currentScene.name}...");
        SceneManager.LoadScene(currentScene.buildIndex);
    }
    
    /// <summary>
    /// Load Level 1 (useful for main menu or game over)
    /// </summary>
    public static void LoadLevel1()
    {
        Debug.Log("Loading Level 1...");
        SceneManager.LoadScene(0);
    }
    
    /// <summary>
    /// Get the current level number (1-based for display)
    /// </summary>
    public static int GetCurrentLevelNumber()
    {
        return SceneManager.GetActiveScene().buildIndex + 1;
    }
    
    /// <summary>
    /// Get the total number of levels
    /// </summary>
    public static int GetTotalLevels()
    {
        return SceneManager.sceneCountInBuildSettings;
    }
}
