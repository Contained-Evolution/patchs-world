// The "Get the app" button: the browser's own install prompt where it offers one, otherwise the steps for this browser.
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function installSteps(ua = navigator.userAgent, touch = navigator.maxTouchPoints) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'In Safari, tap Share, then Add to Home Screen.';
  if (/Android/.test(ua)) return 'Open your browser menu (⋮) and tap Install app or Add to Home screen.';
  if (/Edg\//.test(ua)) return "Open the browser menu (…), then Apps, then Install Patch's World.";
  if (/Chrome\//.test(ua)) return 'Open the browser menu (⋮), then Cast, save and share, then Install page as app.';
  if (/Safari\//.test(ua)) return 'In Safari, choose File, then Add to Dock.';
  return "This browser can't install apps. Try Chrome, Edge or Safari.";
}

export function setupInstall(button = document.getElementById('install-app'), help = document.getElementById('install-help')) {
  if (!button || installed()) return;
  let offer = null;
  button.hidden = false;
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); offer = event; });
  addEventListener('appinstalled', () => { button.hidden = true; if (help.open) help.close(); });
  button.addEventListener('click', async () => {
    if (offer) {
      const prompt = offer; offer = null;
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') button.hidden = true;
      return;
    }
    help.querySelector('#install-steps').textContent = installSteps();
    help.showModal();
  });
}
