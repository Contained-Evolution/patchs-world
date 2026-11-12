const site = 'https://patch.containedevolution.com';
const journal = `${site}/journal.html`;
const xCallback = `${site}/api/social/x/callback`;
const xHandle = '_Patches_World';
const facebookId = '61596153765155';
const instagramHandle = '_patches_world';
export const drafts = {
  x: {
    account: '@_Patches_World',
    text: `I saw a cloud shaped like a sideways crab. Then I bounced my shiny ball like one. Zoom, zoom, zoom! I wish my sister had seen it. ${journal}`,
  },
  facebook: {
    account: "Patch's World",
    text: `Today I saw a cloud shaped like a sideways crab. Zoom! It made me think of the real crabs at the tide pools.

Then I bounced my shiny ball like a sideways crab. Zoom, zoom, zoom! I bounced it until my legs got sleepy. It is the best toy on the island.

The crab cloud is almost gone now. I wish my sister was here. She would see something silly in it, like a crab wearing a banana hat.

${journal}`,
  },
  instagram: {
    account: '@_patches_world',
    image: `${site}/assets/crab-cloud.jpg`,
    text: `Then I bounced my shiny ball like a sideways crab. Zoom, zoom, zoom! I bounced it until my legs got sleepy. It is the best toy on the island.

The crab cloud is almost gone now. I wish my sister was here. She would see something silly in it, like a crab wearing a banana hat. Then we would make a story together.

From my island journal. Come visit through the link in my profile.`,
  },
};

export function configured(env, platform) {
  return Boolean(platform === 'x' ? env.PATCH_X_CLIENT_ID : env.PATCH_META_PAGE_TOKEN);
}

const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const stateKey = 'social:crab-cloud:x-approval';

export async function authorizeX(storage, env, owner, connect = false) {
  const state = random(), verifier = random();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  await storage.put(stateKey, { state, verifier, owner, connect, expires: Date.now() + 600000 });
  const url = new URL('https://x.com/i/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: env.PATCH_X_CLIENT_ID, redirect_uri: xCallback,
    scope: 'tweet.read tweet.write users.read' + (connect ? ' offline.access' : ''), state, code_challenge: challenge, code_challenge_method: 'S256',
  });
  return url.href;
}

async function api(url, init) {
  const response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Object.assign(new Error(`Platform API returned HTTP ${response.status}.`), { status: response.status });
  return response.json();
}

export async function xHeaders(storage, env, owner, state, code) {
  const approval = await storage.transaction(async txn => {
    const pending = await txn.get(stateKey);
    if (!state || !code || pending?.state !== state || pending.owner !== owner || pending.expires < Date.now()) {
      throw new Error('This X approval expired. Open the draft and try again.');
    }
    await txn.delete(stateKey);
    return pending;
  });
  const tokenSet = await api('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: env.PATCH_X_CLIENT_ID, redirect_uri: xCallback,
      code_verifier: approval.verifier, code,
    }),
  });
  const token = tokenSet.access_token;
  if (!token) throw new Error('X did not provide a user access token.');
  const headers = { Authorization: `Bearer ${token}` };
  const { data } = await api('https://api.x.com/2/users/me', { headers });
  if (data?.username?.toLowerCase() !== xHandle.toLowerCase()) throw new Error(`Sign in to X as @${xHandle}.`);
  if (approval.connect) {
    if (!tokenSet.refresh_token) throw new Error('X did not grant refresh access.');
    await storage.put('social:x-token', { ...tokenSet, expires: Date.now() + tokenSet.expires_in * 1000 });
    return null;
  }
  return headers;
}

export const receiptKey = platform => `social:crab-cloud:receipt:${platform}`;

const meta = 'https://graph.facebook.com/v27.0';
const metaAuth = env => ({ Authorization: `Bearer ${env.PATCH_META_PAGE_TOKEN}` });

export async function verifyMeta(env, platform) {
  if (!env.PATCH_META_PAGE_TOKEN) throw new Error('Connect the Meta Page token.');
  const identity = await api(`${meta}/me?fields=id,instagram_business_account%7Bid,username%7D`, { headers: metaAuth(env) });
  if (identity.id !== facebookId) throw new Error('The Meta token must belong to the Patch’s World Page.');
  if (platform === 'instagram' && identity.instagram_business_account?.username?.toLowerCase() !== instagramHandle) {
    throw new Error('Meta did not return the linked Patch Instagram account.');
  }
  return identity.instagram_business_account;
}

