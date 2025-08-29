#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Rosarito AI Travel App - Configuration Validator\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('   Please create a .env file in the project root with your API keys.\n');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

const checks = [
  {
    name: 'Firebase API Key',
    env: 'FIREBASE_API_KEY',
    required: true,
    validator: (value) => value && value.length > 20
  },
  {
    name: 'Firebase Project ID',
    env: 'FIREBASE_PROJECT_ID',
    required: true,
    validator: (value) => value === 'mi-rosarita-ai-app'
  },
  {
    name: 'Google AI API Key',
    env: 'GOOGLE_AI_API_KEY',
    required: true,
    validator: (value) => value && value.startsWith('AIza')
  },
  {
    name: 'Amadeus API Key',
    env: 'AMADEUS_API_KEY',
    required: true,
    validator: (value) => value && value.length > 10
  },
  {
    name: 'Amadeus API Secret',
    env: 'AMADEUS_API_SECRET',
    required: true,
    validator: (value) => value && value.length > 20
  },
  {
    name: 'Google Maps API Key',
    env: 'GOOGLE_MAPS_API_KEY',
    required: false,
    validator: (value) => !value || value.length > 20
  },
  {
    name: 'Google Vision API Key',
    env: 'GOOGLE_VISION_API_KEY',
    required: false,
    validator: (value) => !value || value.length > 20
  },
  {
    name: 'Stripe Publishable Key',
    env: 'STRIPE_PUBLISHABLE_KEY',
    required: false,
    validator: (value) => !value || value.startsWith('pk_')
  },
  {
    name: 'Stripe Secret Key',
    env: 'STRIPE_SECRET_KEY',
    required: false,
    validator: (value) => !value || value.startsWith('sk_')
  }
];

let allValid = true;
const results = [];

checks.forEach(check => {
  const value = process.env[check.env];
  const isValid = check.validator(value);

  if (check.required && !isValid) {
    results.push(`❌ ${check.name}: Missing or invalid`);
    allValid = false;
  } else if (!check.required && value && !isValid) {
    results.push(`⚠️  ${check.name}: Invalid format`);
  } else if (isValid) {
    results.push(`✅ ${check.name}: OK`);
  } else {
    results.push(`ℹ️  ${check.name}: Not configured (optional)`);
  }
});

// Check service account file
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  results.push('✅ Google Cloud Service Account: Found');
} else {
  results.push('⚠️  Google Cloud Service Account: Not found (optional)');
}

// Check package.json files
const mainPkgPath = path.join(__dirname, '..', 'package.json');
const functionsPkgPath = path.join(__dirname, '..', 'functions', 'package.json');

if (fs.existsSync(mainPkgPath)) {
  results.push('✅ Main package.json: Found');
} else {
  results.push('❌ Main package.json: Missing');
  allValid = false;
}

if (fs.existsSync(functionsPkgPath)) {
  results.push('✅ Functions package.json: Found');
} else {
  results.push('❌ Functions package.json: Missing');
  allValid = false;
}

// Display results
results.forEach(result => console.log(result));

console.log('\n' + '='.repeat(50));

if (allValid) {
  console.log('🎉 Configuration is valid! You\'re ready to start developing.');
  console.log('\nNext steps:');
  console.log('1. Run `npm install` to install dependencies');
  console.log('2. Run `firebase login` to authenticate with Firebase');
  console.log('3. Run `firebase init` if you haven\'t already');
  console.log('4. Start developing your Rosarito AI Travel App!');
} else {
  console.log('❌ Configuration has issues. Please fix the errors above.');
  console.log('\nFor help, check the Project_Keys_IDs.md file for setup instructions.');
}

console.log('\n🚀 Happy coding!\n');
process.exit(allValid ? 0 : 1);