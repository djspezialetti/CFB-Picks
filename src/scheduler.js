// Automatically keeps the most recently loaded week's scores up to date,
// so nobody has to remember to click "Refresh scores" on the Admin page.
//
// Schedule:
//   - Saturdays: every 15 minutes (typical CFB game day)
//   - All other days: every 12 hours (midnight and noon, server local time)
//
// This only ever refreshes the single most recently loaded week (i.e.
// whichever week is at the top of services.listWeeks()) - it does not
// touch older weeks, since those are presumably already final.
const cron = require('node-cron');
const services = require('./services');

async function refreshCurrentWeek(reason) {
  const weeks = services.listWeeks();
  if (weeks.length === 0) return;

  const currentWeek = weeks[0]; // listWeeks() orders newest-first
  try {
    const { gameCount } = await services.refreshScoresForWeek(currentWeek.id);
    console.log(
      `[scheduler] (${reason}) refreshed "${currentWeek.label}" - ${gameCount} games - ${new Date().toISOString()}`
    );
  } catch (err) {
    // Network hiccups or ESPN changing their endpoint shouldn't crash the
    // app - just log it and try again on the next scheduled run.
    console.error(`[scheduler] (${reason}) failed to refresh scores:`, err.message);
  }
}

function start() {
  // Every 15 minutes, Saturdays only. Cron day-of-week: 6 = Saturday.
  cron.schedule('*/15 * * * 6', () => refreshCurrentWeek('Saturday 15-min'));

  // Midnight and noon, Sunday through Friday (i.e. every day except Saturday).
  cron.schedule('0 0,12 * * 0-5', () => refreshCurrentWeek('12-hour'));

  console.log('[scheduler] Auto-refresh scheduled: every 15 min on Saturdays, every 12 hours otherwise.');
}

module.exports = { start, refreshCurrentWeek };
