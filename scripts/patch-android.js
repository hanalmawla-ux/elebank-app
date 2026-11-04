// Run after `npx cap add android`: adds the icon-switching plugin, 5 launcher aliases and icon resources.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), MAIN = path.join(ROOT, 'android/app/src/main');
const ALT = path.join(ROOT, 'assets/alt-icons');
const NATIVE_SRC = path.join(ROOT, 'native/android/IconPlugin.java');

// --- 1. اذا ملف IconPlugin.java مو موجود، انشئه تلقائياً ---
if (!fs.existsSync(NATIVE_SRC)) {
  console.log('IconPlugin.java not found, creating it...');
  fs.mkdirSync(path.dirname(NATIVE_SRC), { recursive: true });
  fs.writeFileSync(NATIVE_SRC, `package com.elebank.app;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.ComponentName;
import android.content.pm.PackageManager;

@CapacitorPlugin(name = "IconPlugin")
public class IconPlugin extends Plugin {
    @PluginMethod
    public void setIcon(PluginCall call) {
        String icon = call.getString("icon");
        if (icon == null) { call.reject("icon required"); return; }
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            // disable all aliases
            for (String c : new String[]{"pink","blue","green","purple","orange","black","red","yellow"}) {
                try {
                    String cn = pkg + ".Icon" + Character.toUpperCase(c.charAt(0)) + c.substring(1);
                    pm.setComponentEnabledSetting(new ComponentName(pkg, cn), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                } catch (Exception e) {}
            }
            String className = pkg + ".Icon" + Character.toUpperCase(icon.charAt(0)) + icon.substring(1);
            pm.setComponentEnabledSetting(new ComponentName(pkg, className), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            JSObject ret = new JSObject();
            ret.put("icon", icon);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
`);
}

// --- 2. تابع باقي الشغل ---
if (!fs.existsSync(MAIN)) {
  console.log('android folder not ready yet, skipping patch');
  process.exit(0);
}

if (!fs.existsSync(path.join(ALT, 'colors.json'))) {
  console.log('colors.json not found, skipping icon copy');
  process.exit(0);
}

const COLORS = JSON.parse(fs.readFileSync(path.join(ALT, 'colors.json'), 'utf8'));
const cap = s => s[0].toUpperCase() + s.slice(1);

const pkgDir = path.join(MAIN, 'java/com/elebank/app');
fs.mkdirSync(pkgDir, { recursive: true });

fs.copyFileSync(NATIVE_SRC, path.join(pkgDir, 'IconPlugin.java'));
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
  const fgSrc = path.join(ALT, `${c}-fg.png`);
  const legSrc = path.join(ALT, `${c}-legacy.png`);
  if (fs.existsSync(fgSrc)) fs.copyFileSync(fgSrc, path.join(res, 'drawable-xxxhdpi', `ic_${c}_fg.png`));
  if (fs.existsSync(legSrc)) fs.copyFileSync(legSrc, path.join(res, 'mipmap-xxxhdpi', `ic_${c}.png`));
  fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', `ic_${c}.xml`),
    `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_${c}_bg"/>\n    <foreground android:drawable="@drawable/ic_${c}_fg"/>\n</adaptive-icon>\n`);
  colorsXml += `    <color name="ic_${c}_bg">${bg}</color>\n`;
}
fs.writeFileSync(path.join(res, 'values/ic_colors.xml'), colorsXml + '</resources>\n');

const mf = path.join(MAIN, 'AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
const launcher = /<intent-filter>\s*<action android:name="android.intent.action.MAIN"\s*\/>\s*<category android:name="android.intent.category.LAUNCHER"\s*\/>\s*<\/intent-filter>/;
if (!launcher.test(x)) {
  console.log('Launcher filter not found, skipping manifest patch');
} else {
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
  if (x.includes('</application>')) {
    x = x.replace('</application>', aliases + '\n    </application>');
    fs.writeFileSync(mf, x);
  }
}
console.log('Android icon switching patched.');