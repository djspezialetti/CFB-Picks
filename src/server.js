require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

require('./db'); // ensures schema is created before routes touch it
const { attachUser } = require('./auth-service');

const authRoutes = require('./routes/auth');
const pickRoutes = require('./routes/picks');
const standingsRoutes = require('./routes/standings');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', 1); // needed if running behind nginx/a reverse proxy with secure cookies

// Cache-busting for the stylesheet: append the file's last-modified time
// as a query string (e.g. style.css?v=1234). Since Cloudflare (and
// browsers) cache static files like CSS aggressively by URL, changing
// this value whenever the file changes forces a fresh fetch instead of
// requiring a manual cache purge after every deploy - the app picks up
// the new mtime automatically on its next restart.
try {
  app.locals.assetVersion = require('fs').statSync(path.join(__dirname, '..', 'public', 'css', 'style.css')).mtimeMs;
} catch (err) {
  app.locals.assetVersion = Date.now(); // fallback if the file is ever missing
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, '..', 'data') }),
    secret: process.env.SESSION_SECRET || 'change-this-secret-before-deploying',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // requires HTTPS in production (set NODE_ENV=production behind TLS)
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

app.use(attachUser);

app.use('/', authRoutes);
app.use('/', pickRoutes);
app.use('/', standingsRoutes);
app.use('/', adminRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`CFB Picks running at http://localhost:${PORT}`);
  require('./scheduler').start();
});
