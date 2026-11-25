const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { CATEGORIES, LOCATIONS, ITEM_STATUSES } = require('./models/Item');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const claimRoutes = require('./routes/claimRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

/* --------------------------- security headers --------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Bar charts set widths with inline styles, so inline styles stay allowed.
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

const origins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests and tools such as Postman send no Origin header.
      if (!origin || !origins.length || origins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

/* ----------------------------- body parsing ---------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitize);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/* ------------------------------ static site ---------------------------- */
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

/* -------------------------------- utility ------------------------------ */
app.get('/api/meta', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Campus Lost & Found Portal',
      version: '1.0.0',
      categories: CATEGORIES,
      locations: LOCATIONS,
      itemStatuses: ITEM_STATUSES,
      claimStatuses: ['pending', 'approved', 'rejected'],
      reportTypes: ['lost', 'found'],
      maxImageSizeMb: 2,
    },
  });
});

app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || 'unknown';
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    success: mongoose.connection.readyState === 1,
    status: 'ok',
    database: dbState,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------- routers ------------------------------ */
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

/* ---------------------------- 404 + errors ----------------------------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
