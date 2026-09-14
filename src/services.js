const db = require('./db');
const espn = require('./espn');
const { CONFERENCES, conferenceOrder, conferenceNameById } = require('./conferences');

// ---- Weeks & games -------------------------------------------------------

function getOrCreateWeek({ seasonYear, seasonType = 2, weekNumber, label }) {
  const existing = db
    .prepare('SELECT * FROM weeks WHERE season_year = ? AND season_type = ? AND week_number = ?')
    .get(seasonYear, seasonType, weekNumber);
  if (existing) return existing;

  const info = db
    .prepare('INSERT INTO weeks (season_year, season_type, week_number, label) VALUES (?, ?, ?, ?)')
    .run(seasonYear, seasonType, weekNumber, label || `Week ${weekNumber}`);
  return db.prepare('SELECT * FROM weeks WHERE id = ?').get(info.lastInsertRowid);
}

function listWeeks() {
  return db.prepare('SELECT * FROM weeks ORDER BY season_year DESC, season_type DESC, week_number DESC').all();
}

function getWeek(weekId) {
  return db.prepare('SELECT * FROM weeks WHERE id = ?').get(weekId);
}

// Pulls the matchups (and, for past weeks, scores) from ESPN and
// upserts them into the games table for the given week.
//
// Each game is tagged with the HOME team's conference for display
// grouping (see src/conferences.js for the section order), using the
// conferenceId ESPN already attaches to every team - no extra request
// needed. A game between two different conferences (e.g. an ACC team
// hosting a Big Ten team) is filed under the home team's conference.
async function syncWeekFromEspn({ seasonYear, seasonType = 2, weekNumber, label }) {
  const week = getOrCreateWeek({ seasonYear, seasonType, weekNumber, label });

  const events = await espn.fetchScoreboard({ year: seasonYear, seasonType, week: weekNumber });

  const taggedEvents = events.map((e) => ({
    ...e,
    conference:
      conferenceNameById(e.homeConferenceId) ||
      conferenceNameById(e.awayConferenceId) ||
      'Other',
  }));

  const upsert = db.prepare(`
    INSERT INTO games (
      week_id, espn_event_id, home_team, away_team, home_logo, away_logo, conference,
      home_record, away_record, home_conf_record, away_conf_record, spread,
      location, is_neutral_site,
      home_score, away_score, start_time, status, winner
    )
    VALUES (
      @week_id, @espn_event_id, @home_team, @away_team, @home_logo, @away_logo, @conference,
      @home_record, @away_record, @home_conf_record, @away_conf_record, @spread,
      @location, @is_neutral_site,
      @home_score, @away_score, @start_time, @status, @winner
    )
    ON CONFLICT(espn_event_id) DO UPDATE SET
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      home_logo = excluded.home_logo,
      away_logo = excluded.away_logo,
      conference = excluded.conference,
      home_record = excluded.home_record,
      away_record = excluded.away_record,
      home_conf_record = excluded.home_conf_record,
      away_conf_record = excluded.away_conf_record,
      spread = excluded.spread,
      location = excluded.location,
      is_neutral_site = excluded.is_neutral_site,
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      start_time = excluded.start_time,
      status = excluded.status,
      winner = excluded.winner
  `);

  const txn = db.transaction((rows) => {
    for (const r of rows) upsert.run(r);
  });

  txn(
    taggedEvents.map((e) => ({
      week_id: week.id,
      espn_event_id: e.espnEventId,
      home_team: e.homeTeam,
      away_team: e.awayTeam,
      home_logo: e.homeLogo,
      away_logo: e.awayLogo,
      conference: e.conference,
      home_record: e.homeRecord,
      away_record: e.awayRecord,
      home_conf_record: e.homeConfRecord,
      away_conf_record: e.awayConfRecord,
      spread: e.spread,
      location: e.location,
      is_neutral_site: e.neutralSite ? 1 : 0,
      home_score: e.homeScore,
      away_score: e.awayScore,
      start_time: e.startTime,
      status: e.status,
      winner: e.winner,
    }))
  );

  return { week, gameCount: taggedEvents.length };
}

// Re-fetches only scores/status for games already stored for a week
// (cheaper refresh once matchups are already locked in).
async function refreshScoresForWeek(weekId) {
  const week = getWeek(weekId);
  if (!week) throw new Error('Week not found');
  return syncWeekFromEspn({
    seasonYear: week.season_year,
    seasonType: week.season_type,
    weekNumber: week.week_number,
    label: week.label,
  });
}

// Games are grouped for display by conference (see src/conferences.js
// for the display order), then by kickoff time within each conference.
function listGamesForWeek(weekId) {
  const games = db.prepare('SELECT * FROM games WHERE week_id = ?').all(weekId);
  return games.sort((a, b) => {
    const confDiff = conferenceOrder(a.conference) - conferenceOrder(b.conference);
    if (confDiff !== 0) return confDiff;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
}

// ---- Picks ----------------------------------------------------------------

function getUserPicksForWeek(userId, weekId) {
  return db
    .prepare(
      `SELECT p.* FROM picks p
       JOIN games g ON g.id = p.game_id
       WHERE p.user_id = ? AND g.week_id = ?`
    )
    .all(userId, weekId);
}

function submitPick({ userId, gameId, pickedSide }) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) throw new Error('Game not found');
  if (new Date(game.start_time).getTime() <= Date.now()) {
    throw new Error('Picks are locked once a game has kicked off');
  }
  db.prepare(
    `INSERT INTO picks (user_id, game_id, picked_side, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, game_id) DO UPDATE SET
       picked_side = excluded.picked_side,
       updated_at = datetime('now')`
  ).run(userId, gameId, pickedSide);
}

