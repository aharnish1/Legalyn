// Global crash handlers — must be at the very top
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
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
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
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

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL,
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
    environment: process.env.NODE_ENV || 'development'
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

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('MongoDB connected successfully.');

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(54));
      console.log('  Legalyn API Server');
      console.log('  Environment: ' + (process.env.NODE_ENV || 'development'));
      console.log('  Port:        ' + PORT);
      console.log('  Client URL:  ' + process.env.CLIENT_URL);
      console.log('  OpenRouter:  ' + (process.env.OPENROUTER_API_KEY ? 'configured' : 'MISSING'));
      console.log('='.repeat(54));
      console.log('');
    });

    // Increase server timeout for long AI operations
    server.timeout = 180000;

    // Graceful shutdown
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
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
