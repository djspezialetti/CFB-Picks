const express = require('express');
const { requireAuth, requireAdmin } = require('../auth');
const services = require('../services');

const router = express.Router();

router.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const weeks = services.listWeeks();
  const users = services.listUsers();
  const currentYear = new Date().getFullYear();
  res.render('admin', { weeks, users, currentYear, message: null, error: null });
});

router.post('/admin/sync-week', requireAuth, requireAdmin, async (req, res) => {
  const { seasonYear, weekNumber, seasonType, label } = req.body;
  const weeks = services.listWeeks();
  const users = services.listUsers();
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
      users,
      currentYear,
      message: `Pulled ${gameCount} FBS games for ${week.label} (${week.season_year}).`,
      error: null,
    });
  } catch (err) {
    res.status(500).render('admin', {
      weeks,
      users,
      currentYear,
      message: null,
      error: `Failed to sync from ESPN: ${err.message}`,
    });
  }
});

router.post('/admin/refresh-scores/:weekId', requireAuth, requireAdmin, async (req, res) => {
  const weeks = services.listWeeks();
  const users = services.listUsers();
  const currentYear = new Date().getFullYear();
  try {
    const { week, gameCount } = await services.refreshScoresForWeek(Number(req.params.weekId));
    res.render('admin', {
      weeks: services.listWeeks(),
      users,
      currentYear,
      message: `Refreshed scores for ${week.label} (${gameCount} games).`,
      error: null,
    });
  } catch (err) {
    res.status(500).render('admin', {
      weeks,
      users,
      currentYear,
      message: null,
      error: `Failed to refresh scores: ${err.message}`,
    });
  }
});

router.post('/admin/delete-user/:userId', requireAuth, requireAdmin, (req, res) => {
  const weeks = services.listWeeks();
  const currentYear = new Date().getFullYear();
  const targetId = Number(req.params.userId);

  const render = (message, error) =>
    res.render('admin', { weeks, users: services.listUsers(), currentYear, message, error });

  if (targetId === req.session.userId) {
    return res.status(400).render('admin', {
      weeks,
      users: services.listUsers(),
      currentYear,
      message: null,
      error: "You can't delete your own account while logged in as it.",
    });
  }

  const target = services.listUsers().find((u) => u.id === targetId);
  if (!target) {
    return render(null, 'That user no longer exists.');
  }

  if (target.is_admin) {
    const adminCount = services.listUsers().filter((u) => u.is_admin).length;
    if (adminCount <= 1) {
      return render(null, "Can't delete the only remaining admin account.");
    }
  }

  services.deleteUser(targetId);
  render(`Removed ${target.name} and all of their picks.`, null);
});

module.exports = router;
