import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';

const callback = 'http://127.0.0.1:43138/callback';
const expectedHandle = '_Patches_World';
const clientId = process.env.PATCH_X_CLIENT_ID;
const [draftPath, mode] = process.argv.slice(2);

async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`X API returned HTTP ${response.status}.`);
  return response.json();
}

async function authorize() {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const authorizeUrl = new URL('https://x.com/i/oauth2/authorize');
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: callback,
    scope: 'tweet.read tweet.write users.read', state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, callback);
      if (req.method !== 'GET' || req.headers.host !== '127.0.0.1:43138' ||
          url.pathname !== '/callback' || url.searchParams.get('state') !== state) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(code ? 'Return to the terminal to continue.' : 'Authorization was declined.');
      close();
      if (code) resolve(code);
      else reject(new Error('X authorization was declined.'));
    });
    function close() {
      clearTimeout(timer);
      server.close();
    }
    const timer = setTimeout(() => {
      close();
      reject(new Error('X authorization timed out.'));
    }, 300000);
    server.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    server.listen(43138, '127.0.0.1', () => console.log(`Open this link as @${expectedHandle}:\n${authorizeUrl}`));
  });
  const token = await request('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: clientId, redirect_uri: callback,
      code_verifier: verifier, code,
    }),
  });
  if (!token.access_token || !token.scope?.split(' ').includes('tweet.write')) {
    throw new Error('X did not grant posting access.');
  }
  return { Authorization: `Bearer ${token.access_token}` };
}

async function main() {
  if (!draftPath || (mode && mode !== '--connect' && mode !== '--publish')) {
    throw new Error('Usage: node tools/x-publisher.mjs DRAFT.txt [--connect | --publish]');
  }
  const text = (await readFile(draftPath, 'utf8')).trim();
  if (!text || text.length > 280) throw new Error('Provide a nonempty draft of at most 280 characters.');
  console.log(`Draft for @${expectedHandle}:\n\n${text}\n`);
  if (!mode) return;
  if (!clientId) throw new Error('Set PATCH_X_CLIENT_ID to the OAuth 2.0 Client ID.');
  const headers = await authorize();
  const { data: user } = await request('https://api.x.com/2/users/me', { headers });
  if (user?.username?.toLowerCase() !== expectedHandle.toLowerCase()) {
    throw new Error(`Sign in as @${expectedHandle} before continuing.`);
  }
  console.log(`Verified @${user.username} with write permission.`);
  if (mode === '--connect') return;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (await terminal.question('Type PUBLISH to approve this exact draft for public posting: ') !== 'PUBLISH') return;
  } finally {
    terminal.close();
  }
  // An uncertain response must be reconciled on X before resubmitting this draft.
  const receipt = `${draftPath}.x-receipt.json`;
  await writeFile(receipt, JSON.stringify({ account: user.username, status: 'pending', text }), { flag: 'wx' });
  const result = await request('https://api.x.com/2/tweets', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const id = result.data?.id;
  if (!id || !/^\d+$/.test(id)) throw new Error('Check the X timeline before attempting another submission.');
  await writeFile(receipt, JSON.stringify({ account: user.username, status: 'published', id, text }));
  console.log(`Published: https://x.com/${expectedHandle}/status/${id}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
