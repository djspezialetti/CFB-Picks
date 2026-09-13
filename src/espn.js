// Thin wrapper around ESPN's public (unofficial) scoreboard endpoint for
// college football. No API key is required. This endpoint can change or
// disappear without notice since it isn't officially documented by ESPN.
const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';

// groups=80 limits results to the FBS classification.
// limit is set high so a full slate of FBS games comes back in one page.
async function fetchScoreboard({ year, seasonType = 2, week }) {
  const url = `${BASE_URL}?year=${year}&seasontype=${seasonType}&week=${week}&groups=80&limit=400`;
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

module.exports = { fetchScoreboard };
