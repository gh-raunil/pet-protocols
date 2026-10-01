import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const artifactDir = 'C:\\Users\\rouna\\.gemini\\antigravity-ide\\brain\\8c732c1b-f76f-4ad8-be58-50a983dd8222';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const desktopShot = path.join(artifactDir, 'download-desktop.png');
const mobileShot = path.join(artifactDir, 'download-mobile.png');

console.log('Capturing Desktop Screenshot...');
spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1280,3600',
  `--screenshot=${desktopShot}`,
  'http://localhost:3000/download',
], { timeout: 25000 });

console.log('Desktop exists:', fs.existsSync(desktopShot));

console.log('Capturing Mobile Screenshot...');
spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=412,4600',
  `--screenshot=${mobileShot}`,
  'http://localhost:3000/download',
], { timeout: 25000 });

console.log('Mobile exists:', fs.existsSync(mobileShot));