// Has this user made a pick for every game in the week that has already
// started (i.e. every game they were actually able to pick before kickoff)?
// Used to decide whether it's fair to show them everyone else's picks.
function hasCompletedPicksForWeek(userId, weekId) {
  const games = listGamesForWeek(weekId);
  if (games.length === 0) return false;
  const picks = getUserPicksForWeek(userId, weekId);
  const pickedGameIds = new Set(picks.map((p) => p.game_id));
  return games.every((g) => pickedGameIds.has(g.id));
}

function earliestKickoffHasPassed(weekId) {
  const games = listGamesForWeek(weekId);
  if (games.length === 0) return false;
  const earliest = games.reduce(
    (min, g) => Math.min(min, new Date(g.start_time).getTime()),
    Infinity
  );
  return Date.now() >= earliest;
}

// Whether `viewerId` is allowed to see everyone else's picks for this week:
// once they've submitted all their own picks, OR once the week has started
// (first kickoff has passed) — whichever comes first.
function canViewOthersPicks(viewerId, weekId) {
  return hasCompletedPicksForWeek(viewerId, weekId) || earliestKickoffHasPassed(weekId);
}

// Full pick grid for a week: every user x every game, with correctness once final.
function getPickGridForWeek(weekId) {
  const games = listGamesForWeek(weekId);
  const users = db.prepare('SELECT id, name FROM users ORDER BY name COLLATE NOCASE').all();
  const allPicks = db
    .prepare(
      `SELECT p.user_id, p.game_id, p.picked_side FROM picks p
       JOIN games g ON g.id = p.game_id
       WHERE g.week_id = ?`
    )
    .all(weekId);

  const pickMap = new Map(); // `${userId}:${gameId}` -> picked_side
  for (const p of allPicks) pickMap.set(`${p.user_id}:${p.game_id}`, p.picked_side);

  return {
    games,
    users: users.map((u) => ({
      ...u,
      picks: games.map((g) => {
        const side = pickMap.get(`${u.id}:${g.id}`) || null;
        let correct = null;
        if (g.status === 'final' && g.winner && g.winner !== 'tie' && side) {
          correct = side === g.winner;
        }
        return { gameId: g.id, side, correct };
      }),
    })),
  };
}

// ---- Standings --------------------------------------------------------

// Correct-pick counts per user for one week (only counting final games).
function getWeekResults(weekId) {
  const games = listGamesForWeek(weekId).filter((g) => g.status === 'final' && g.winner && g.winner !== 'tie');
  const users = db.prepare('SELECT id, name FROM users ORDER BY name COLLATE NOCASE').all();
  const gameIds = games.map((g) => g.id);

  const results = users.map((u) => {
    let correct = 0;
    let picked = 0;
    if (gameIds.length > 0) {
      const placeholders = gameIds.map(() => '?').join(',');
      const rows = db
        .prepare(`SELECT picked_side, game_id FROM picks WHERE user_id = ? AND game_id IN (${placeholders})`)
        .all(u.id, ...gameIds);
      const gameById = new Map(games.map((g) => [g.id, g]));
      for (const r of rows) {
        picked += 1;
        const g = gameById.get(r.game_id);
        if (g && g.winner === r.picked_side) correct += 1;
      }
    }
    return { userId: u.id, name: u.name, correct, picked, totalGames: games.length };
  });

  results.sort((a, b) => b.correct - a.correct);

  // Determine weekly winner(s) - ties share the win.
  const topScore = results.length > 0 ? results[0].correct : 0;
  const winners = topScore > 0 ? results.filter((r) => r.correct === topScore).map((r) => r.userId) : [];

  return { results, winners, gamesFinal: games.length, gamesTotal: listGamesForWeek(weekId).length };
}

// Season standings: count how many weeks each user has won (ties count for everyone tied).
function getSeasonStandings(seasonYear, seasonType = 2) {
  const weeks = db
    .prepare('SELECT * FROM weeks WHERE season_year = ? AND season_type = ? ORDER BY week_number ASC')
    .all(seasonYear, seasonType);

  const users = db.prepare('SELECT id, name FROM users ORDER BY name COLLATE NOCASE').all();
  const weekWins = new Map(users.map((u) => [u.id, 0]));
  const totalCorrect = new Map(users.map((u) => [u.id, 0]));
  const weekSummaries = [];

  for (const week of weeks) {
    const { results, winners, gamesFinal, gamesTotal } = getWeekResults(week.id);
    if (gamesFinal === 0) continue; // week hasn't produced any final games yet
    for (const r of results) {
      totalCorrect.set(r.userId, (totalCorrect.get(r.userId) || 0) + r.correct);
    }
    for (const winnerId of winners) {
      weekWins.set(winnerId, (weekWins.get(winnerId) || 0) + 1);
    }
    weekSummaries.push({
      weekId: week.id,
      weekNumber: week.week_number,
      label: week.label,
      winners: winners.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean),
      complete: gamesFinal === gamesTotal && gamesTotal > 0,
    });
  }

  const standings = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      weeksWon: weekWins.get(u.id) || 0,
      totalCorrect: totalCorrect.get(u.id) || 0,
    }))
    .sort((a, b) => b.weeksWon - a.weeksWon || b.totalCorrect - a.totalCorrect);

  return { standings, weekSummaries };
}

module.exports = {
  getOrCreateWeek,
  listWeeks,
  getWeek,
  syncWeekFromEspn,
  refreshScoresForWeek,
  listGamesForWeek,
  getUserPicksForWeek,
  submitPick,
  hasCompletedPicksForWeek,
  earliestKickoffHasPassed,
  canViewOthersPicks,
  getPickGridForWeek,
  getWeekResults,
  getSeasonStandings,
};
