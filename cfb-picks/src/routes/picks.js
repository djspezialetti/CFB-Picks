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
  });
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
