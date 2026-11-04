// Run on a Mac after `npx cap add ios`: adds the icon-switching plugin and alternate icons. (npm install first)
const fs = require('fs'), path = require('path'), cp = require('child_process');
if (process.platform !== 'darwin') throw new Error('This script must run on a Mac.');
const xcode = require('xcode');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'ios/App/App');
const ALT = path.join(ROOT, 'assets/alt-icons');
const COLORS = Object.keys(JSON.parse(fs.readFileSync(path.join(ALT, 'colors.json'), 'utf8'))).filter(c => c !== 'pink');

for (const f of ['IconPlugin.swift', 'MyViewController.swift']) fs.copyFileSync(path.join(ROOT, 'native/ios', f), path.join(APP, f));
fs.mkdirSync(path.join(APP, 'AltIcons'), { recursive: true });
const pngs = [];
for (const c of COLORS) for (const s of ['@2x', '@3x']) {
  const n = `icon-${c}${s}.png`;
  fs.copyFileSync(path.join(ALT, `${c}${s}.png`), path.join(APP, 'AltIcons', n));
  pngs.push('AltIcons/' + n);
}

const pbx = path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
const proj = xcode.project(pbx); proj.parseSync();
const grp = proj.findPBXGroupKey({ name: 'App' }) || proj.findPBXGroupKey({ path: 'App' });
if (!grp) throw new Error('Xcode group "App" not found');
proj.addSourceFile('IconPlugin.swift', {}, grp);
proj.addSourceFile('MyViewController.swift', {}, grp);
for (const p of pngs) proj.addResourceFile(p, {}, grp);
fs.writeFileSync(pbx, proj.writeSync());

const sb = path.join(APP, 'Base.lproj/Main.storyboard');
let s = fs.readFileSync(sb, 'utf8');
const re = /customClass="CAPBridgeViewController"(\s+customModule="Capacitor")?/;
if (!re.test(s)) throw new Error('CAPBridgeViewController not found in Main.storyboard');
fs.writeFileSync(sb, s.replace(re, 'customClass="MyViewController" customModule="App"'));

const plist = path.join(APP, 'Info.plist');
const pb = c => { try { cp.execFileSync('/usr/libexec/PlistBuddy', ['-c', c, plist], { stdio: 'pipe' }); } catch (e) { if (!/Delete/.test(c)) throw e; } };
pb('Delete :CFBundleIcons');
pb('Add :CFBundleIcons dict');
pb('Add :CFBundleIcons:CFBundlePrimaryIcon dict');
pb('Add :CFBundleIcons:CFBundlePrimaryIcon:CFBundleIconName string AppIcon');
pb('Add :CFBundleIcons:CFBundleAlternateIcons dict');
for (const c of COLORS) {
  const k = `:CFBundleIcons:CFBundleAlternateIcons:icon-${c}`;
  pb(`Add ${k} dict`); pb(`Add ${k}:CFBundleIconFiles array`); pb(`Add ${k}:CFBundleIconFiles:0 string icon-${c}`);
}
console.log('iOS icon switching patched.');
