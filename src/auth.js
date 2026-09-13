const bcrypt = require('bcryptjs');
const db = require('./db');

function createUser({ name, username, password }) {
  const normalizedUsername = username.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
  if (existing) {
    const err = new Error('That username is already taken.');
    err.code = 'USERNAME_TAKEN';
    throw err;
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), normalizedUsername, hash);
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

module.exports = { createUser, verifyLogin, requireAuth, requireAdmin, attachUser };
