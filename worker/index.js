// Cloudflare Worker backend for APDF417
// Routes: Auth, Token Manager, PDF417 API proxy with Cloudflare D1 SQL storage

const UPSTREAM_BASE = 'https://pdf417.pro';
const HISTORY_MAX = 100;

const DEFAULT_CONFIG = {
  admin: {
    username: 'admin',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' // SHA-256 of 'admin'
  },
  tokens: []
};

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Ensure tables exist in D1
async function getDb(env) {
  const db = env.DB || env.apdf147;
  if (!db) return null;

  if (!globalThis.__D1_INITIALIZED__) {
    try {
      await db.prepare("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY, name TEXT NOT NULL, token TEXT NOT NULL, active INTEGER DEFAULT 0, info TEXT, last_check TEXT, created_at TEXT NOT NULL)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, token_id TEXT, token_name TEXT, state TEXT, barcode_type TEXT, pdf417_meta TEXT, pdf417_data TEXT, png_url TEXT, svg_url TEXT, raw_response TEXT)").run();
      globalThis.__D1_INITIALIZED__ = true;
    } catch (e) {
      console.error('D1 init error:', e);
    }
  }
  return db;
}

// Storage helpers
async function getStore(env) {
  const db = await getDb(env);
  if (db) {
    const adminRow = await db.prepare("SELECT value FROM config WHERE key = 'admin'").first();
    let admin = adminRow ? JSON.parse(adminRow.value) : null;

    const tokenRows = await db.prepare("SELECT * FROM tokens ORDER BY created_at ASC").all();
    const tokens = (tokenRows?.results || []).map(r => ({
      id: r.id,
      name: r.name,
      token: r.token,
      active: Boolean(r.active),
      info: r.info ? JSON.parse(r.info) : null,
      lastCheck: r.last_check,
      createdAt: r.created_at
    }));

    return {
      admin: admin || DEFAULT_CONFIG.admin,
      tokens
    };
  }

  // Fallback to KV if available
  if (env.APDF417_KV) {
    const raw = await env.APDF417_KV.get('config', 'json');
    if (raw) return raw;
  }

  // In-memory fallback
  if (!globalThis.__APDF417_STORE__) {
    globalThis.__APDF417_STORE__ = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  return globalThis.__APDF417_STORE__;
}

async function saveAdminConfig(env, admin) {
  const db = await getDb(env);
  if (db) {
    await db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('admin', ?)").bind(JSON.stringify(admin)).run();
    return;
  }
  const store = await getStore(env);
  store.admin = admin;
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('config', JSON.stringify(store));
  }
}

async function saveTokens(env, tokens) {
  const db = await getDb(env);
  if (db) {
    await db.exec("DELETE FROM tokens");
    if (tokens && tokens.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO tokens (id, name, token, active, info, last_check, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const batch = tokens.map(t => stmt.bind(
        t.id,
        t.name,
        t.token,
        t.active ? 1 : 0,
        t.info ? JSON.stringify(t.info) : null,
        t.lastCheck || null,
        t.createdAt || new Date().toISOString()
      ));
      await db.batch(batch);
    }
    return;
  }
  const store = await getStore(env);
  store.tokens = tokens;
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('config', JSON.stringify(store));
  }
}

async function getHistory(env) {
  const db = await getDb(env);
  if (db) {
    const { results } = await db.prepare("SELECT * FROM history ORDER BY created_at DESC LIMIT ?").bind(HISTORY_MAX).all();
    return (results || []).map(r => ({
      id: r.id,
      createdAt: r.created_at,
      tokenId: r.token_id,
      tokenName: r.token_name,
      state: r.state,
      barcodeType: r.barcode_type,
      pdf417Meta: r.pdf417_meta ? JSON.parse(r.pdf417_meta) : null,
      pdf417Data: r.pdf417_data ? JSON.parse(r.pdf417_data) : null,
      pngUrl: r.png_url,
      svgUrl: r.svg_url,
      rawResponse: r.raw_response ? JSON.parse(r.raw_response) : null
    }));
  }

  if (env.APDF417_KV) {
    const raw = await env.APDF417_KV.get('history', 'json');
    if (raw) return raw;
  }
  if (!globalThis.__APDF417_HISTORY__) {
    globalThis.__APDF417_HISTORY__ = [];
  }
  return globalThis.__APDF417_HISTORY__;
}

