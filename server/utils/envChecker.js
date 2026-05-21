const REQUIRED_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'OPENROUTER_API_KEY'
];

const OPTIONAL_VARS = [
  { name: 'PORT', default: '5000' },
  { name: 'CLIENT_URL', default: 'http://localhost:5173' },
  { name: 'NODE_ENV', default: 'development' },
  { name: 'UPLOAD_PATH', default: 'uploads/' }
];

function checkEnvironment() {
  const missing = [];
  const warnings = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  for (const { name, default: def } of OPTIONAL_VARS) {
    if (!process.env[name]) {
      process.env[name] = def;
      warnings.push(`${name} not set, using default: ${def}`);
    }
  }

  if (missing.length > 0) {
    console.error('='.repeat(54));
    console.error('  FATAL: Missing required environment variables:');
    missing.forEach(v => console.error('    - ' + v));
    console.error('='.repeat(54));
    console.error('');
    console.error('  Set these in your Render dashboard Environment Variables');
    console.error('  or in the .env file for local development.');
    console.error('');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('Environment warnings:');
    warnings.forEach(w => console.warn('  - ' + w));
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 10) {
    console.warn('  - WARNING: JWT_SECRET is too short. Use a stronger secret in production.');
  }

  console.log('Environment check passed.');
  return true;
}

module.exports = checkEnvironment;
