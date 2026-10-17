const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Guarantee Windows system directories are in PATH and ComSpec is set
if (process.platform === 'win32') {
  process.env.ComSpec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
  const sysDirs = [
    'C:\\Windows\\System32',
    'C:\\Windows',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
    'C:\\Windows\\System32\\Wbem',
  ];
  const currentPath = process.env.PATH || '';
  const toAdd = sysDirs.filter(d => !currentPath.toLowerCase().includes(d.toLowerCase()));
  if (toAdd.length > 0) {
    process.env.PATH = `${toAdd.join(';')};${currentPath}`;
  }
}

// Ensure Electron binary is present
const electronDistExe = path.join(__dirname, '../node_modules/electron/dist/electron.exe');
const electronPathFile = path.join(__dirname, '../node_modules/electron/path.txt');

if (!fs.existsSync(electronDistExe) || !fs.existsSync(electronPathFile)) {
  console.log('⬇️ Electron binary missing. Running setup-electron.js...');
  try {
    execSync('node scripts/setup-electron.js', {
      stdio: 'inherit',
      env: process.env,
      shell: true,
    });
  } catch (err) {
    console.error('❌ Failed to set up Electron binary.');
    process.exit(1);
  }
}

console.log('📦 Compiling Electron TypeScript files...');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

try {
  execSync(`${npx} tsc -p tsconfig.electron.json`, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
} catch (err) {
  console.error('❌ Failed to compile Electron files.');
  process.exit(1);
}

// Function to check if Vite server is already responding on port 5173
function checkServer(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(400, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(port, callback, retries = 50) {
  if (retries <= 0) {
    console.error('❌ Timed out waiting for Vite server.');
    process.exit(1);
  }
  const req = http.get(`http://localhost:${port}/`, (res) => {
    callback();
  });
  req.on('error', () => {
    setTimeout(() => waitForServer(port, callback, retries - 1), 300);
  });
}

async function start() {
  const isRunning = await checkServer(5173);
  let viteProcess = null;

  if (isRunning) {
    console.log('⚡ Vite dev server already running on port 5173.');
  } else {
    // If something else holds the port but isn't responding, kill it
    if (process.platform === 'win32') {
      try {
        const output = execSync('netstat -ano -p tcp | findstr :5173', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
              try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
            }
          }
        }
      } catch {}
    }

    console.log('🚀 Starting Vite development server on port 5173...');
    viteProcess = spawn(npx, ['vite'], {
      stdio: 'inherit',
      env: process.env,
      shell: true,
    });
  }

  waitForServer(5173, () => {
    console.log('⚡ Launching FocusFlow Electron desktop app...');
    const electronProcess = spawn(npx, ['electron', '.'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
      shell: true,
    });

    electronProcess.on('close', (code) => {
      console.log('FocusFlow window closed.');
      if (viteProcess) {
        console.log('Shutting down Vite dev server...');
        viteProcess.kill();
      }
      process.exit(code || 0);
    });
  });

  const cleanup = () => {
    if (viteProcess) {
      try { viteProcess.kill(); } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start();
