const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist-electron');
const packageJsonPath = path.join(distDir, 'package.json');

// Ensure the directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const content = {
  type: 'commonjs'
};

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(content, null, 2));
  console.log('Successfully created dist-electron/package.json with {"type": "commonjs"}');
} catch (error) {
  console.error('Error creating dist-electron/package.json:', error);
  process.exit(1);
}
