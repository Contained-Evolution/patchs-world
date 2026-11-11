import { setupCommunity } from './community.js';
const community = setupCommunity(document.getElementById('map'));
const panel = new URLSearchParams(location.search).get('view');
if (panel === 'board' || panel === 'letters') community.openPanel(panel);
