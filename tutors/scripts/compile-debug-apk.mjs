import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tutorsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidRoot = path.join(tutorsRoot, 'android');
const buildTemp = 'C:/jtmp/pk';
const javaHome = process.env.JAVA_HOME || 'C:/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot';
const androidHome = process.env.ANDROID_HOME || 'C:/Users/Jabu Babb/AppData/Local/Android/Sdk';

await mkdir(buildTemp, { recursive: true });

const commandProcessor = process.env.ComSpec || 'C:/Windows/System32/cmd.exe';
const child = spawn(commandProcessor, ['/d', '/s', '/c', 'gradlew.bat --no-daemon assembleDebug --no-problems-report'], {
  cwd: androidRoot,
  shell: false,
  windowsHide: true,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT || androidHome,
    GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'C:/Users/Jabu Babb/.gradle',
    TEMP: buildTemp,
    TMP: buildTemp,
    PATH: `${javaHome}/bin;${androidHome}/platform-tools;${process.env.PATH ?? ''}`,
  },
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', resolve);
});

if (exitCode !== 0) process.exitCode = Number(exitCode ?? 1);
