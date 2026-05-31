import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import './styles/index.css'
import App from './App.jsx'

window.onerror = function(message, source, lineno) {
  console.error("Global JS Error: " + message + " at " + source + ":" + lineno);
  return false;
};

// Request notification permissions early for native apps
if (Capacitor.isNativePlatform()) {
  LocalNotifications.requestPermissions().then(result => {
    console.log("Notification permission result:", result.display);
  });
}

try {
  const platform = Capacitor.getPlatform();
  if (platform) {
    document.body.classList.add(`platform-${platform}`);
    if (platform !== 'web') {
      document.body.classList.add('is-native');
    }
  }
} catch (e) {
  console.error("Capacitor platform check failed", e);
}

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } else {
    throw new Error("Root element #root not found in DOM");
  }
} catch (renderError) {
  console.error("Initial Render Failed", renderError);
  alert("Render Error: " + renderError.message);
}
