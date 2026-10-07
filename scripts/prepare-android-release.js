#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const appGradle = path.join(androidDir, "app", "build.gradle");
const appGradleKts = path.join(androidDir, "app", "build.gradle.kts");
const proguard = path.join(androidDir, "app", "proguard-rules.pro");
const shouldBundle = process.argv.includes("--bundle");

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Comando fallito: ${command} ${args.join(" ")}`);
  }
}

function runNpx(args) {
  run(process.platform === "win32" ? "npx.cmd" : "npx", args);
}

function findBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1, bodyStart: braceStart + 1, bodyEnd: i };
    }
  }
  return null;
}

function patchGroovy(source) {
  const block = findBlock(source, "release");
  if (!block) throw new Error("Blocco release non trovato in android/app/build.gradle.");

  let body = source.slice(block.bodyStart, block.bodyEnd);
  body = body.replace(/minifyEnabled\s+(?:true|false)/, "minifyEnabled true");
  if (!/minifyEnabled\s+true/.test(body)) {
    body = `\n            minifyEnabled true${body}`;
  }

  body = body.replace(/shrinkResources\s+(?:true|false)/, "shrinkResources true");
  if (!/shrinkResources\s+true/.test(body)) {
    body = body.replace(/(minifyEnabled\s+true)/, "$1\n            shrinkResources true");
  }

  body = body.replace(/proguard-android\.txt/g, "proguard-android-optimize.txt");
  if (!/proguardFiles\s+/.test(body)) {
    body += "\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n";
  }

  return source.slice(0, block.bodyStart) + body + source.slice(block.bodyEnd);
}

function patchKotlin(source) {
  const block = findBlock(source, "release");
  if (!block) throw new Error("Blocco release non trovato in android/app/build.gradle.kts.");

  let body = source.slice(block.bodyStart, block.bodyEnd);
  body = body.replace(/isMinifyEnabled\s*=\s*(?:true|false)/, "isMinifyEnabled = true");
  if (!/isMinifyEnabled\s*=\s*true/.test(body)) {
    body = `\n        isMinifyEnabled = true${body}`;
  }

  body = body.replace(/isShrinkResources\s*=\s*(?:true|false)/, "isShrinkResources = true");
  if (!/isShrinkResources\s*=\s*true/.test(body)) {
    body = body.replace(/(isMinifyEnabled\s*=\s*true)/, "$1\n        isShrinkResources = true");
  }

  body = body.replace(/proguard-android\.txt/g, "proguard-android-optimize.txt");
  if (!/proguardFiles\s*\(/.test(body)) {
    body += "\n        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")\n";
  }

  return source.slice(0, block.bodyStart) + body + source.slice(block.bodyEnd);
}

function prepareAndroid() {
  if (!fs.existsSync(path.join(androidDir, "gradlew")) && !fs.existsSync(path.join(androidDir, "gradlew.bat"))) {
    runNpx(["cap", "add", "android"]);
  }

  runNpx(["cap", "sync", "android"]);

  if (fs.existsSync(appGradle)) {
    const before = fs.readFileSync(appGradle, "utf8");
    const after = patchGroovy(before);
    if (after !== before) fs.writeFileSync(appGradle, after);
  } else if (fs.existsSync(appGradleKts)) {
    const before = fs.readFileSync(appGradleKts, "utf8");
    const after = patchKotlin(before);
    if (after !== before) fs.writeFileSync(appGradleKts, after);
  } else {
    throw new Error("File Gradle dell'app Android non trovato.");
  }

  if (!fs.existsSync(proguard)) fs.writeFileSync(proguard, "# Regole R8 specifiche dell'app\n");
  console.log("Configurazione R8 applicata solo alla build release Android.");
}

try {
  prepareAndroid();

  if (shouldBundle) {
    const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
    run(gradleCommand, ["bundleRelease"], androidDir);
    console.log("AAB generato nella cartella android/app/build/outputs/bundle/release.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
