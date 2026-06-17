// ============================================
// RUN THIS ONCE: node add-dashboard.js
// It will:
//   1. Create public/ folder
//   2. Patch src/index.js with static file serving
//   3. Tell you to copy index.html
// ============================================

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';

const green = (t) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t) => `\x1b[33m${t}\x1b[0m`;
const red = (t) => `\x1b[31m${t}\x1b[0m`;

console.log('\n' + green('=== Dashboard Setup ===') + '\n');

// Step 1: Create public/ folder
if (!existsSync('public')) {
  mkdirSync('public');
  console.log(green('✓') + ' Created public/ folder');
} else {
  console.log(yellow('⊘') + ' public/ folder already exists');
}

// Step 2: Patch src/index.js
const indexPath = 'src/index.js';
if (!existsSync(indexPath)) {
  console.log(red('✗') + ' src/index.js not found! Make sure you run this from the project root.');
  process.exit(1);
}

let code = readFileSync(indexPath, 'utf-8');
let changes = 0;

// 2a: Add fileURLToPath and dirname imports if missing
if (!code.includes('fileURLToPath')) {
  code = code.replace(
    "import express from 'express';",
    `import express from 'express';\nimport { fileURLToPath } from 'url';\nimport { dirname, join } from 'path';`
  );
  changes++;
  console.log(green('✓') + ' Added fileURLToPath and dirname imports');
} else {
  console.log(yellow('⊘') + ' Imports already present');
}

// 2b: Add __dirname definition if missing
if (!code.includes('__dirname')) {
  code = code.replace(
    "const app = express();",
    `const __dirname = dirname(fileURLToPath(import.meta.url));\n\nconst app = express();`
  );
  changes++;
  console.log(green('✓') + ' Added __dirname definition');
} else {
  console.log(yellow('⊘') + ' __dirname already defined');
}

// 2c: Add static file serving if missing
if (!code.includes('express.static')) {
  code = code.replace(
    "app.use(express.json());",
    `app.use(express.json());\napp.use(express.static(join(__dirname, '..', 'public')));`
  );
  changes++;
  console.log(green('✓') + ' Added static file serving middleware');
} else {
  console.log(yellow('⊘') + ' Static serving already configured');
}

if (changes > 0) {
  writeFileSync(indexPath, code);
  console.log(green('✓') + ` Saved ${changes} changes to src/index.js`);
} else {
  console.log(yellow('⊘') + ' No changes needed in src/index.js');
}

// Step 3: Check if index.html exists
if (existsSync('public/index.html')) {
  console.log(green('\n✓ Dashboard is ready!'));
  console.log('  Run: npm start');
  console.log('  Open: http://localhost:3000\n');
} else {
  console.log(yellow('\n⚠ Almost done!'));
  console.log('  Copy the downloaded index.html into the public/ folder:');
  console.log('  public/index.html');
  console.log('  Then run: npm start\n');
}
