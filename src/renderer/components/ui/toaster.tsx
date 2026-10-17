import React from 'react';

export function Toaster() {
  return <div id="toast-container" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" />;
}

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = [
    'px-4 py-3 rounded-lg text-sm font-medium shadow-lg animate-fade-in pointer-events-auto',
    type === 'success' ? 'bg-primary text-primary-foreground' :
    type === 'error' ? 'bg-destructive text-destructive-foreground' :
    'bg-card text-card-foreground border border-border',
  ].join(' ');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s ease';
    setTimeout(() => el.remove(), 200);
  }, 2800);
}
