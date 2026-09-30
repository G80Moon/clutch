// Clutch: fetch a student's Canvas calendar feed (.ics) and pass it straight back.
// Browsers can't read the feed directly (Canvas doesn't allow it cross-site), so it passes through here.
// Nothing is stored or logged. Only Canvas feed links are accepted, so this can't be used to fetch other sites.

const ALLOWED = h => h === 'canvas.morainevalley.edu' || h.endsWith('.instructure.com');
const FEED_PATH = /^\/feeds\/calendars\/[\w.-]+\.ics$/;
const MAX_BYTES = 3_000_000;

const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const okFeed = u => u.protocol === 'https:' && ALLOWED(u.hostname) && FEED_PATH.test(u.pathname);

export async function onRequestPost({ request }) {
  // same-site only: the page and this function share a host
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const host = new URL(request.url).host;
  if (origin && !origin.includes(host)) return json({ error: 'forbidden' }, 403);

  let url;
  try { url = new URL(String((await request.json()).url || '').trim()); } catch { return json({ error: 'That doesn\'t look like a link.' }, 400); }
  if (!okFeed(url)) return json({ error: 'That isn\'t a Canvas Calendar Feed link. It should end in .ics.' }, 400);

  let res;
  try { res = await fetch(url.toString(), { headers: { accept: 'text/calendar' }, redirect: 'follow' }); }
  catch { return json({ error: 'Couldn\'t reach Canvas. Try again in a minute.' }, 502); }
  if (!okFeed(new URL(res.url))) return json({ error: 'Canvas sent us somewhere unexpected.' }, 502);
  if ([400, 401, 403, 404].includes(res.status)) return json({ error: 'Canvas didn\'t recognize that link. Copy it again from Calendar Feed.' }, 404);
  if (!res.ok) return json({ error: 'Canvas had a problem. Try again in a minute.' }, 502);

  const text = await res.text();
  if (text.length > MAX_BYTES) return json({ error: 'That feed is too big.' }, 413);
  if (!text.includes('BEGIN:VCALENDAR')) return json({ error: 'That link didn\'t return a calendar.' }, 502);
  return new Response(text, { status: 200, headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}
