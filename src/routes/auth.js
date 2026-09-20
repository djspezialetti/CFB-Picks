const express = require('express');
const rateLimit = require('express-rate-limit');
const { createUser, verifyLogin } = require('../auth');

const router = express.Router();

// Slows down scripted/automated abuse without getting in the way of a
// real person occasionally mistyping a password. These count per IP.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many accounts created from this network recently. Try again later.',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Wait a few minutes and try again.',
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null, form: {}, requiresCode: !!process.env.REGISTRATION_CODE });
});

router.post('/register', registerLimiter, (req, res) => {
  const { name, username, password, confirmPassword, inviteCode } = req.body;
  const requiresCode = !!process.env.REGISTRATION_CODE;

  if (!name || !username || !password) {
    return res.status(400).render('register', { error: 'All fields are required.', form: req.body, requiresCode });
  }
  if (requiresCode && inviteCode !== process.env.REGISTRATION_CODE) {
    // Deliberately vague error - doesn't hint at whether the code was
    // close or which field was wrong, so it's not useful feedback for
    // someone guessing.
    return res.status(400).render('register', { error: 'Incorrect invite code.', form: req.body, requiresCode });
  }
  if (password.length < 6) {
    return res.status(400).render('register', { error: 'Password must be at least 6 characters.', form: req.body, requiresCode });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Passwords do not match.', form: req.body, requiresCode });
  }

  try {
    const user = createUser({ name, username, password });
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.isAdmin = !!user.is_admin;
    res.redirect('/');
  } catch (err) {
    const message = err.code === 'USERNAME_TAKEN' ? err.message : 'Could not create account.';
    res.status(400).render('register', { error: message, form: req.body, requiresCode });
  }
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null, form: {} });
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = verifyLogin(username || '', password || '');
  if (!user) {
    return res.status(400).render('login', { error: 'Incorrect username or password.', form: req.body });
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.isAdmin = !!user.is_admin;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
