import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '..', 'public', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tmpDesktop = path.join(os.tmpdir(), 'pet-desktop.png');
const tmpMobile = path.join(os.tmpdir(), 'pet-mobile.png');

if (fs.existsSync(tmpDesktop)) fs.unlinkSync(tmpDesktop);
if (fs.existsSync(tmpMobile)) fs.unlinkSync(tmpMobile);

console.log('Capturing Desktop Screenshot (1280x720) to temp...');
const res1 = spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1280,720',
  `--screenshot=${tmpDesktop}`,
  'https://pet-protocols.vercel.app/',
], { timeout: 20000 });

console.log('Desktop capture result:', res1.status);
if (fs.existsSync(tmpDesktop)) {
  fs.copyFileSync(tmpDesktop, path.join(screenshotsDir, 'desktop-home.png'));
  console.log('Copied desktop-home.png successfully!');
} else {
  console.error('Temp desktop screenshot not found. Stderr:', res1.stderr?.toString());
}

console.log('Capturing Mobile Screenshot (750x1334) to temp...');
const res2 = spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=750,1334',
  `--screenshot=${tmpMobile}`,
  'https://pet-protocols.vercel.app/',
], { timeout: 20000 });

console.log('Mobile capture result:', res2.status);
if (fs.existsSync(tmpMobile)) {
  fs.copyFileSync(tmpMobile, path.join(screenshotsDir, 'mobile-home.png'));
  console.log('Copied mobile-home.png successfully!');
} else {
  console.error('Temp mobile screenshot not found. Stderr:', res2.stderr?.toString());
}

console.log('Final screenshots directory contents:', fs.readdirSync(screenshotsDir));
