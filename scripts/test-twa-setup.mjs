import { Config, JdkHelper, AndroidSdkTools } from '../android-twa/node_modules/@bubblewrap/core/dist/index.js';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.bubblewrap', 'config.json');
const jdkPath = path.join(os.homedir(), '.bubblewrap', 'jdk', 'jdk-17.0.11+9');
const androidSdkPath = path.join(os.homedir(), '.bubblewrap', 'android_sdk');

const config = new Config(jdkPath, androidSdkPath);
await config.saveConfig(configPath);
console.log('Saved config to:', configPath);

const loadedConfig = await Config.loadConfig(configPath);
console.log('Loaded config:', loadedConfig);

const jdkValidation = await JdkHelper.validatePath(loadedConfig.jdkPath);
console.log('JDK valid:', jdkValidation.isOk(), jdkValidation.isOk() ? jdkValidation.unwrap() : jdkValidation.unwrapError());

const sdkValidation = await AndroidSdkTools.validatePath(loadedConfig.androidSdkPath);
console.log('SDK valid:', sdkValidation.isOk(), sdkValidation.isOk() ? sdkValidation.unwrap() : sdkValidation.unwrapError());
