// Clutch groups: small class study groups with one shared weekly focus goal and shared flashcard decks.
// Env: DB (D1 database "clutch-groups", schema in db/schema.sql).
// Stores only: group name, class, join code; members' first names; their focus minutes per week; decks they chose to share.
// A member is the random device id the page keeps (x-clutch-id). It is never sent back to anyone.

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_MEMBERS = 40, MAX_DECKS = 30, MAX_CARDS = 60;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (error, status = 400) => json({ error }, status);
const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const okCode = c => /^[A-Z0-9]{6}$/.test(c);
const okWeek = w => /^\d{4}-\d{2}-\d{2}$/.test(w);
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');

async function isMember(db, code, mid) {
  return !!(await db.prepare('SELECT 1 FROM members WHERE code = ? AND mid = ?').bind(code, mid).first());
}

async function state(db, code, mid, week) {
  const g = await db.prepare('SELECT code, name, course, goal FROM groups WHERE code = ?').bind(code).first();
  if (!g) return null;
  const { results: rows } = await db.prepare(
    `SELECT m.mid, m.name, COALESCE(f.min, 0) AS min FROM members m
     LEFT JOIN focus f ON f.code = m.code AND f.mid = m.mid AND f.week = ?
     WHERE m.code = ? ORDER BY m.joined`).bind(week, code).all();
  const { results: decks } = await db.prepare(
    `SELECT d.id, d.topic, d.course, d.cards, d.mid, m.name AS by FROM decks d
     LEFT JOIN members m ON m.code = d.code AND m.mid = d.mid
     WHERE d.code = ? ORDER BY d.at DESC`).bind(code).all();
  const members = rows.map(r => ({ name: r.name, min: r.min, you: r.mid === mid }));
  const total = members.reduce((s, m) => s + m.min, 0);
  return {
    group: { code: g.code, name: g.name, course: g.course, goal: g.goal },
    week, members, total, goal: g.goal * members.length,
    decks: decks.map(d => ({ id: d.id, topic: d.topic, course: d.course, n: JSON.parse(d.cards).length, by: d.by || 'A former member', mine: d.mid === mid }))
  };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return fail('Groups aren\'t set up on this copy of Clutch.', 503);

  // same-site only: the page and this function share a host
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  const host = new URL(request.url).host;
  if (origin && !origin.includes(host)) return fail('forbidden', 403);

  const mid = (request.headers.get('x-clutch-id') || '').replace(/[^a-z0-9]/g, '').slice(0, 40);
  if (mid.length < 8) return fail('Missing device id.', 400);

  let b;
  try { b = await request.json(); } catch { return fail('bad json'); }
  const db = env.DB, now = Date.now();
  const code = clean(b.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const week = okWeek(b.week) ? b.week : new Date().toISOString().slice(0, 10);
  const me = clean(b.me, 24) || 'Student';

  if (b.action === 'create') {
    const name = clean(b.name, 32), course = clean(b.course, 16).toUpperCase();
    if (!course) return fail('Pick a class for the group.');
    let c = '';
    for (let i = 0; i < 5 && !c; i++) { const t = newCode(); if (!(await db.prepare('SELECT 1 FROM groups WHERE code = ?').bind(t).first())) c = t; }
    if (!c) return fail('Couldn\'t make a code. Try again.', 500);
    await db.batch([
      db.prepare('INSERT INTO groups (code, name, course, goal, created) VALUES (?, ?, ?, 60, ?)').bind(c, name || `${course} study group`, course, now),
      db.prepare('INSERT INTO members (code, mid, name, joined) VALUES (?, ?, ?, ?)').bind(c, mid, me, now)
    ]);
    return json(await state(db, c, mid, week));
  }

  if (!okCode(code)) return fail('That code should be 6 letters and numbers.');
  if (!(await db.prepare('SELECT 1 FROM groups WHERE code = ?').bind(code).first())) return fail('No group with that code. Check it with whoever sent it.', 404);

  if (b.action === 'join') {
    if (!(await isMember(db, code, mid))) {
      const n = (await db.prepare('SELECT COUNT(*) AS n FROM members WHERE code = ?').bind(code).first()).n;
      if (n >= MAX_MEMBERS) return fail('That group is full.', 409);
      await db.prepare('INSERT INTO members (code, mid, name, joined) VALUES (?, ?, ?, ?)').bind(code, mid, me, now).run();
    }
    return json(await state(db, code, mid, week));
  }

  if (!(await isMember(db, code, mid))) return fail('You\'re not in this group anymore.', 403);

  if (b.action === 'state') {
    const min = Math.max(0, Math.min(6000, Math.round(Number(b.min) || 0)));
    await db.batch([
      db.prepare(`INSERT INTO focus (code, mid, week, min, updated) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT (code, mid, week) DO UPDATE SET min = excluded.min, updated = excluded.updated`).bind(code, mid, week, min, now),
      db.prepare('UPDATE members SET name = ? WHERE code = ? AND mid = ?').bind(me, code, mid)
    ]);
    return json(await state(db, code, mid, week));
  }

  if (b.action === 'leave') {
    await db.batch([
      db.prepare('DELETE FROM members WHERE code = ? AND mid = ?').bind(code, mid),
      db.prepare('DELETE FROM focus WHERE code = ? AND mid = ?').bind(code, mid),
      db.prepare('DELETE FROM decks WHERE code = ? AND mid = ?').bind(code, mid)
    ]);
    const left = (await db.prepare('SELECT COUNT(*) AS n FROM members WHERE code = ?').bind(code).first()).n;
    if (!left) await db.batch([db.prepare('DELETE FROM groups WHERE code = ?').bind(code), db.prepare('DELETE FROM decks WHERE code = ?').bind(code)]);
    return json({ ok: true });
  }

  if (b.action === 'share') {
    const d = b.deck || {};
    const cards = (Array.isArray(d.cards) ? d.cards : []).slice(0, MAX_CARDS).map(c => ({ q: clean(c.q, 300), a: clean(c.a, 300) })).filter(c => c.q && c.a);
    if (!cards.length) return fail('That deck has no cards.');
    const n = (await db.prepare('SELECT COUNT(*) AS n FROM decks WHERE code = ?').bind(code).first()).n;
    if (n >= MAX_DECKS) return fail('This group has shared the most decks it can. Remove one first.', 409);
    await db.prepare('INSERT INTO decks (id, code, mid, topic, course, cards, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), code, mid, clean(d.topic, 60) || 'Flashcards', clean(d.course, 16), JSON.stringify(cards), now).run();
    return json(await state(db, code, mid, week));
  }

  if (b.action === 'deck') {
    const d = await db.prepare('SELECT topic, course, cards FROM decks WHERE id = ? AND code = ?').bind(clean(b.id, 40), code).first();
    if (!d) return fail('That deck was removed.', 404);
    return json({ deck: { topic: d.topic, course: d.course, cards: JSON.parse(d.cards) } });
  }

  if (b.action === 'unshare') {
    await db.prepare('DELETE FROM decks WHERE id = ? AND code = ? AND mid = ?').bind(clean(b.id, 40), code, mid).run();
    return json(await state(db, code, mid, week));
  }

  return fail('Unknown action.');
}
