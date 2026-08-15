// Cloudflare Worker backend for APDF417
// Routes: Auth, Token Manager, PDF417 API proxy

const UPSTREAM_BASE = 'https://pdf417.pro';

const DEFAULT_CONFIG = {
  admin: {
    username: 'admin',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' // SHA-256 of 'admin'
  },
  tokens: [
    // { id: string, name: string, token: string, active: boolean, info: object, lastCheck: string }
  ]
};

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getStore(env) {
  if (env.APDF417_KV) {
    const raw = await env.APDF417_KV.get('config', 'json');
    if (raw) return raw;
  }
  // In-memory fallback (per-isolate; survives within same isolate, lost on cold start)
  if (!globalThis.__APDF417_STORE__) {
    globalThis.__APDF417_STORE__ = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  return globalThis.__APDF417_STORE__;
}

async function saveStore(env, store) {
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('config', JSON.stringify(store));
  }
  // For in-memory fallback, store is already a reference to globalThis.__APDF417_STORE__
}

const HISTORY_MAX = 100;

async function getHistory(env) {
  if (env.APDF417_KV) {
    const raw = await env.APDF417_KV.get('history', 'json');
    if (raw) return raw;
  }
  if (!globalThis.__APDF417_HISTORY__) {
    globalThis.__APDF417_HISTORY__ = [];
  }
  return globalThis.__APDF417_HISTORY__;
}

async function saveHistory(env, history) {
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('history', JSON.stringify(history));
  }
  // In-memory: history is already a reference to globalThis.__APDF417_HISTORY__
}

