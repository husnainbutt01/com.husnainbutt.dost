import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

import { Capacitor } from '@capacitor/core';

// Register offline-first Service Worker on web browsers (native APK bundles assets locally)
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(<App />);
