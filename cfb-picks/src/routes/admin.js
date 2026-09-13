const express = require('express');
const { requireAuth, requireAdmin } = require('../auth');
const services = require('../services');

const router = express.Router();

router.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const weeks = services.listWeeks();
  const currentYear = new Date().getFullYear();
  res.render('admin', { weeks, currentYear, message: null, error: null });
});

router.post('/admin/sync-week', requireAuth, requireAdmin, async (req, res) => {
  const { seasonYear, weekNumber, seasonType, label } = req.body;
  const weeks = services.listWeeks();
  const currentYear = new Date().getFullYear();

  try {
    const { week, gameCount } = await services.syncWeekFromEspn({
      seasonYear: Number(seasonYear),
      seasonType: Number(seasonType) || 2,
      weekNumber: Number(weekNumber),
      label: label || undefined,
    });
    res.render('admin', {
      weeks: services.listWeeks(),
      currentYear,
      message: `Pulled ${gameCount} FBS games for ${week.label} (${week.season_year}).`,
      error: null,
    });
  } catch (err) {
    res.status(500).render('admin', {
      weeks,
      currentYear,
      message: null,
      error: `Failed to sync from ESPN: ${err.message}`,
    });
  }
});

router.post('/admin/refresh-scores/:weekId', requireAuth, requireAdmin, async (req, res) => {
  const weeks = services.listWeeks();
  const currentYear = new Date().getFullYear();
  try {
    const { week, gameCount } = await services.refreshScoresForWeek(Number(req.params.weekId));
    res.render('admin', {
      weeks: services.listWeeks(),
      currentYear,
      message: `Refreshed scores for ${week.label} (${gameCount} games).`,
      error: null,
    });
  } catch (err) {
    res.status(500).render('admin', {
      weeks,
      currentYear,
      message: null,
      error: `Failed to refresh scores: ${err.message}`,
    });
  }
});

module.exports = router;
