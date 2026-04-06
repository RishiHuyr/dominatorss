const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /text-slate-400/g, to: 'text-slate-200' },
  { from: /text-on-surface-variant/g, to: 'text-on-surface' },
  { from: /text-white\/50/g, to: 'text-white/90' },
  { from: /text-white\/60/g, to: 'text-white/90' },
  { from: /text-slate-500/g, to: 'text-slate-300' }
];

const htmlFiles = [
  'auto-labeling.html',
  'duplicate-detection.html',
  'index.html',
  'insights.html',
  'issue-analysis.html',
  'login.html',
  'priority-dashboard.html',
  'settings.html',
  'signup.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
