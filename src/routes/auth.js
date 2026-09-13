const express = require('express');
const { createUser, verifyLogin } = require('../auth');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null, form: {} });
});

router.post('/register', (req, res) => {
  const { name, username, password, confirmPassword } = req.body;

  if (!name || !username || !password) {
    return res.status(400).render('register', { error: 'All fields are required.', form: req.body });
  }
  if (password.length < 6) {
    return res.status(400).render('register', { error: 'Password must be at least 6 characters.', form: req.body });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Passwords do not match.', form: req.body });
  }

  try {
    const user = createUser({ name, username, password });
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.isAdmin = !!user.is_admin;
    res.redirect('/');
  } catch (err) {
    const message = err.code === 'USERNAME_TAKEN' ? err.message : 'Could not create account.';
    res.status(400).render('register', { error: message, form: req.body });
  }
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null, form: {} });
});

router.post('/login', (req, res) => {
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
