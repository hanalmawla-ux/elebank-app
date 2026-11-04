// Run after `npx cap add android`: adds the icon-switching plugin, 5 launcher aliases and icon resources.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), MAIN = path.join(ROOT, 'android/app/src/main');
const ALT = path.join(ROOT, 'assets/alt-icons');
const COLORS = JSON.parse(fs.readFileSync(path.join(ALT, 'colors.json'), 'utf8'));
const cap = s => s[0].toUpperCase() + s.slice(1);

const pkgDir = path.join(MAIN, 'java/com/elebank/app');
if (!fs.existsSync(pkgDir)) throw new Error('Java folder not found: ' + pkgDir);
fs.copyFileSync(path.join(ROOT, 'native/android/IconPlugin.java'), path.join(pkgDir, 'IconPlugin.java'));
fs.writeFileSync(path.join(pkgDir, 'MainActivity.java'), `package com.elebank.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

const res = path.join(MAIN, 'res');
for (const d of ['drawable-xxxhdpi', 'mipmap-xxxhdpi', 'mipmap-anydpi-v26', 'values']) fs.mkdirSync(path.join(res, d), { recursive: true });
let colorsXml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
for (const [c, bg] of Object.entries(COLORS)) {
  fs.copyFileSync(path.join(ALT, `${c}-fg.png`), path.join(res, 'drawable-xxxhdpi', `ic_${c}_fg.png`));
  fs.copyFileSync(path.join(ALT, `${c}-legacy.png`), path.join(res, 'mipmap-xxxhdpi', `ic_${c}.png`));
  fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', `ic_${c}.xml`),
    `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_${c}_bg"/>\n    <foreground android:drawable="@drawable/ic_${c}_fg"/>\n</adaptive-icon>\n`);
  colorsXml += `    <color name="ic_${c}_bg">${bg}</color>\n`;
}
fs.writeFileSync(path.join(res, 'values/ic_colors.xml'), colorsXml + '</resources>\n');

const mf = path.join(MAIN, 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
const launcher = /<intent-filter>\s*<action android:name="android.intent.action.MAIN"\s*\/>\s*<category android:name="android.intent.category.LAUNCHER"\s*\/>\s*<\/intent-filter>/;
if (!launcher.test(x)) throw new Error('Launcher intent-filter not found in AndroidManifest.xml');
x = x.replace(launcher, '');
const aliases = Object.keys(COLORS).map(c => `
        <activity-alias
            android:name=".Icon${cap(c)}"
            android:enabled="${c === 'pink'}"
            android:exported="true"
            android:icon="@mipmap/ic_${c}"
            android:roundIcon="@mipmap/ic_${c}"
            android:label="@string/app_name"
            android:targetActivity=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`).join('\n');
if (!x.includes('</application>')) throw new Error('</application> not found');
x = x.replace('</application>', aliases + '\n    </application>');
fs.writeFileSync(mf, x);
console.log('Android icon switching patched.');
