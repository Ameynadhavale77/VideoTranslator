// src/popup/popup.js
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const authView = document.getElementById('auth-view');
  const appView = document.getElementById('app-view');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const authMessage = document.getElementById('auth-message');
  const toggleBtn = document.getElementById('toggleBtn');
  const statusDiv = document.getElementById('status');
  const userDisplay = document.getElementById('user-display');
  const logoutLink = document.getElementById('logout-link');

  // --- State Management ---
  let currentUser = null;
  let token = null;

  // Check if user is already logged in
  const stored = await chrome.storage.local.get(['supabase_token', 'supabase_user']);
  if (stored.supabase_token && stored.supabase_user) {
    currentUser = stored.supabase_user;
    token = stored.supabase_token;
    showApp();
  } else {
    showAuth();
  }

  // --- Auth Functions ---
  async function supabaseAuth(action, email, password) {
    const endpoint = action === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
    const url = `${SUPABASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.error_description || data.message || "Auth failed");
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async function updateCreditsDisplay() {
    const { supabase_token } = await chrome.storage.local.get('supabase_token');
    if (!supabase_token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/user/credits?token=${supabase_token}`);
      const data = await res.json();
      if (data.balance_seconds !== undefined) {
        const mins = Math.floor(data.balance_seconds / 60);
        document.getElementById('credit-amount').textContent = `${mins} Mins Left`;
      }
    } catch (e) {
      console.error("Failed to fetch credits", e);
    }
  }

  // --- Event Listeners ---
  document.getElementById('add-credits-btn').addEventListener('click', async () => {
    const { supabase_token } = await chrome.storage.local.get('supabase_token');
    if (supabase_token) {
      const billingUrl = `http://localhost:3000/billing?token=${supabase_token}`;
      chrome.tabs.create({ url: billingUrl });
    } else {
      alert("Please login first!");
    }
  });

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
      authMessage.textContent = "Please enter email and password";
      authMessage.className = "error";
      return;
    }

    authMessage.textContent = "Logging in...";
    authMessage.className = "";

    try {
      const data = await supabaseAuth('login', email, password);
      // Save Session
      token = data.access_token;
      currentUser = data.user;

      await chrome.storage.local.set({
        supabase_token: token,
        supabase_user: currentUser
      });

      authMessage.textContent = "Success!";
      showApp();
    } catch (err) {
      authMessage.textContent = err.message;
      authMessage.className = "error";
    }
  });

  signupBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
      authMessage.textContent = "Please enter email and password";
      authMessage.className = "error";
      return;
    }

    authMessage.textContent = "Creating account...";
    authMessage.className = "";

    try {
      const data = await supabaseAuth('signup', email, password);
      // Auto login after signup usually works if email confirm is off, 
      // otherwise data.user exists but no session.
      if (data.access_token) {
        token = data.access_token;
        currentUser = data.user;
        await chrome.storage.local.set({
          supabase_token: token,
          supabase_user: currentUser
        });
        showApp();
      } else {
        authMessage.textContent = "Account created! Please check email/login.";
        authMessage.className = "success";
      }
    } catch (err) {
      authMessage.textContent = err.message;
      authMessage.className = "error";
    }
  });

  logoutLink.addEventListener('click', async () => {
    await chrome.storage.local.remove(['supabase_token', 'supabase_user']);
    currentUser = null;
    token = null;
    showAuth();
  });

  // --- View Switching ---
  function showAuth() {
    authView.style.display = 'flex';
    appView.style.display = 'none';
    statusDiv.style.display = 'none';
  }

  function showApp() {
    authView.style.display = 'none';
    appView.style.display = 'flex';
    statusDiv.style.display = 'block';
    userDisplay.textContent = currentUser.email;
    updateCreditsDisplay();

    // Restore Language Selection
    chrome.storage.local.get(['stored_language', 'stored_target_language'], (data) => {
      if (data.stored_language) {
        document.getElementById('language').value = data.stored_language;
      }
      if (data.stored_target_language) {
        document.getElementById('targetLanguage').value = data.stored_target_language;
      }
    });

    // Sync button state
    chrome.runtime.sendMessage({ action: "GET_STATUS" }, (response) => {
      if (response && response.isRecording) {
        updateButton(true);
      }
    });
  }

  // --- Original App Logic ---
  toggleBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const language = document.getElementById('language').value || 'en';
    const targetLanguage = document.getElementById('targetLanguage').value || 'same';

    if (!tab) {
      statusDiv.textContent = "Error: No active tab found.";
      return;
    }

    // Pass the TOKEN to the background script
    chrome.runtime.sendMessage({
      action: "TOGGLE_CAPTURE",
      tabId: tab.id,
      language: language,
      targetLanguage: targetLanguage,
      token: token // <--- NEW: Sending Auth Token
    }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
      } else {
        statusDiv.textContent = response.status;
        updateButton(response.isRecording);
      }
    });
  });

  // --- Language Persistence ---
  const langSelect = document.getElementById('language');
  const targetLangSelect = document.getElementById('targetLanguage');

  // Save on change
  langSelect.addEventListener('change', () => {
    chrome.storage.local.set({ 'stored_language': langSelect.value });
  });

  targetLangSelect.addEventListener('change', () => {
    chrome.storage.local.set({ 'stored_target_language': targetLangSelect.value });
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
