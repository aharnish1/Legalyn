// Global crash handlers — must be at the very top (never silent crash)
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // Don't exit — let the server attempt to recover or keep running
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Safe dotenv — silent fail if no .env file (production on Render uses dashboard vars)
try {
  require('dotenv').config();
} catch (err) {
  console.warn('dotenv: No .env file found, using environment variables.');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const connectWithRetry = require('./config/db');
const checkEnvironment = require('./utils/envChecker');
const resp = require('./utils/responseHelper');

// Validate environment before starting
checkEnvironment();

// Ensure uploads directory exists (production-safe)
const uploadDir = process.env.UPLOAD_PATH || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created uploads directory: ${uploadDir}`);
}

const app = express();

// Trust proxy if behind a reverse proxy (needed for rate limiting)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// CORS — origin always from env, never hardcoded
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose && mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));

// Root
app.get('/', (req, res) => {
  resp.success(res, { service: 'Legalyn API', version: '1.0.0' }, 'API is running');
});

// 404 handler
app.use((req, res) => {
  resp.notFound(res, `Route ${req.originalUrl} not found`);
});

// Global error handler
app.use((err, req, res, _next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return resp.badRequest(res, 'File size too large. Maximum size is 10MB');
  }
  if (err.message === 'Only PDF files are allowed') {
    return resp.badRequest(res, err.message);
  }

  // Handle mongoose validation errors
  if (err.name === 'ValidationError') {
    return resp.error(res, 'Validation error', err.message, 400);
  }

  // Handle mongoose duplicate key errors
  if (err.code === 11000) {
    return resp.error(res, 'Duplicate entry', err.message, 409);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return resp.unauthorized(res, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return resp.unauthorized(res, 'Token expired');
  }

  console.error('Unhandled Error:', err);
  resp.error(res, 'Internal server error', err, statusCode);
});

// ──────────────────────────────────────────────
// START SERVER (does NOT wait for MongoDB)
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(54));
  console.log('  Legalyn API Server');
  console.log('  Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('  Port:        ' + PORT);
  console.log('  Client URL:  ' + process.env.CLIENT_URL);
  console.log('  CORS Origin: ' + allowedOrigin);
  console.log('');
  console.log('  Environment variable status:');
  console.log('    MONGODB_URI:      ' + (process.env.MONGODB_URI ? '✅ configured' : '❌ MISSING'));
  console.log('    JWT_SECRET:      ' + (process.env.JWT_SECRET ? '✅ configured' : '❌ MISSING'));
  console.log('    OPENROUTER_KEY:  ' + (process.env.OPENROUTER_API_KEY ? '✅ configured' : '❌ MISSING'));
  console.log('');
  console.log('='.repeat(54));
  console.log('');
});

// Increase server timeout for long AI operations
server.timeout = 180000;

// ──────────────────────────────────────────────
// MONGODB — connect with retry, never crash
// ──────────────────────────────────────────────
console.log('Starting MongoDB connection (with retry)...');
connectWithRetry().then((conn) => {
  if (conn) {
    console.log('MongoDB connection established. All systems ready.');
  } else {
    console.warn('MongoDB connection pending — server running without database.');
    console.warn('Routes that require the database will return errors until connected.');
  }
});

// ──────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ──────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
