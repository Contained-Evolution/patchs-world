import { setupCommunity } from './community.js';
import { registerApp } from './app.js';
registerApp();
const community = setupCommunity(document.getElementById('map'));
const panel = new URLSearchParams(location.search).get('view');
if (panel === 'board' || panel === 'letters') community.openPanel(panel);
