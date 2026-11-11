const AUTH = 'https://auth.containedevolution.com';
const COOKIE = 'ce_session';
const TOKEN = /^[A-Za-z0-9_-]{32,96}$/;
export const ADMIN_EMAIL = 'containedevolution@gmail.com';

// Sign-in returns the visitor to Patch's World.
export const SIGN_IN = '/';

function cookie(request, name) {
  return (request.headers.get('cookie') || '').split(/;\s*/)
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

// { id, name, admin } for a signed-in account holder, or null.
export async function visitor(request, env) {
  const token = cookie(request, COOKIE);
  if (!TOKEN.test(token)) return null;
  const me = await env.AUTH_SERVICE.fetch(new Request(`${AUTH}/api/me`, {
    headers: { cookie: `ce_session=${token}` },
  }));
  if (me.status === 401) return null;
  if (!me.ok) throw Error('Account check failed.');
  const { user } = await me.json();
  if (!user?.id) return null;
  return { id: String(user.id), name: user.gamertag || user.username || 'a friend', admin: user.email === ADMIN_EMAIL };
}
