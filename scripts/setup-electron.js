const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function setup() {
  const electronDir = path.resolve(__dirname, '../node_modules/electron');
  const distDir = path.join(electronDir, 'dist');
  const pathFile = path.join(electronDir, 'path.txt');
  const electronExe = path.join(distDir, 'electron.exe');

  if (fs.existsSync(electronExe) && fs.existsSync(pathFile)) {
    console.log('✅ Electron binary already exists at:', electronExe);
    return;
  }

  // Find cached zip or download it
  let zipPath = null;
  const cacheBase = path.join(process.env.LOCALAPPDATA || '', 'electron/Cache');
  
  if (fs.existsSync(cacheBase)) {
    // Search cache folder for electron-v33.2.0-win32-x64.zip
    const findZip = (dir) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          const res = findZip(full);
          if (res) return res;
        } else if (file.includes('electron-v33.2.0') && file.endsWith('.zip')) {
          return full;
        }
      }
      return null;
    };
    try {
      zipPath = findZip(cacheBase);
    } catch {}
  }

  if (zipPath) {
    console.log('📦 Found cached Electron zip:', zipPath);
  } else {
    console.log('⬇️ Fetching Electron via @electron/get...');
    const { downloadArtifact } = require('@electron/get');
    zipPath = await downloadArtifact({
      version: '33.2.0',
      artifactName: 'electron',
      platform: 'win32',
      arch: 'x64',
    });
    console.log('Downloaded to:', zipPath);
  }

  console.log('📦 Extracting to:', distDir, '...');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Use tar.exe (built-in Windows 10/11) or PowerShell Expand-Archive
  let extracted = false;
  try {
    console.log('Running tar extraction...');
    execSync(`tar -xf "${zipPath}" -C "${distDir}"`, { stdio: 'inherit' });
    extracted = true;
  } catch (err) {
    console.warn('tar extraction failed, trying PowerShell Expand-Archive...');
  }

  if (!extracted) {
    try {
      console.log('Running PowerShell Expand-Archive...');
      execSync(
        `powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${distDir}' -Force"`,
        { stdio: 'inherit' }
      );
      extracted = true;
    } catch (err) {
      console.error('PowerShell extraction failed:', err);
    }
  }

  if (!fs.existsSync(electronExe)) {
    throw new Error('electron.exe was not found in ' + distDir + ' after extraction.');
  }

  // Write path.txt and version file
  fs.writeFileSync(pathFile, 'electron.exe', 'utf8');
  fs.writeFileSync(path.join(distDir, 'version'), 'v33.2.0', 'utf8');

  console.log('🎉 Electron successfully installed!');
  console.log('Executable verified at:', electronExe);
  console.log('Path configuration written to:', pathFile);
}

setup().catch((err) => {
  console.error('❌ Setup error:', err.message);
  process.exit(1);
});
