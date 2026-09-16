const express = require('express');
const { requireAuth } = require('../auth');
const services = require('../services');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const weeks = services.listWeeks();
  if (weeks.length === 0) {
    return res.render('no-weeks', {});
  }
  const weekId = req.query.week ? Number(req.query.week) : weeks[0].id;
  res.redirect(`/weeks/${weekId}`);
});

router.get('/board', requireAuth, (req, res) => {
  const weeks = services.listWeeks();
  if (weeks.length === 0) {
    return res.render('no-weeks', {});
  }
  // Always the most recently loaded week - same "latest week" convention
  // the plain "Picks" nav link uses.
  res.redirect(`/weeks/${weeks[0].id}/board`);
});

router.get('/weeks/:weekId', requireAuth, (req, res) => {
  const weekId = Number(req.params.weekId);
  const week = services.getWeek(weekId);
  if (!week) return res.status(404).render('error', { message: 'Week not found.' });

  const weeks = services.listWeeks();
  const games = services.listGamesForWeek(weekId);
  const myPicks = services.getUserPicksForWeek(req.session.userId, weekId);
  const myPickMap = new Map(myPicks.map((p) => [p.game_id, p.picked_side]));
  const canViewOthers = services.canViewOthersPicks(req.session.userId, weekId);
  const grid = canViewOthers ? services.getPickGridForWeek(weekId) : null;

  // Build a per-game "who picked which side" lookup, reusing the same
  // grid data already computed above, so it can be shown directly on
  // each matchup card instead of only in the summary table below.
  // Plain object (not a Map) since the template indexes it with
  // bracket notation (pickersByGame[g.id]).
  const pickersByGame = {};
  if (grid) {
    for (const g of grid.games) pickersByGame[g.id] = { home: [], away: [] };
    for (const u of grid.users) {
      u.picks.forEach((p) => {
        if (!p.side) return;
        pickersByGame[p.gameId][p.side].push(u.name);
      });
    }
  }

  const gamesWithState = games.map((g) => ({
    ...g,
    locked: new Date(g.start_time).getTime() <= Date.now(),
    myPick: myPickMap.get(g.id) || null,
  }));

  res.render('week', {
    week,
    weeks,
    games: gamesWithState,
    canViewOthers,
    grid,
    pickersByGame,
  });
});

router.get('/weeks/:weekId/board', requireAuth, (req, res) => {
  const weekId = Number(req.params.weekId);
  const week = services.getWeek(weekId);
  if (!week) return res.status(404).render('error', { message: 'Week not found.' });

  const canViewOthers = services.canViewOthersPicks(req.session.userId, weekId);
  if (!canViewOthers) {
    // Not ready to see the board yet - send them back to the matchups
    // page, which explains why (same rule as the inline picker chips).
    return res.redirect(`/weeks/${weekId}`);
  }

  const weeks = services.listWeeks();
  const grid = services.getPickGridForWeek(weekId);

  res.render('board', { week, weeks, grid });
});

router.post('/weeks/:weekId/picks', requireAuth, (req, res) => {
  const weekId = Number(req.params.weekId);
  const { gameId, side } = req.body;

  try {
    services.submitPick({ userId: req.session.userId, gameId: Number(gameId), pickedSide: side });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
