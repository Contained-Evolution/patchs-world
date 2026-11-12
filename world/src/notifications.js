// The Notifications panel in the island menu: this device's choices for Patch's replies and journal entries.
const key = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));

export function setupNotifications(dialog, community, app) {
  const $ = selector => dialog.querySelector(selector);
  const form = $('#alerts-form'), choices = { letters: $('#alerts-letters'), journal: $('#alerts-journal'), social: $('#alerts-social') };
  // On iPhone and iPad, web notifications work only from an app on the Home Screen.
  const iosBrowser = (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) && !navigator.standalone;

  function notice(message) { $('#alerts-notice').textContent = message || ''; $('#alerts-notice').hidden = !message; }
  async function api(path, body) {
    const response = await fetch(`/api${path}`, body ? { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { credentials: 'same-origin', cache: 'no-store' });
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: response.status });
    return data;
  }
  const blocked = () => notice('Notifications are blocked for this site. Allow them in your browser settings, then come back.');

  async function refresh() {
    form.hidden = true; $('#alerts-signin').hidden = true; $('#alerts-install').hidden = true; notice('');
    if (iosBrowser) { $('#alerts-install').hidden = false; return; }
    const registration = await app;
    if (!registration || !('PushManager' in window) || !('Notification' in window)) { notice("This browser can't show Patch's notifications."); return; }
    try {
      const { user } = await api('/me');
      $('#alerts-social-label').hidden = !user?.admin;
      if (!user) { $('#alerts-signin').hidden = false; return; }
      const status = await api('/push');
      if (!status.publicKey) { notice('Notifications are not set up yet.'); return; }
      const subscription = await registration.pushManager.getSubscription();
      const mine = subscription && status.devices.find(device => device.endpoint === subscription.endpoint);
      choices.letters.checked = !!mine?.letters; choices.journal.checked = !!mine?.journal; choices.social.checked = !!(user.admin && mine?.social);
      if (Notification.permission === 'denied') blocked();
      form.hidden = false;
    } catch (error) { notice(error.message); }
  }

  async function save() {
    const wanted = { letters: choices.letters.checked, journal: choices.journal.checked, social: !$('#alerts-social-label').hidden && choices.social.checked };
    Object.values(choices).forEach(box => { box.disabled = true; });
    notice('');
    try {
      const registration = await app;
      let subscription = await registration.pushManager.getSubscription();
      if (!wanted.letters && !wanted.journal && !wanted.social) {
        if (subscription) { await api('/push/remove', { endpoint: subscription.endpoint }); await subscription.unsubscribe(); }
        notice('Notifications are off on this device.');
        return;
      }
      if (await Notification.requestPermission() !== 'granted') { Object.values(choices).forEach(box => { box.checked = false; }); blocked(); return; }
      subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key((await api('/push')).publicKey) });
      await api('/push', { subscription: subscription.toJSON(), ...wanted });
      notice('Saved. Patch will let you know on this device.');
    } catch (error) {
      // Show what this device really has, then why it didn't change.
      await refresh();
      if (error.status !== 401) notice(error.status ? error.message : "Notifications couldn't be turned on in this browser.");
    }
    finally { Object.values(choices).forEach(box => { box.disabled = false; }); }
  }

  document.querySelector('#open-alerts').addEventListener('click', event => { community.showPanel('alerts', !!event.currentTarget.closest('#more-panel')); refresh(); });
  Object.values(choices).forEach(box => box.addEventListener('change', save));
  // Back from signing in: check again.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !$('#alerts-panel').hidden && !$('#alerts-signin').hidden) refresh(); });
}
