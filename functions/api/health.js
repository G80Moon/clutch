export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ok: !!env.ANTHROPIC_API_KEY, caps: !!env.RATE }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
