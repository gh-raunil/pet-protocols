import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const twaDir = path.join(rootDir, 'android-twa');

const javaHome = path.join(os.homedir(), '.bubblewrap', 'jdk', 'jdk-17.0.11+9');
const androidHome = path.join(os.homedir(), '.bubblewrap', 'android_sdk');
const buildToolsVersion = '36.1.0';
const buildToolsDir = path.join(androidHome, 'build-tools', buildToolsVersion);
const zipalignExe = path.join(buildToolsDir, 'zipalign.exe');
const apksignerJar = path.join(buildToolsDir, 'lib', 'apksigner.jar');
const javaExe = path.join(javaHome, 'bin', 'java.exe');

const keystorePath = path.join(twaDir, 'pet-protocols-release.keystore');
const keystoreAlias = 'petprotocols';
const keystorePass = 'PetProtocols2026!';
const expectedSha256 = 'A7:F1:5C:26:FD:E6:E0:26:A3:1B:58:03:F3:C2:DD:0F:36:CE:D8:F0:2F:D2:41:88:76:D5:FB:B7:38:CB:AB:74';

console.log('=== Step 1: Environment Verification ===');
console.log('JAVA_HOME:', javaHome);
console.log('ANDROID_HOME:', androidHome);
console.log('Keystore Path:', keystorePath);
console.log('Keystore Exists:', fs.existsSync(keystorePath));

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome,
  Path: `${path.join(javaHome, 'bin')};${buildToolsDir};${process.env.Path}`,
};

console.log('\n=== Step 2: Running Gradle assembleRelease ===');
const gradlewBat = path.join(twaDir, 'gradlew.bat');
execSync(`"${gradlewBat}" assembleRelease --stacktrace`, {
  cwd: twaDir,
  env,
  stdio: 'inherit',
});

const unsignedApk = path.join(twaDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
if (!fs.existsSync(unsignedApk)) {
  throw new Error(`Unsigned APK not found at: ${unsignedApk}`);
}
console.log('\nUnsigned APK built successfully:', unsignedApk);

console.log('\n=== Step 3: Zipalign APK ===');
const alignedApk = path.join(twaDir, 'app-release-unsigned-aligned.apk');
if (fs.existsSync(alignedApk)) {
  fs.unlinkSync(alignedApk);
}
execSync(`"${zipalignExe}" -v -f -p 4 "${unsignedApk}" "${alignedApk}"`, {
  env,
  stdio: 'pipe',
});
console.log('Zipalign completed:', alignedApk);

console.log('\n=== Step 4: Signing Release APK with apksigner ===');
const signedApk = path.join(twaDir, 'pet-protocols-release-signed.apk');
if (fs.existsSync(signedApk)) {
  fs.unlinkSync(signedApk);
}

const signCmd = `"${javaExe}" -jar "${apksignerJar}" sign --ks "${keystorePath}" --ks-key-alias ${keystoreAlias} --ks-pass pass:${keystorePass} --key-pass pass:${keystorePass} --out "${signedApk}" "${alignedApk}"`;
execSync(signCmd, { env, stdio: 'inherit' });
console.log('Release APK signed successfully:', signedApk);

console.log('\n=== Step 5: Verifying APK Signature and Certificates ===');
const verifyCmd = `"${javaExe}" -jar "${apksignerJar}" verify --verbose --print-certs "${signedApk}"`;
const verifyOutput = execSync(verifyCmd, { env, encoding: 'utf8' });
console.log(verifyOutput);

console.log('\n=== Step 6: Certificate Fingerprint Check ===');
const sha256Match = verifyOutput.match(/certificate SHA-256 digest:\s*([0-9a-fA-F:]+)/i);
if (!sha256Match) {
  console.warn('Could not regex match SHA-256 digest in apksigner output.');
} else {
  const actualSha256 = sha256Match[1].replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  const normalizedExpected = expectedSha256.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  console.log('APK Certificate SHA-256:     ', actualSha256);
  console.log('Expected AssetLinks SHA-256: ', normalizedExpected);
  if (actualSha256 === normalizedExpected) {
    console.log('✅ PERFECT MATCH: APK signing key exactly matches AssetLinks SHA-256!');
  } else {
    throw new Error(`Fingerprint mismatch! APK: ${actualSha256} vs Expected: ${normalizedExpected}`);
  }
}

const apkStats = fs.statSync(signedApk);
console.log('\n=== Final Signed Release APK Details ===');
console.log('Path:        ', signedApk);
console.log('File Size:   ', (apkStats.size / (1024 * 1024)).toFixed(2), 'MB (', apkStats.size, 'bytes )');
