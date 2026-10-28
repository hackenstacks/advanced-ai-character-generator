import React from 'react';
import ReactDOM from 'react-dom/client';
// Install the NeXuS proxy interceptor BEFORE anything makes a fetch — routes provider
// API calls through the same-origin server proxy so the browser never holds an sk_ key.
import { installNexusProxy } from './services/nexusProxy';
installNexusProxy();
import App from './App';
// Inter font, vendored locally (offline — no Google Fonts CDN).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
// Styles processed by Vite + Tailwind (offline — no cdn.tailwindcss.com).
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);