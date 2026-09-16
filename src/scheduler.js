// Automatically keeps the most recently loaded week's scores up to date,
// so nobody has to remember to click "Refresh scores" on the Admin page.
//
// Schedule: every 15 minutes, every day - college football has games
// scattered across weeknights too (MAC/Group of 5 Tuesday/Wednesday
// games, Thursday/Friday night games, etc.), not just Saturdays.
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
  // Every 15 minutes, every day of the week.
  cron.schedule('*/15 * * * *', () => refreshCurrentWeek('15-min'));

  console.log('[scheduler] Auto-refresh scheduled: every 15 minutes, every day.');
}

module.exports = { start, refreshCurrentWeek };