async function addHistoryItem(env, item) {
  const db = await getDb(env);
  if (db) {
    await db.prepare(`
      INSERT INTO history (id, created_at, token_id, token_name, state, barcode_type, pdf417_meta, pdf417_data, png_url, svg_url, raw_response)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id,
      item.createdAt,
      item.tokenId || null,
      item.tokenName || null,
      item.state || null,
      item.barcodeType || null,
      item.pdf417Meta ? JSON.stringify(item.pdf417Meta) : null,
      item.pdf417Data ? JSON.stringify(item.pdf417Data) : null,
      item.pngUrl || null,
      item.svgUrl || null,
      item.rawResponse ? JSON.stringify(item.rawResponse) : null
    ).run();

    // Clean old history beyond HISTORY_MAX
    await db.prepare(`
      DELETE FROM history WHERE id NOT IN (
        SELECT id FROM history ORDER BY created_at DESC LIMIT ?
      )
    `).bind(HISTORY_MAX).run();
    return;
  }

  const history = await getHistory(env);
  history.unshift(item);
  if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('history', JSON.stringify(history));
  }
}

async function clearHistory(env) {
  const db = await getDb(env);
  if (db) {
    await db.exec("DELETE FROM history");
    return;
  }
  if (env.APDF417_KV) {
    await env.APDF417_KV.put('history', JSON.stringify([]));
  }
  globalThis.__APDF417_HISTORY__ = [];
}

// Resolve admin creds with priority: DB > env > default
async function getAdminCreds(env) {
  const store = await getStore(env);
  if (store.admin?.passwordHash) {
    return {
      username: store.admin.username || env.ADMIN_USER || 'admin',
      passwordHash: store.admin.passwordHash
    };
  }
  if (env.ADMIN_PASS) {
    return {
      username: env.ADMIN_USER || 'admin',
      passwordHash: await sha256(env.ADMIN_PASS)
    };
  }
  return {
    username: 'admin',
    passwordHash: DEFAULT_CONFIG.admin.passwordHash
  };
}

async function checkAuth(req, env) {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  const { username, passwordHash } = await getAdminCreds(env);
  const expectedToken = await sha256(`session:${passwordHash}`);

  if (token === expectedToken) {
    return { username };
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
        const { username, passwordHash } = await getAdminCreds(env);
        const inputHash = await sha256(body.password || '');
        if (body.username === username && inputHash === passwordHash) {
          const sessionToken = await sha256(`session:${passwordHash}`);
          return json({ success: true, token: sessionToken, username });
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

        const { passwordHash: currentHash } = await getAdminCreds(env);
        const oldHash = await sha256(body.oldPassword || '');

        if (oldHash !== currentHash) {
          return json({ error: 'Current password incorrect' }, 400);
        }

        const newAdmin = {
          username: body.newUsername || user.username || 'admin',
          passwordHash: await sha256(body.newPassword)
        };
        await saveAdminConfig(env, newAdmin);

        const newSessionToken = await sha256(`session:${newAdmin.passwordHash}`);
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
        await clearHistory(env);
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
        const tokens = store.tokens || [];

        const newToken = {
          id: 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          name: body.name || 'API Token ' + (tokens.length + 1),
          token: body.token.trim(),
          active: tokens.length === 0, // default true if first
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

        tokens.push(newToken);
        await saveTokens(env, tokens);
        return json({ success: true, token: newToken });
      }

      if (path.match(/^\/api\/tokens\/([^/]+)\/toggle$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        const store = await getStore(env);
        const updatedTokens = (store.tokens || []).map(t => ({
          ...t,
          active: t.id === id
        }));
        await saveTokens(env, updatedTokens);
        return json({ success: true, tokens: updatedTokens });
      }

      if (path.match(/^\/api\/tokens\/([^/]+)$/) && request.method === 'DELETE') {
        const id = path.split('/')[3];
        const store = await getStore(env);
        let updatedTokens = (store.tokens || []).filter(t => t.id !== id);
        if (updatedTokens.length > 0 && !updatedTokens.some(t => t.active)) {
          updatedTokens[0].active = true;
        }
        await saveTokens(env, updatedTokens);
        return json({ success: true, tokens: updatedTokens });
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

        await saveTokens(env, store.tokens);
        return json({ success: true, token: item });
      }

      if (path === '/api/tokens/check-all' && request.method === 'POST') {
        const store = await getStore(env);
        const updatedTokens = await Promise.all((store.tokens || []).map(async item => {
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
        await saveTokens(env, updatedTokens);
        return json({ success: true, tokens: updatedTokens });
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
        const type = url.searchParams.get('type') || 'full';
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
              if (tokItem.info && typeof tokItem.info.barcodes_created === 'number') {
                tokItem.info.barcodes_created += 1;
                if (tokItem.info.available_barcodes > 0) tokItem.info.available_barcodes -= 1;
                await saveTokens(env, store.tokens);
              }

              // Append to history
              try {
                await addHistoryItem(env, {
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
              } catch (e) {
                // history failure should not block success response
              }

              return json({
                ...data,
                used_token: { id: tokItem.id, name: tokItem.name }
              });
            }

            if (data.code === 'BARCODE_LIMIT' || data.message === 'BARCODE_LIMIT') {
              lastErr = data;
              continue;
            }

            return json(data, res.status);
          } catch (e) {
            lastErr = { error: e.message };
          }
        }

        return json(lastErr || { error: 'Failed to generate barcode across all tokens' }, 400);
      }

      // 8. Image Proxy (CORS fix)
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

      // Fallback: static assets
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'Internal Server Error' }, 500);
    }
  }
};