export async function storedXHeaders(storage, env) {
  const token = await storage.get('social:x-token');
  const reconnect = () => Object.assign(new Error('Reconnect Patch’s X account.'), { reconnect: true });
  if (!token?.refresh_token) throw reconnect();
  if (token.expires > Date.now() + 60000) return { Authorization: `Bearer ${token.access_token}` };
  let updated;
  try {
    updated = await api('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token', client_id: env.PATCH_X_CLIENT_ID, refresh_token: token.refresh_token,
      }),
    });
  } catch (error) {
    if (/HTTP (400|401|403)\./.test(error.message)) {
      await storage.transaction(async txn => {
        if ((await txn.get('social:x-token'))?.refresh_token === token.refresh_token) await txn.delete('social:x-token');
      });
      throw reconnect();
    }
    throw error;
  }
  if (!updated.access_token || !updated.refresh_token) throw reconnect();
  await storage.put('social:x-token', { ...updated, expires: Date.now() + updated.expires_in * 1000 });
  return { Authorization: `Bearer ${updated.access_token}` };
}

export async function publish(storage, env, platform, xAuth, draft = drafts[platform], key = receiptKey(platform)) {
  const metaHeaders = metaAuth(env);
  const ig = platform === 'x' ? null : await verifyMeta(env, platform);
  await storage.transaction(async txn => {
    if (await txn.get(key)) throw new Error('This draft already has a submission record. Check the account before sending again.');
    await txn.put(key, { state: 'submitted' });
  });
  let result;
  try {
    if (platform === 'x') {
      result = (await api('https://api.x.com/2/tweets', {
        method: 'POST', headers: { ...xAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.text }),
      })).data;
    } else if (platform === 'facebook') {
      result = await api(`${meta}/${facebookId}/${draft.image ? 'photos' : 'feed'}`, {
        method: 'POST', headers: metaHeaders, body: new URLSearchParams(draft.image ? { url: draft.image, caption: draft.text } : { message: draft.text }),
      });
    } else {
      let container;
      try {
        container = await api(`${meta}/${ig.id}/media`, {
          method: 'POST', headers: metaHeaders,
          body: new URLSearchParams({ image_url: draft.image, caption: draft.text }),
        });
        if (!container.id) throw new Error('Instagram did not return a media container.');
        for (let attempt = 0; attempt < 5; attempt++) {
          const { status_code: status } = await api(`${meta}/${container.id}?fields=status_code`, { headers: metaHeaders });
          if (status === 'FINISHED') break;
          if (status !== 'IN_PROGRESS' || attempt === 4) throw new Error('Instagram could not prepare the draft image.');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        // A media container alone is private. It is safe to retry this step.
        await storage.delete(key);
        return { state: 'error', error: error.message };
      }
      result = await api(`${meta}/${ig.id}/media_publish`, {
        method: 'POST', headers: metaHeaders, body: new URLSearchParams({ creation_id: container.id }),
      });
    }
    if (!result?.id) throw new Error('Missing platform post ID.');
  } catch (error) {
    if ([400, 401, 403, 404, 422, 429].includes(error.status)) {
      await storage.delete(key);
      return { state: 'error', error: error.message };
    }
    return { state: 'submitted', error: 'The platform did not confirm publication. Check the account before retrying.' };
  }
  const id = result.post_id || result.id;
  let url = platform === 'x' ? `https://x.com/${xHandle}/status/${id}` : `https://www.facebook.com/${id}`;
  if (platform === 'instagram') {
    url = `https://www.instagram.com/${instagramHandle}/`;
    try {
      const { permalink } = await api(`${meta}/${id}?fields=permalink`, { headers: metaHeaders });
      if (permalink?.startsWith('https://www.instagram.com/')) url = permalink;
    } catch {}
  }
  const receipt = { state: 'published', id, url };
  await storage.put(key, receipt);
  return receipt;
}
