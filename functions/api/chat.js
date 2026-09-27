// Clutch: proxy to the Anthropic Messages API. The key never leaves Cloudflare.
// Env: ANTHROPIC_API_KEY (secret, required). RATE (KV namespace, optional) turns on per-visitor daily caps.

const MODELS = {
  'claude-haiku-4-5': 'claude-haiku-4-5',
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5-5': 'claude-sonnet-5'          // "complex" is downgraded to Sonnet; nothing in Clutch needs Opus
};
const MAX_TOKENS = 2000;
const PER_VISITOR_PER_DAY = 80;                // requests (a tool call round counts as one)
const EVERYONE_PER_DAY = 2500;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set on this deployment.' }, 503);

  // same-site only: the page and this function share a host
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const host = new URL(request.url).host;
  if (origin && !origin.includes(host)) return json({ error: 'forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: 'messages required' }, 400);

  // daily caps (only when a KV namespace named RATE is bound)
  if (env.RATE) {
    const day = new Date().toISOString().slice(0, 10);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const [mine, all] = await Promise.all([env.RATE.get(`ip:${ip}:${day}`), env.RATE.get(`all:${day}`)]);
    if (Number(mine || 0) >= PER_VISITOR_PER_DAY) return json({ error: 'You have used today\'s AI allowance on this device. It resets at midnight UTC.' }, 429);
    if (Number(all || 0) >= EVERYONE_PER_DAY) return json({ error: 'Clutch hit its daily AI budget. Try again tomorrow.' }, 429);
    // best effort counters (KV is eventually consistent; good enough for a cap)
    await Promise.all([
      env.RATE.put(`ip:${ip}:${day}`, String(Number(mine || 0) + 1), { expirationTtl: 172800 }),
      env.RATE.put(`all:${day}`, String(Number(all || 0) + 1), { expirationTtl: 172800 })
    ]);
  }

  const payload = {
    model: MODELS[body.model] || 'claude-haiku-4-5',
    max_tokens: Math.min(MAX_TOKENS, Math.max(64, Number(body.max_tokens) || 1200)),
    messages: body.messages,
    stream: true
  };
  if (body.system) payload.system = String(body.system).slice(0, 4000);
  if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools.slice(0, 8);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    const status = upstream.status === 429 ? 429 : upstream.status === 401 ? 503 : 502;
    return json({ error: status === 503 ? 'The API key on this deployment was rejected.' : status === 429 ? 'Claude is rate limited right now. Try again in a minute.' : 'Upstream error.', detail: text.slice(0, 500) }, status);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
