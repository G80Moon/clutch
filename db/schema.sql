-- Clutch groups (Cloudflare D1). Apply with:
--   npx wrangler d1 execute clutch-groups --remote --file=db/schema.sql
-- Stores only: group name, class, join code; members' first names; their focus minutes per week; decks they chose to share.
-- A member is identified by the random device id the page keeps (clutch.id). It is never sent back to other members.
CREATE TABLE IF NOT EXISTS groups (
  code    TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  course  TEXT NOT NULL,
  goal    INTEGER NOT NULL DEFAULT 60,      -- minutes per member per week
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  code   TEXT NOT NULL,
  mid    TEXT NOT NULL,
  name   TEXT NOT NULL,
  joined INTEGER NOT NULL,
  PRIMARY KEY (code, mid)
);
CREATE TABLE IF NOT EXISTS focus (
  code    TEXT NOT NULL,
  mid     TEXT NOT NULL,
  week    TEXT NOT NULL,                     -- Monday, YYYY-MM-DD
  min     INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  PRIMARY KEY (code, mid, week)
);
CREATE TABLE IF NOT EXISTS decks (
  id     TEXT PRIMARY KEY,
  code   TEXT NOT NULL,
  mid    TEXT NOT NULL,
  topic  TEXT NOT NULL,
  course TEXT NOT NULL DEFAULT '',
  cards  TEXT NOT NULL,                      -- JSON [{q,a}]
  at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS decks_by_group ON decks (code, at);
