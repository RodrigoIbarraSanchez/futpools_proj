import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Desktop-only styles. Self-scoped under .fp-desktop-shell so importing
// them globally is safe — mobile pages never inherit the rules.
import './desktop/desktop.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
