const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(projectRoot, "android");
const resourcesRoot = path.join(androidRoot, "app", "src", "main", "res");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");

if (!fs.existsSync(androidRoot)) {
  throw new Error("Progetto Android non trovato. Esegui prima: npx cap add android");
}

function listStyleFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "values" || entry.name.startsWith("values-")) {
        const stylePath = path.join(entryPath, "styles.xml");
        if (fs.existsSync(stylePath)) result.push(stylePath);
      }
      result.push(...listStyleFiles(entryPath));
    }
  }
  return result;
}

function forceNoActionBarTheme(content) {
  const stylePattern = /<style\b([^>]*\bname=["']AppTheme(?:\.[^"']*)?["'][^>]*)>/g;
  return content.replace(stylePattern, (full, attributes) => {
    if (/\bparent=["'][^"']*["']/.test(attributes)) {
      return "<style" + attributes.replace(/\bparent=["'][^"']*["']/, 'parent="@android:style/Theme.Material.Light.NoActionBar') + ">";
    }
    return "<style" + attributes + ' parent="@android:style/Theme.Material.Light.NoActionBar">';
  });
}

fs.mkdirSync(path.join(resourcesRoot, "values"), { recursive: true });
const styleFiles = listStyleFiles(resourcesRoot);
let foundAppTheme = false;

for (const stylePath of styleFiles) {
  const original = fs.readFileSync(stylePath, "utf8");
  const updated = forceNoActionBarTheme(original);
  if (updated !== original) fs.writeFileSync(stylePath, updated);
  if (/<style\b[^>]*\bname=["']AppTheme(?:\.[^"']*)?["']/.test(updated)) {
    foundAppTheme = true;
  }
}

if (!foundAppTheme) {
  fs.writeFileSync(
    path.join(resourcesRoot, "values", "styles.xml"),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
      '    <style name="AppTheme" parent="@android:style/Theme.Material.Light.NoActionBar" />\n' +
      '</resources>\n'
  );
}

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  const applicationPattern = /<application\b([^>]*)>/;
  const applicationMatch = manifest.match(applicationPattern);
  if (applicationMatch) {
    let attributes = applicationMatch[1];
    if (/\bandroid:theme=["'][^"']*["']/.test(attributes)) {
      attributes = attributes.replace(/\bandroid:theme=["'][^"']*["']/, 'android:theme="@style/AppTheme"');
    } else {
      attributes += ' android:theme="@style/AppTheme"';
    }
    manifest = manifest.replace(applicationPattern, "<application" + attributes + ">");
  }
  fs.writeFileSync(manifestPath, manifest);
}

console.log("Android Toolbar rimossa: tema AppTheme impostato su NoActionBar.");
