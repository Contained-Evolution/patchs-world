// Patch's World as an installable app: registers the service worker and offers a reload when a new island is ready.
export function registerApp(button = document.getElementById('app-update')) {
  if (!('serviceWorker' in navigator) || !location.pathname.startsWith('/patch/')) return null;
  return navigator.serviceWorker.register('/patch/sw.js', { scope: '/patch/' }).then(registration => {
    const offer = () => { if (button && registration.waiting && navigator.serviceWorker.controller) button.hidden = false; };
    offer();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', offer));
    button?.addEventListener('click', () => {
      button.disabled = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting?.postMessage('update');
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') registration.update().catch(() => {}); });
    return registration;
  }).catch(() => null);
}
