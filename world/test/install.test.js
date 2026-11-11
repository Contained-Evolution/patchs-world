import test from 'node:test';
import assert from 'node:assert/strict';
import { installSteps } from '../src/install.js';

test('install steps match the browser', () => {
  assert.match(installSteps('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', 5), /Add to Home Screen/);
  assert.match(installSteps('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 5), /Add to Home Screen/);
  assert.match(installSteps('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 0), /Add to Dock/);
  assert.match(installSteps('Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36', 5), /Install app/);
  assert.match(installSteps('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0', 0), /Apps/);
  assert.match(installSteps('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36', 0), /Install page as app/);
  assert.match(installSteps('Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0', 0), /can't install/);
});
