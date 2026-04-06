const fs = require('fs');
const path = require('path');

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

    // 1. Descriptions & Secondary Text: Ensure text-slate-300 for non-primary text
    // Replace lower contrast text
    content = content.replace(/text-(slate-400|slate-500|on-surface-variant)/g, 'text-slate-300');
    
    // 2. Labels & Sub-labels
    // Labels should be text-white or high contrast
    content = content.replace(/<label([^>]*?)class="([^"]*?)"/gi, (match, before, classes) => {
      let newClasses = classes;
      if (!newClasses.includes('text-white') && !newClasses.includes('text-primary') && !newClasses.includes('text-error')) {
        newClasses = newClasses.replace(/text-(on-surface|slate-\d+)/g, 'text-white');
        if (!newClasses.includes('text-white')) newClasses += ' text-white';
      }
      return `<label${before}class="${newClasses}"`;
    });

    // 3. Metrics Text
    // Stats cards titles/values
    content = content.replace(/grid-cols-\d+.*?glass-card.*?h3/gs, (match) => {
      // If it doesn't already have text-white or a color
      if (!match.includes('text-white') && !match.includes('text-primary') && !match.includes('text-error') && !match.includes('text-tertiary') && !match.includes('text-secondary')) {
        return match.replace(/h3 class="([^"]*?)"/g, 'h3 class="$1 text-white"');
      }
      return match;
    });

    // 4. Hover states
    // In settings/nav items, ensure hover:text-white if it doesn't look primary
    content = content.replace(/hover:text-indigo-300/g, 'hover:text-white');

    fs.writeFileSync(filePath, content);
    console.log(`Polished UI components in ${file}`);
  }
});
