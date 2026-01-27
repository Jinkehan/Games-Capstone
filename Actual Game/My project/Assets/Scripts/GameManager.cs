using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    [Header("UI References")]
    public GameObject gameOverUI;
    public GameObject levelCompleteUI;
    
    [Header("Settings")]
    public bool pauseOnGameOver = true;
    public bool pauseOnLevelComplete = true;

    private bool gameEnded = false;

    void Start()
    {
        // Ensure UI is hidden at start
        if (gameOverUI != null)
            gameOverUI.SetActive(false);
            
        if (levelCompleteUI != null)
            levelCompleteUI.SetActive(false);
            
        // Ensure game is running
        Time.timeScale = 1f;
        gameEnded = false;
    }

    public void OnPlayerFailed()
    {
        if (gameEnded) return; // Prevent multiple calls
        
        gameEnded = true;
        Debug.Log("GameManager: Player Failed");
        
        // Show game over UI
        if (gameOverUI != null)
        {
            gameOverUI.SetActive(true);
        }
        else
        {
            Debug.LogWarning("GameManager: Game Over UI not assigned!");
        }
        
        // Optionally pause the game
        if (pauseOnGameOver)
        {
            Time.timeScale = 0f;
        }
    }

    public void OnPlayerWon()
    {
        if (gameEnded) return; // Prevent multiple calls
        
        gameEnded = true;
        Debug.Log("GameManager: Player Won");
        
        // Show level complete UI
        if (levelCompleteUI != null)
        {
            levelCompleteUI.SetActive(true);
        }
        else
        {
            Debug.LogWarning("GameManager: Level Complete UI not assigned!");
        }
        
        // Optionally pause the game
        if (pauseOnLevelComplete)
        {
            Time.timeScale = 0f;
        }
    }

    // Called by UI buttons
    public void RestartLevel()
    {
        Time.timeScale = 1f; // Unpause before reloading
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    // Called by UI buttons
    public void LoadNextLevel()
    {
        Time.timeScale = 1f; // Unpause before loading
        int nextSceneIndex = SceneManager.GetActiveScene().buildIndex + 1;
        
        if (nextSceneIndex < SceneManager.sceneCountInBuildSettings)
        {
            SceneManager.LoadScene(nextSceneIndex);
        }
        else
        {
            Debug.Log("No next level available. Restarting current level.");
            RestartLevel();
        }
    }

    // Called by UI buttons
    public void QuitGame()
    {
        Debug.Log("Quitting game...");
        #if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
        #else
            Application.Quit();
        #endif
    }
}
