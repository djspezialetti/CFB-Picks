// Ordered list of FBS conferences, matching the order most pick pools
// (and ESPN's own conference-by-conference view) use: alphabetical,
// starting at ACC and ending at Sun Belt.
//
// Each entry's `espnGroupId` is ESPN's own numeric conference ID - the
// exact same number that shows up directly on each team object in the
// scoreboard response as `team.conferenceId`. That's confirmed against
// live data (Sun Belt = 37 matched a real response), so these IDs are
// used purely as a lookup table now, not to filter any API call.
//
// The IDs for the four biggest conferences (ACC, Big 12, Big Ten, SEC)
// are well-established and used across nearly every public reference to
// this endpoint. The others are less certain and worth double-checking
// against a real sync once this is live - if one's wrong, that
// conference's teams will just fall into "Other" until it's corrected
// here (no other code needs to change).
const CONFERENCES = [
  { name: 'ACC', espnGroupId: 1 },
  { name: 'American Athletic Conference', espnGroupId: 151 },
  { name: 'Big 12', espnGroupId: 4 },
  { name: 'Big Ten', espnGroupId: 5 },
  { name: 'Conference USA', espnGroupId: 12 },
  { name: 'FBS Independents', espnGroupId: 18 },
  { name: 'Mid-American', espnGroupId: 15 },
  { name: 'Mountain West', espnGroupId: 17 },
  { name: 'Pac-12', espnGroupId: 9 },
  { name: 'SEC', espnGroupId: 8 },
  { name: 'Sun Belt', espnGroupId: 37 },
];

function conferenceOrder(name) {
  const idx = CONFERENCES.findIndex((c) => c.name === name);
  return idx === -1 ? CONFERENCES.length : idx; // unknown conferences sort last
}

// Looks up a conference's display name from ESPN's own numeric
// conferenceId (the same field that shows up directly on each team object
// in the scoreboard response, e.g. team.conferenceId === 37 for Sun Belt).
function conferenceNameById(id) {
  if (id === null || id === undefined) return null;
  const match = CONFERENCES.find((c) => c.espnGroupId === Number(id));
  return match ? match.name : null;
}

module.exports = { CONFERENCES, conferenceOrder, conferenceNameById };
