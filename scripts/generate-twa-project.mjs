import { TwaGenerator, TwaManifest, ConsoleLog } from '../android-twa/node_modules/@bubblewrap/core/dist/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDirectory = path.resolve(__dirname, '../android-twa');
const manifestPath = path.join(targetDirectory, 'twa-manifest.json');

console.log('Loading twa-manifest from:', manifestPath);
const twaManifest = await TwaManifest.fromFile(manifestPath);
console.log('Package ID:', twaManifest.packageId);
console.log('App Name:', twaManifest.name);
console.log('Host:', twaManifest.host);

const log = new ConsoleLog('TwaGenerator');
const generator = new TwaGenerator();

console.log('Creating TWA Project in:', targetDirectory);
await generator.createTwaProject(targetDirectory, twaManifest, log, (current, total) => {
  console.log(`Progress: ${Math.round((current / total) * 100)}%`);
});

console.log('TWA project generated successfully!');
