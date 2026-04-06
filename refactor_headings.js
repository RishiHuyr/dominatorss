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

    // 1. Upgrade Heading Classes (h1, h2, h3, h4, h5)
    // We target the class attribute inside these tags
    const headingRegex = /<(h[1-5])([^>]*?)class="([^"]*?)"/gi;
    content = content.replace(headingRegex, (match, tag, before, classes) => {
      let newClasses = classes;
      
      // Ensure font-extrabold or font-bold
      if (!newClasses.includes('font-extrabold') && !newClasses.includes('font-bold')) {
        newClasses += ' font-extrabold';
      } else if (newClasses.includes('font-bold') && !newClasses.includes('font-extrabold')) {
        newClasses = newClasses.replace('font-bold', 'font-extrabold');
      }

      // Ensure high contrast white or keep existing gradients
      if (!newClasses.includes('text-white') && !newClasses.includes('text-transparent') && !newClasses.includes('text-primary') && !newClasses.includes('text-error')) {
        // Replace text-on-surface or text-slate with text-white
        newClasses = newClasses.replace(/text-(on-surface|slate-\d+)/g, 'text-white');
        if (!newClasses.includes('text-white')) newClasses += ' text-white';
      }

      // Ensure tracking-tight
      if (!newClasses.includes('tracking-')) {
        newClasses += ' tracking-tight';
      } else {
        newClasses = newClasses.replace(/tracking-(tighter|normal|wide|wider|widest)/g, 'tracking-tighter');
      }

      return `<${tag}${before}class="${newClasses}"`;
    });

    fs.writeFileSync(filePath, content);
    console.log(`Updated headings in ${file}`);
  }
});
