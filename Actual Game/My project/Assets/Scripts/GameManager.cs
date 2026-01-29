using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.InputSystem;

public class GameManager : MonoBehaviour
{
    [Header("UI References")]
    public GameObject welcomeScreenUI;
    public GameObject gameOverUI;
    public GameObject levelCompleteUI;
    
    [Header("Settings")]
    public bool pauseOnGameOver = true;
    public bool pauseOnLevelComplete = true;

    private bool gameEnded = false;
    private bool gameStarted = false;

    void Start()
    {
        // Show welcome screen and pause game
        if (welcomeScreenUI != null)
        {
            welcomeScreenUI.SetActive(true);
            Time.timeScale = 0f; // Pause the game
            gameStarted = false;
        }
        else
        {
            // If no welcome screen, start game immediately
            gameStarted = true;
            Time.timeScale = 1f;
        }
        
        // Ensure other UI is hidden at start
        if (gameOverUI != null)
            gameOverUI.SetActive(false);
            
        if (levelCompleteUI != null)
            levelCompleteUI.SetActive(false);
            
        gameEnded = false;
    }

    void Update()
    {
        // Check for any click/tap to start the game using new Input System
        if (!gameStarted && welcomeScreenUI != null && welcomeScreenUI.activeSelf)
        {
            // Use new Input System API - check for mouse clicks or any key press
            bool mouseClicked = Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame;
            bool keyPressed = Keyboard.current != null && Keyboard.current.anyKey.wasPressedThisFrame;
            
            if (mouseClicked || keyPressed)
            {
                StartGame();
            }
        }
    }

    public void StartGame()
    {
        if (gameStarted) return;
        
        gameStarted = true;
        
        // Hide welcome screen
        if (welcomeScreenUI != null)
            welcomeScreenUI.SetActive(false);
        
        // Start the game
        Time.timeScale = 1f;
        Debug.Log("Game Started!");
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
