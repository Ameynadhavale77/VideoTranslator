document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleBtn');
  const apiKeyInput = document.getElementById('apiKey');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  const { deepgramKey } = await chrome.storage.local.get('deepgramKey');
  if (deepgramKey) {
    apiKeyInput.value = deepgramKey;
  }

  // Check status on load to set button text correctly
  chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
    if (response) {
      updateButton(response.isRecording);
    }
  });

  // Save key when changed
  apiKeyInput.addEventListener('change', () => {
    chrome.storage.local.set({ deepgramKey: apiKeyInput.value });
  });

  toggleBtn.addEventListener('click', async () => {
    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const language = document.getElementById('language').value || 'en';
    const targetLanguage = document.getElementById('targetLanguage').value || 'same';

    if (!tab) {
      statusDiv.textContent = "Error: No active tab found.";
      return;
    }

    // 2. Send message to Background Script to toggle recording
    chrome.runtime.sendMessage({
      action: "TOGGLE_CAPTURE",
      tabId: tab.id,
      apiKey: apiKeyInput.value,
      language: language,
      targetLanguage: targetLanguage
    }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
      } else {
        statusDiv.textContent = response.status;
        updateButton(response.isRecording);
      }
    });
  });

  function updateButton(isRecording) {
    if (isRecording) {
      toggleBtn.textContent = "Stop Translating";
      toggleBtn.classList.add('recording');
    } else {
      toggleBtn.textContent = "Start Translating";
      toggleBtn.classList.remove('recording');
    }
  }
});
