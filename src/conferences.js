// Ordered list of FBS conferences, matching the order most pick pools
// (and ESPN's own conference-by-conference view) use: alphabetical,
// starting at ACC and ending at Sun Belt.
//
// Each entry's `espnGroupId` is the numeric "groups" parameter ESPN's
// scoreboard endpoint accepts to filter to just that conference's games.
// These IDs are NOT officially documented by ESPN - they're widely used
// by hobbyist projects, but if one of these is wrong for the current
// season, that conference's section will just come back empty (rather
// than silently miscategorizing games). If that happens, it's a one-line
// fix here - no other code needs to change.
//
// The IDs for the four biggest conferences (ACC, Big 12, Big Ten, SEC)
// are well-established and used across nearly every public reference to
// this endpoint. The others are less certain and worth double-checking
// against a real sync once this is live.
const CONFERENCES = [
  { name: 'ACC', espnGroupId: 1 },
  { name: 'American Athletic Conference', espnGroupId: 62 },
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

module.exports = { CONFERENCES, conferenceOrder };
