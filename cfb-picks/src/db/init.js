// Run once with: npm run init-db
// Creates the SQLite file/tables (if missing) and optionally an admin user
// from ADMIN_NAME / ADMIN_USERNAME / ADMIN_PASSWORD env vars.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

const { ADMIN_NAME, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

if (ADMIN_NAME && ADMIN_USERNAME && ADMIN_PASSWORD) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME.toLowerCase());
  if (existing) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    console.log(`Marked existing user "${ADMIN_USERNAME}" as admin.`);
  } else {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare(
      'INSERT INTO users (name, username, password_hash, is_admin) VALUES (?, ?, ?, 1)'
    ).run(ADMIN_NAME, ADMIN_USERNAME.toLowerCase(), hash);
    console.log(`Created admin user "${ADMIN_USERNAME}".`);
  }
} else {
  console.log('Database ready. Set ADMIN_NAME/ADMIN_USERNAME/ADMIN_PASSWORD in .env to also create an admin user.');
}
