const express = require('express');
const { requireAuth } = require('../auth-service');
const services = require('../services');

const router = express.Router();

router.get('/standings', requireAuth, (req, res) => {
  const weeks = services.listWeeks();
  const seasonYear = req.query.season
    ? Number(req.query.season)
    : weeks[0]
    ? weeks[0].season_year
    : new Date().getFullYear();

  const seasons = [...new Set(weeks.map((w) => w.season_year))].sort((a, b) => b - a);
  const { standings, weekSummaries } = services.getSeasonStandings(seasonYear);

  res.render('standings', { standings, weekSummaries, seasons, seasonYear });
});

router.get('/weeks/:weekId/results', requireAuth, (req, res) => {
  const weekId = Number(req.params.weekId);
  const week = services.getWeek(weekId);
  if (!week) return res.status(404).render('error', { message: 'Week not found.' });

  const weeks = services.listWeeks();
  const { results, winners, gamesFinal, gamesTotal } = services.getWeekResults(weekId);

  res.render('week-results', { week, weeks, results, winners, gamesFinal, gamesTotal });
});

module.exports = router;
