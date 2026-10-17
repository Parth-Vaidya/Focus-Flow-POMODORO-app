import React from 'react';
import ReactDOM from 'react-dom/client';
import FloatingWidget from './widget/FloatingWidget';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('widget-root')!).render(
  <React.StrictMode>
    <FloatingWidget />
  </React.StrictMode>
);
