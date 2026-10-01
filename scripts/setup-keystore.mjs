import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const androidTwaDir = path.join(projectRoot, 'android-twa');

if (!fs.existsSync(androidTwaDir)) {
  fs.mkdirSync(androidTwaDir, { recursive: true });
}

const keytool = 'C:\\Program Files\\Java\\jdk-24\\bin\\keytool.exe';
const ksPath = path.join(androidTwaDir, 'pet-protocols-release.keystore');
const alias = 'petprotocols';
const pass = 'PetProtocols2026!';

if (!fs.existsSync(ksPath)) {
  console.log('Generating release keystore at:', ksPath);
  execFileSync(keytool, [
    '-genkeypair',
    '-v',
    '-keystore', ksPath,
    '-alias', alias,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-storepass', pass,
    '-keypass', pass,
    '-dname', 'CN=Pet Protocols, OU=Mobile, O=Pet Protocols, L=Bangalore, ST=Karnataka, C=IN',
  ]);
  console.log('Release keystore created successfully.');
} else {
  console.log('Release keystore already exists at:', ksPath);
}

// Extract SHA-256 fingerprint
const certOutput = execFileSync(keytool, [
  '-list',
  '-v',
  '-keystore', ksPath,
  '-alias', alias,
  '-storepass', pass,
], { encoding: 'utf8' });

const sha256Match = certOutput.match(/SHA256:\s*([A-F0-9:]+)/i);
if (sha256Match) {
  const sha256 = sha256Match[1].trim();
  console.log('SHA256 FINGERPRINT:', sha256);

  // Write env documentation (not committed to git)
  fs.writeFileSync(path.join(androidTwaDir, 'keystore.env'), `KEYSTORE_PATH=${ksPath}
KEYSTORE_ALIAS=${alias}
KEYSTORE_PASS=${pass}
KEYSTORE_SHA256=${sha256}
`);

  // Write AssetLinks
  const wellKnownDir = path.join(projectRoot, 'frontend-user', 'public', '.well-known');
  if (!fs.existsSync(wellKnownDir)) {
    fs.mkdirSync(wellKnownDir, { recursive: true });
  }

  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'app.vercel.pet_protocols.twa',
        sha256_cert_fingerprints: [sha256],
      },
    },
  ];

  fs.writeFileSync(
    path.join(wellKnownDir, 'assetlinks.json'),
    JSON.stringify(assetLinks, null, 2)
  );
  console.log('Wrote assetlinks.json successfully to:', path.join(wellKnownDir, 'assetlinks.json'));
} else {
  console.error('Could not parse SHA-256 from keytool output:', certOutput);
}
