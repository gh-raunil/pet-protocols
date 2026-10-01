import { Config, JdkHelper, AndroidSdkTools, ConsoleLog } from '../android-twa/node_modules/@bubblewrap/core/dist/index.js';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.bubblewrap', 'config.json');
const config = await Config.loadConfig(configPath);
const jdkHelper = new JdkHelper(process, config);
const log = new ConsoleLog('SetupSdk');

console.log('Creating AndroidSdkTools instance...');
const sdkTools = await AndroidSdkTools.create(process, config, jdkHelper, log);

console.log('Checking build tools...');
const hasBuildTools = await sdkTools.checkBuildTools();
console.log('Has build tools:', hasBuildTools);

if (!hasBuildTools) {
  console.log('Installing build tools...');
  await sdkTools.installBuildTools();
  console.log('Build tools installed successfully!');
}
