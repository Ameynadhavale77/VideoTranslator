// src/popup/popup.js
import { SUPABASE_URL, SUPABASE_KEY, APP_URL } from '../config.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Popup script loaded! 🚀"); // DEBUG LOG
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

  // Forgot Password Elements (Moved here to fix scoping)
  const forgotPasswordLink = document.getElementById('forgot-password-link');
  const forgotPasswordView = document.getElementById('forgot-password-view');
  const sendResetBtn = document.getElementById('sendResetBtn');
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  const resetEmailInput = document.getElementById('reset-email');
  const resetMessage = document.getElementById('reset-message');

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
      const res = await fetch(`${APP_URL}/api/user/credits?token=${supabase_token}`);
      const data = await res.json();
      if (data.balance_seconds !== undefined) {
        const mins = Math.floor(data.balance_seconds / 60);
        document.getElementById('credit-amount').textContent = `${mins} Mins Left`;
      }
    } catch (e) {
      console.error("Failed to fetch credits", e);
      document.getElementById('credit-amount').textContent = "Err";
      // Auto-logout if unauthorized
      if (e.message.includes("401")) {
        await chrome.storage.local.remove(['supabase_token', 'supabase_user']);
        showAuth();
      }
    }
  }

  // --- Event Listeners ---
  document.getElementById('add-credits-btn').addEventListener('click', async () => {
    const { supabase_token } = await chrome.storage.local.get('supabase_token');
    if (supabase_token) {
      const billingUrl = `${APP_URL}/billing?token=${supabase_token}`;
      chrome.tabs.create({ url: billingUrl });
    } else {
      alert("Please login first!");
    }
  });

  document.getElementById('history-link').addEventListener('click', async () => {
    const { supabase_token, supabase_refresh_token } = await chrome.storage.local.get(['supabase_token', 'supabase_refresh_token']);
    if (supabase_token) {
      // Use production URL if available, else localhost
      const dashboardUrl = `${APP_URL}/dashboard?access_token=${supabase_token}&refresh_token=${supabase_refresh_token || ''}`;
      chrome.tabs.create({ url: dashboardUrl });
    } else {
      alert("Please login to see your history.");
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
        supabase_refresh_token: data.refresh_token,
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
          supabase_refresh_token: data.refresh_token,
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
    await chrome.storage.local.remove(['supabase_token', 'supabase_refresh_token', 'supabase_user']);
    currentUser = null;
    token = null;
    showAuth();
  });

  // --- Forgot Password Logic ---
  forgotPasswordLink.addEventListener('click', () => {
    // UX Improvement: Auto-fill email if user already typed it in login box
    if (emailInput.value) {
      resetEmailInput.value = emailInput.value;
    }
    showForgotPassword();
  });

  backToLoginBtn.addEventListener('click', () => {
    showAuth();
  });

  sendResetBtn.addEventListener('click', async () => {
    const email = resetEmailInput.value;
    if (!email) {
      resetMessage.textContent = "Please enter your email";
      resetMessage.className = "error";
      return;
    }

    resetMessage.textContent = "Sending reset link...";
    resetMessage.className = "";

    try {
      // 1. Send Password Recovery Email via Supabase
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY
        },
        // IMPORTANT: The redirect_to MUST point to your Vercel App
        // Example: https://web-psi-eosin-49ke2bfbsd.vercel.app/auth/reset
        body: JSON.stringify({
          email: email,
          redirect_to: 'https://anyvideotranslator.com/auth/reset'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.msg || data.error_description || "Failed to send link");
      }

      resetMessage.textContent = "Check your email for the reset link!";
      resetMessage.className = "success";

    } catch (err) {
      resetMessage.textContent = err.message;
      resetMessage.className = "error";
    }
  });

  // --- View Switching ---
  function showAuth() {
    authView.style.display = 'flex';
    appView.style.display = 'none';
    forgotPasswordView.style.display = 'none';
    statusDiv.style.display = 'none';
  }

  function showForgotPassword() {
    authView.style.display = 'none';
    appView.style.display = 'none';
    forgotPasswordView.style.display = 'flex';
    statusDiv.style.display = 'none';
    resetMessage.textContent = "";
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

  // --- Customization Logic (Colors & Dragging) ---
  const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
  const advancedOptions = document.getElementById('advanced-options');
  const textColorInput = document.getElementById('textColor');
  const bgColorInput = document.getElementById('bgColor');
  const bgOpacityInput = document.getElementById('bgOpacity');
  const opacityValue = document.getElementById('opacityValue');
  const resetColorsBtn = document.getElementById('resetColorsBtn');
  const resetPosBtn = document.getElementById('resetPosBtn');

  // Toggle Advanced Options
  toggleAdvancedBtn.addEventListener('click', () => {
    if (advancedOptions.style.display === 'none') {
      advancedOptions.style.display = 'flex';
      toggleAdvancedBtn.textContent = '⚙️ Hide Advanced Options';
    } else {
      advancedOptions.style.display = 'none';
      toggleAdvancedBtn.textContent = '⚙️ Show Advanced Options';
    }
  });

  // Load Saved Settings
  chrome.storage.local.get(['sub_color', 'sub_bg_color', 'sub_bg_opacity'], (data) => {
    if (data.sub_color) textColorInput.value = data.sub_color;
    if (data.sub_bg_color) bgColorInput.value = data.sub_bg_color;
    if (data.sub_bg_opacity !== undefined) {
      bgOpacityInput.value = data.sub_bg_opacity;
      opacityValue.textContent = data.sub_bg_opacity + "%";
    }
  });

  // Update Text Color
  textColorInput.addEventListener('input', async () => {
    const color = textColorInput.value;
    chrome.storage.local.set({ 'sub_color': color });
    sendStyleUpdate({ color: color });
  });

  // Update Background Color
  bgColorInput.addEventListener('input', async () => {
    const color = bgColorInput.value;
    chrome.storage.local.set({ 'sub_bg_color': color });
    sendStyleUpdate({ bgColor: color });
  });

  // Update Opacity
  bgOpacityInput.addEventListener('input', async () => {
    const opacity = bgOpacityInput.value;
    opacityValue.textContent = opacity + "%";
    chrome.storage.local.set({ 'sub_bg_opacity': opacity });
    sendStyleUpdate({ bgOpacity: opacity });
  });

  // Reset Colors & Opacity
  resetColorsBtn.addEventListener('click', () => {
    // Defaults
    textColorInput.value = "#ffffff";
    bgColorInput.value = "#000000";
    bgOpacityInput.value = "70";
    opacityValue.textContent = "70%";

    chrome.storage.local.remove(['sub_color', 'sub_bg_color', 'sub_bg_opacity']);
    sendStyleUpdate({ color: "#ffffff", bgColor: "#000000", bgOpacity: "70" });

    // Feedback
    const originalText = resetColorsBtn.textContent;
    resetColorsBtn.textContent = "✓ Reset!";
    setTimeout(() => { resetColorsBtn.textContent = originalText; }, 1500);
  });

  // Reset Position
  resetPosBtn.addEventListener('click', async () => {
    chrome.storage.local.remove('sub_position');

    // Send to active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "RESET_POSITION" }).catch(() => { });
    }

    // Feedback
    const originalText = resetPosBtn.textContent;
    resetPosBtn.textContent = "✓ Reset!";
    setTimeout(() => { resetPosBtn.textContent = originalText; }, 1500);
  });

  async function sendStyleUpdate(styleData) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "UPDATE_STYLE", ...styleData }).catch(() => { });
    }
  }

});
