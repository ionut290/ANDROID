(function () {
  const state = {
    firebaseApp: null,
    firebaseAuth: null,
  };

  function isNativeAndroidCapacitor() {
    const capacitor = window.Capacitor;
    if (!capacitor) {
      return false;
    }

    if (typeof capacitor.isNativePlatform === 'function' && !capacitor.isNativePlatform()) {
      return false;
    }

    if (typeof capacitor.getPlatform === 'function') {
      return capacitor.getPlatform() === 'android';
    }

    return false;
  }

  function getNativeFirebaseAuthPlugin() {
    return window.Capacitor?.Plugins?.FirebaseAuthentication || null;
  }

  async function loginGoogleNativeAndroid() {
    const plugin = getNativeFirebaseAuthPlugin();
    if (!plugin || typeof plugin.signInWithGoogle !== 'function') {
      throw new Error('FirebaseAuthentication plugin non disponibile su Android.');
    }

    return plugin.signInWithGoogle();
  }

  function getFirebaseConfig() {
    const configTag = document.querySelector('meta[name="firebase-config"]');
    if (!configTag || !configTag.content) {
      throw new Error('Configurazione Firebase mancante (meta firebase-config).');
    }

    return JSON.parse(configTag.content);
  }

  async function ensureFirebaseWebAuth() {
    if (state.firebaseAuth) {
      return state.firebaseAuth;
    }

    const config = getFirebaseConfig();

    if (!window.firebase?.apps?.length) {
      state.firebaseApp = window.firebase.initializeApp(config);
    } else {
      state.firebaseApp = window.firebase.app();
    }

    state.firebaseAuth = window.firebase.auth();
    return state.firebaseAuth;
  }

  async function loginGoogleWeb() {
    if (!window.firebase?.auth) {
      throw new Error('Firebase Web SDK non caricato.');
    }

    const auth = await ensureFirebaseWebAuth();
    const provider = new window.firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  }

  async function signOutCurrentSession() {
    if (isNativeAndroidCapacitor()) {
      const plugin = getNativeFirebaseAuthPlugin();
      if (plugin && typeof plugin.signOut === 'function') {
        await plugin.signOut();
      }
      return;
    }

    if (window.firebase?.auth) {
      const auth = await ensureFirebaseWebAuth();
      await auth.signOut();
    }
  }

  async function handleLogin() {
    if (isNativeAndroidCapacitor()) {
      return loginGoogleNativeAndroid();
    }

    return loginGoogleWeb();
  }

  function setupUserPanelToggle() {
    const toggleButton = document.getElementById('user-toggle-btn');
    const panel = document.getElementById('user-details-panel');

    if (!toggleButton || !panel) {
      return;
    }

    toggleButton.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('is-open');
      panel.hidden = !isOpen;
    });
  }

  function setupAuthButtons() {
    const loginButton = document.getElementById('login-btn');
    const switchAccountButton = document.getElementById('switch-account-btn');

    if (loginButton) {
      loginButton.addEventListener('click', async () => {
        await handleLogin();
      });
    }

    if (switchAccountButton) {
      switchAccountButton.addEventListener('click', async () => {
        await signOutCurrentSession();
        await handleLogin();
      });
    }
  }

  function initApp() {
    setupAuthButtons();
    setupUserPanelToggle();
  }

  document.addEventListener('DOMContentLoaded', initApp, { once: true });

  window.HeraAuth = {
    handleLogin,
    loginGoogleNativeAndroid,
    loginGoogleWeb,
    signOutCurrentSession,
    isNativeAndroidCapacitor,
  };
})();
