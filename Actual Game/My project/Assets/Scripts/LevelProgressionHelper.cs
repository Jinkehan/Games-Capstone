using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Helper script to manage level progression
/// This ensures the game starts at Level_1.1 and progresses through levels in order
/// </summary>
public class LevelProgressionHelper : MonoBehaviour
{
    [Header("Level Management")]
    [Tooltip("If true, will automatically load Level_1.1 when the game starts")]
    public bool ensureStartAtLevel1_1 = true;
    
    [Tooltip("The scene name to start at (default: Level_1.1)")]
    public string startLevelName = "Level_1.1";
    
    void Awake()
    {
        // This runs before Start() to ensure we're on the right level
        if (ensureStartAtLevel1_1)
        {
            Scene currentScene = SceneManager.GetActiveScene();
            
            // If we're not on the starting level (Level_1.1), load it
            if (currentScene.name != startLevelName)
            {
                Debug.Log($"LevelProgressionHelper: Loading {startLevelName} to start the game...");
                SceneManager.LoadScene(startLevelName);
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
    /// Load Level_1.1 (useful for main menu or game over)
    /// </summary>
    public static void LoadFirstLevel()
    {
        Debug.Log("Loading Level_1.1...");
        SceneManager.LoadScene("Level_1.1");
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
