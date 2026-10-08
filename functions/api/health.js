export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: !!env.ANTHROPIC_API_KEY, caps: !!env.RATE, groups: !!env.DB }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
