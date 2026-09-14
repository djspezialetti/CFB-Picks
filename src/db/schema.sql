-- CFB Picks Pool schema

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weeks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year  INTEGER NOT NULL,
  season_type  INTEGER NOT NULL DEFAULT 2, -- ESPN: 1=preseason, 2=regular, 3=postseason
  week_number  INTEGER NOT NULL,
  label        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(season_year, season_type, week_number)
);

CREATE TABLE IF NOT EXISTS games (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id        INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  espn_event_id  TEXT UNIQUE,
  home_team      TEXT NOT NULL,
  away_team      TEXT NOT NULL,
  home_logo      TEXT,
  away_logo      TEXT,
  conference     TEXT,
  home_record       TEXT,
  away_record       TEXT,
  home_conf_record  TEXT,
  away_conf_record  TEXT,
  home_rank      INTEGER,
  away_rank      INTEGER,
  spread         TEXT,
  location       TEXT,
  is_neutral_site INTEGER NOT NULL DEFAULT 0,
  home_score     INTEGER,
  away_score     INTEGER,
  start_time     TEXT NOT NULL, -- ISO 8601
  status         TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | final
  winner         TEXT, -- 'home' | 'away' | 'tie' | NULL
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_week ON games(week_id);

CREATE TABLE IF NOT EXISTS picks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  picked_side TEXT NOT NULL CHECK (picked_side IN ('home','away')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_picks_user ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_game ON picks(game_id);
