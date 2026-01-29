using UnityEngine;

/// <summary>
/// Simple script for doors that allows players to pass through them
/// Attach this to door objects to make them non-blocking
/// </summary>
public class Door : MonoBehaviour
{
    [Header("Door Settings")]
    [Tooltip("The color/type of this door for identification")]
    public string doorColor = "Green"; // "Green" or "Red"
    
    void Start()
    {
        // Ensure the door has a collider set as trigger
        Collider col = GetComponent<Collider>();
        if (col != null)
        {
            col.isTrigger = true;
        }
        else
        {
            Debug.LogWarning($"Door '{gameObject.name}' doesn't have a collider! Add a Box Collider and set it as trigger.");
        }
    }
    
    void OnTriggerEnter(Collider other)
    {
        // Optional: Add visual or audio feedback when player passes through
        if (other.CompareTag("Player"))
        {
            Debug.Log($"Player passed through {doorColor} door");
        }
    }
}
