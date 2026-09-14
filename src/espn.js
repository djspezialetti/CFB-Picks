// Thin wrapper around ESPN's public (unofficial) scoreboard endpoint for
// college football. No API key is required. This endpoint can change or
// disappear without notice since it isn't officially documented by ESPN.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';

// groups=80 means "all of FBS" - this returns every FBS game for the week
// in one call. Each team's own conferenceId (used for conference-section
// grouping, see conferences.js) comes along for free in this same
// response - no separate request needed.
async function fetchScoreboard({ year, seasonType = 2, week }) {
  const url = `${SCOREBOARD_URL}?year=${year}&seasontype=${seasonType}&week=${week}&groups=80&limit=400`;
  const res = await fetch(url, { headers: { 'User-Agent': 'cfb-picks-app/1.0' } });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.events || []).map(parseEvent);
}

function parseEvent(event) {
  const comp = event.competitions && event.competitions[0];
  const competitors = (comp && comp.competitors) || [];
  const home = competitors.find((c) => c.homeAway === 'home');
  const away = competitors.find((c) => c.homeAway === 'away');

  const statusName = comp && comp.status && comp.status.type && comp.status.type.name;
  const completed = !!(comp && comp.status && comp.status.type && comp.status.type.completed);

  let status = 'scheduled';
  if (completed) status = 'final';
  else if (statusName && statusName !== 'STATUS_SCHEDULED') status = 'in_progress';

  const homeScore = home && home.score !== undefined ? Number(home.score) : null;
  const awayScore = away && away.score !== undefined ? Number(away.score) : null;

  let winner = null;
  if (status === 'final' && homeScore !== null && awayScore !== null) {
    if (homeScore > awayScore) winner = 'home';
    else if (awayScore > homeScore) winner = 'away';
    else winner = 'tie';
  }

  return {
    espnEventId: event.id,
    homeTeam: home && home.team ? home.team.displayName : 'TBD',
    awayTeam: away && away.team ? away.team.displayName : 'TBD',
    homeLogo: getTeamLogo(home),
    awayLogo: getTeamLogo(away),
    homeConferenceId: home && home.team ? home.team.conferenceId : null,
    awayConferenceId: away && away.team ? away.team.conferenceId : null,
    homeRecord: getRecord(home, 'total'),
    awayRecord: getRecord(away, 'total'),
    homeConfRecord: getRecord(home, 'vsconf'),
    awayConfRecord: getRecord(away, 'vsconf'),
    spread: getSpread(comp),
    location: getLocation(comp),
    neutralSite: !!(comp && comp.neutralSite),
    startTime: event.date, // ISO 8601 already
    status,
    homeScore,
    awayScore,
    winner,
  };
}

// ESPN sometimes puts a direct "logo" field on the team, and sometimes
// only a "logos" array of {href, ...} objects - check both.
function getTeamLogo(competitor) {
  const team = competitor && competitor.team;
  if (!team) return null;
  if (team.logo) return team.logo;
  if (Array.isArray(team.logos) && team.logos.length > 0) return team.logos[0].href;
  return null;
}

// competitor.records is normally an array like:
//   [{ type: 'total', summary: '3-0' }, { type: 'vsconf', summary: '1-0' }, ...]
// `kind` is 'total' for overall record, 'vsconf' for conference record.
// Falls back to matching by name text if `type` isn't present, since
// ESPN's payload shape has shifted before.
function getRecord(competitor, kind) {
  const records = competitor && competitor.records;
  if (!Array.isArray(records)) return null;

  const byType = records.find((r) => r.type === kind);
  if (byType && byType.summary) return byType.summary;

  if (kind === 'vsconf') {
    const byName = records.find((r) => /conf/i.test(r.name || '') || /conf/i.test(r.abbreviation || ''));
    if (byName && byName.summary) return byName.summary;
  } else {
    const byName = records.find((r) => /total|overall/i.test(r.name || ''));
    if (byName && byName.summary) return byName.summary;
  }
  return null;
}

// Betting odds aren't always present (smaller games, or lines that
// haven't posted yet). `details` is ESPN's own human-readable summary,
// e.g. "OSU -14.5" - using that directly avoids needing to figure out
// which team the raw spread number is relative to.
function getSpread(comp) {
  const odds = comp && comp.odds;
  if (!Array.isArray(odds) || odds.length === 0) return null;
  return odds[0].details || null;
}

// Venue city/state, e.g. "Arlington, TX" - used to show where a game is
// being played, which matters most for neutral-site games.
function getLocation(comp) {
  const venue = comp && comp.venue;
  const address = venue && venue.address;
  if (!address || !address.city) return null;
  return address.state ? `${address.city}, ${address.state}` : address.city;
}

module.exports = { fetchScoreboard };