async function checkAuth(req, env) {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  
  // JWT-like simple session validation or token match
  const store = await getStore(env);
  const adminHash = env.ADMIN_PASS
    ? await sha256(env.ADMIN_PASS)
    : (store.admin?.passwordHash || DEFAULT_CONFIG.admin.passwordHash);
  const expectedToken = await sha256(`session:${adminHash}`);
  
  if (token === expectedToken) {
    return { username: env.ADMIN_USER || store.admin?.username || 'admin' };
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, AUTH-TOKEN'
    }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, AUTH-TOKEN'
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // 1. Auth: Login
      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await request.json();
        const store = await getStore(env);
        const adminUser = env.ADMIN_USER || store.admin?.username || 'admin';
        const adminHash = env.ADMIN_PASS
          ? await sha256(env.ADMIN_PASS)
          : (store.admin?.passwordHash || DEFAULT_CONFIG.admin.passwordHash);
        const inputHash = await sha256(body.password || '');

        if (body.username === adminUser && inputHash === adminHash) {
          const sessionToken = await sha256(`session:${adminHash}`);
          return json({ success: true, token: sessionToken, username: adminUser });
        }
        return json({ error: 'Invalid username or password' }, 401);
      }

      // 2. Auth: Change password
      if (path === '/api/auth/change-password' && request.method === 'POST') {
        const user = await checkAuth(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        if (!body.newPassword || body.newPassword.length < 4) {
          return json({ error: 'Password must be at least 4 characters' }, 400);
        }

        const store = await getStore(env);
        const currentHash = store.admin?.passwordHash || DEFAULT_CONFIG.admin.passwordHash;
        const oldHash = await sha256(body.oldPassword || '');

        if (oldHash !== currentHash) {
          return json({ error: 'Current password incorrect' }, 400);
        }

        store.admin = store.admin || {};
        if (body.newUsername) store.admin.username = body.newUsername;
        store.admin.passwordHash = await sha256(body.newPassword);
        await saveStore(env, store);

        const newSessionToken = await sha256(`session:${store.admin.passwordHash}`);
        return json({ success: true, token: newSessionToken, message: 'Password changed successfully' });
      }

      // 3. Auth Check
      if (path === '/api/auth/me') {
        const user = await checkAuth(request, env);
        if (!user) return json({ authenticated: false }, 401);
        return json({ authenticated: true, user });
      }

      // Require auth for all other API endpoints
      if (path.startsWith('/api/')) {
        const user = await checkAuth(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
      }

      // History Endpoints
      if (path === '/api/history' && request.method === 'GET') {
        const history = await getHistory(env);
        return json({ history });
      }

      if (path === '/api/history' && request.method === 'DELETE') {
        if (env.APDF417_KV) {
          await env.APDF417_KV.put('history', JSON.stringify([]));
        }
        globalThis.__APDF417_HISTORY__ = [];
        return json({ success: true, history: [] });
      }

      // 4. Token Management
      if (path === '/api/tokens' && request.method === 'GET') {
        const store = await getStore(env);
        return json({ tokens: store.tokens || [] });
      }

      if (path === '/api/tokens' && request.method === 'POST') {
        const body = await request.json();
        if (!body.token) return json({ error: 'Token is required' }, 400);

        const store = await getStore(env);
        store.tokens = store.tokens || [];

        const newToken = {
          id: 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          name: body.name || 'API Token ' + (store.tokens.length + 1),
          token: body.token.trim(),
          active: store.tokens.length === 0, // default true if first
          info: null,
          lastCheck: null,
          createdAt: new Date().toISOString()
        };

        // Try checking account info immediately
        try {
          const res = await fetch(`${UPSTREAM_BASE}/api/get_account_info/`, {
            headers: { 'AUTH-TOKEN': newToken.token }
          });
          const info = await res.json();
          if (res.ok && !info.error) {
            newToken.info = info;
            newToken.lastCheck = new Date().toISOString();
          } else {
            newToken.info = { error: info.meaning || info.message || 'Invalid token' };
          }
        } catch (e) {
          newToken.info = { error: e.message };
        }

        store.tokens.push(newToken);
        await saveStore(env, store);
        return json({ success: true, token: newToken });
      }

      if (path.match(/^\/api\/tokens\/([^/]+)\/toggle$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        const store = await getStore(env);
        store.tokens = (store.tokens || []).map(t => ({
          ...t,
          active: t.id === id
        }));
        await saveStore(env, store);
        return json({ success: true, tokens: store.tokens });
      }

      if (path.match(/^\/api\/tokens\/([^/]+)$/) && request.method === 'DELETE') {
        const id = path.split('/')[3];
        const store = await getStore(env);
        store.tokens = (store.tokens || []).filter(t => t.id !== id);
        if (store.tokens.length > 0 && !store.tokens.some(t => t.active)) {
          store.tokens[0].active = true;
        }
        await saveStore(env, store);
        return json({ success: true, tokens: store.tokens });
      }

      if (path.match(/^\/api\/tokens\/([^/]+)\/check$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        const store = await getStore(env);
        const item = (store.tokens || []).find(t => t.id === id);
        if (!item) return json({ error: 'Token not found' }, 404);

        const res = await fetch(`${UPSTREAM_BASE}/api/get_account_info/`, {
          headers: { 'AUTH-TOKEN': item.token }
        });
        const info = await res.json();
        item.info = res.ok ? info : { error: info.meaning || info.message || 'Check failed' };
        item.lastCheck = new Date().toISOString();
        await saveStore(env, store);

        return json({ success: true, token: item });
      }

      if (path === '/api/tokens/check-all' && request.method === 'POST') {
        const store = await getStore(env);
        store.tokens = await Promise.all((store.tokens || []).map(async item => {
          try {
            const res = await fetch(`${UPSTREAM_BASE}/api/get_account_info/`, {
              headers: { 'AUTH-TOKEN': item.token }
            });
            const info = await res.json();
            return {
              ...item,
              info: res.ok ? info : { error: info.meaning || 'Check failed' },
              lastCheck: new Date().toISOString()
            };
          } catch (e) {
            return { ...item, info: { error: e.message }, lastCheck: new Date().toISOString() };
          }
        }));
        await saveStore(env, store);
        return json({ success: true, tokens: store.tokens });
      }

      // Helper to select auth token for upstream call
      const getActiveApiToken = async (reqTokenHeader) => {
        if (reqTokenHeader) return reqTokenHeader;
        const store = await getStore(env);
        const active = (store.tokens || []).find(t => t.active);
        if (active) return active.token;
        if (store.tokens && store.tokens.length > 0) return store.tokens[0].token;
        return null;
      };

      // 5. Proxy API: Get available states
      if (path === '/api/pdf417/states' && request.method === 'GET') {
        const token = await getActiveApiToken(request.headers.get('AUTH-TOKEN'));
        if (!token) return json({ error: 'No active PDF417 API Token available' }, 400);

        const res = await fetch(`${UPSTREAM_BASE}/api/get_available_states`, {
          headers: { 'AUTH-TOKEN': token }
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // 6. Proxy API: Get fields (brief or full)
      if (path === '/api/pdf417/fields' && request.method === 'GET') {
        const state = url.searchParams.get('state') || 'CA';
        const type = url.searchParams.get('type') || 'full'; // brief | full
        const token = await getActiveApiToken(request.headers.get('AUTH-TOKEN'));
        if (!token) return json({ error: 'No active PDF417 API Token available' }, 400);

        const endpoint = type === 'brief'
          ? `${UPSTREAM_BASE}/api/get_barcode_fields_brief_info/?state=${encodeURIComponent(state)}`
          : `${UPSTREAM_BASE}/api/get_barcode_fields_full_info/?state=${encodeURIComponent(state)}`;

        const res = await fetch(endpoint, {
          headers: { 'AUTH-TOKEN': token }
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // 7. Proxy API: Generate barcode with auto-failover across tokens if limit hit
      if (path === '/api/pdf417/generate' && request.method === 'POST') {
        const store = await getStore(env);
        const reqBody = await request.json();

        // Get list of tokens to try: specific selected or active first, then remaining
        const specifiedTokenId = reqBody._tokenId;
        delete reqBody._tokenId;

        let tokensToTry = [];
        if (specifiedTokenId) {
          const found = (store.tokens || []).find(t => t.id === specifiedTokenId);
          if (found) tokensToTry.push(found);
        }
        if (tokensToTry.length === 0) {
          const active = (store.tokens || []).find(t => t.active);
          if (active) tokensToTry.push(active);
          const others = (store.tokens || []).filter(t => !t.active);
          tokensToTry = [...tokensToTry, ...others];
        }

        if (tokensToTry.length === 0) {
          return json({ error: 'No PDF417 API Token configured. Please add one in Token Manager.' }, 400);
        }

        let lastErr = null;
        for (const tokItem of tokensToTry) {
          try {
            const res = await fetch(`${UPSTREAM_BASE}/api/generate_barcode/`, {
              method: 'POST',
              headers: {
                'AUTH-TOKEN': tokItem.token,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: JSON.stringify(reqBody)
            });
            const data = await res.json();

            if (res.ok && data.status === 'SUCCESS') {
              // Update barcode created count if cached
              if (tokItem.info && typeof tokItem.info.barcodes_created === 'number') {
                tokItem.info.barcodes_created += 1;
                if (tokItem.info.available_barcodes > 0) tokItem.info.available_barcodes -= 1;
                await saveStore(env, store);
              }

              // Append to history
              try {
                const history = await getHistory(env);
                history.unshift({
                  id: 'hist_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
                  createdAt: new Date().toISOString(),
                  tokenId: tokItem.id,
                  tokenName: tokItem.name,
                  state: reqBody.state || null,
                  barcodeType: reqBody.barcode_type || null,
                  pdf417Meta: reqBody.meta || null,
                  pdf417Data: reqBody.data || null,
                  pngUrl: data.png || null,
                  svgUrl: data.svg || null,
                  rawResponse: data
                });
                if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
                await saveHistory(env, history);
              } catch (e) {
                // history failure should not block success response
              }

              return json({
                ...data,
                used_token: { id: tokItem.id, name: tokItem.name }
              });
            }

            // If error is limit reached, failover to next token
            if (data.code === 'BARCODE_LIMIT' || data.message === 'BARCODE_LIMIT') {
              lastErr = data;
              continue; // try next token
            }

            return json(data, res.status);
          } catch (e) {
            lastErr = { error: e.message };
          }
        }

        return json(lastErr || { error: 'Failed to generate barcode across all tokens' }, 400);
      }

      // 8. Image Proxy (to fix CORS when viewing SVG/PNG from pdf417.pro media)
      if (path === '/api/proxy-image' && request.method === 'GET') {
        const imgUrl = url.searchParams.get('url');
        if (!imgUrl) return json({ error: 'Missing url parameter' }, 400);

        const target = imgUrl.startsWith('http') ? imgUrl : `${UPSTREAM_BASE}${imgUrl}`;
        const res = await fetch(target);
        const contentType = res.headers.get('content-type') || (target.endsWith('.svg') ? 'image/svg+xml' : 'image/png');

        return new Response(res.body, {
          status: res.status,
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      // Fallback: serve static assets if ASSETS binding exists (CF Pages / Workers Assets)
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'Internal Server Error' }, 500);
    }
  }
};
