const bcrypt = require('bcryptjs');
const db = require('./db');

function createUser({ name, username, password }) {
  const normalizedUsername = username.trim().toLowerCase();
  const trimmedName = name.trim();

  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
  if (existingUsername) {
    const err = new Error('That username is already taken.');
    err.code = 'USERNAME_TAKEN';
    throw err;
  }

  // Names are what actually show up everywhere in the app (picks,
  // standings, the board), so two people with the same display name
  // would be genuinely confusing - checked case-insensitively so
  // "Justin" and "justin" still collide.
  const existingName = db
    .prepare('SELECT id FROM users WHERE name = ? COLLATE NOCASE')
    .get(trimmedName);
  if (existingName) {
    const err = new Error(
      `Someone's already using the name "${trimmedName}". Try adding a last initial or nickname, e.g. "${trimmedName} S."`
    );
    err.code = 'NAME_TAKEN';
    throw err;
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)')
    .run(trimmedName, normalizedUsername, hash);
  return db.prepare('SELECT id, name, username, is_admin FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function verifyLogin(username, password) {
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username.trim().toLowerCase());
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return null;
  return user;
}

// Admin-initiated password reset - bypasses the old password entirely,
// for when someone forgets theirs. Returns false if no user with that id
// exists, true otherwise.
function resetPassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  const info = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  return info.changes > 0;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(403).render('error', { message: 'Admins only.' });
  }
  next();
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.userId
    ? { id: req.session.userId, name: req.session.userName, isAdmin: !!req.session.isAdmin }
    : null;
  next();
}

module.exports = { createUser, verifyLogin, resetPassword, requireAuth, requireAdmin, attachUser };
