import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'public', 'data', 'Senior Go Backend Roadmap');

function cleanName(name) {
  return name.replace(/^\d+(\.\d+)?\s+/, '').replace(/\.md$/, '').trim();
}

function scanDir(dir, level) {
  if (!fs.existsSync(dir)) return [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items = [];
  
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'Master.md' || entry.name === 'Plan.md' || entry.name === 'Resources.md' || entry.name === 'README.md') continue;
    if (entry.name === 'Mock Interviews') continue;
    
    // Sort logic relies on the leading number in folder/file names
    const match = entry.name.match(/^(\d+)/);
    const order = match ? parseInt(match[1]) : 999;
    
    if (level === 1 && entry.isDirectory()) {
      items.push({
        order,
        title: cleanName(entry.name),
        subtopics: scanDir(path.join(dir, entry.name), 2)
      });
    } else if (level === 2 && entry.isDirectory()) {
      items.push({
        order,
        title: cleanName(entry.name),
        leaves: scanDir(path.join(dir, entry.name), 3).map(l => l.title)
      });
    } else if (level === 3 && entry.isFile() && entry.name.endsWith('.md')) {
      items.push({ order, title: cleanName(entry.name) });
    }
  }
  
  return items.sort((a, b) => a.order - b.order).map(i => {
    if (level === 3) return i; // Return full object temporarily, but above we map it to just title
    delete i.order;
    return i;
  });
}

const roadmap = scanDir(dataPath, 1);
fs.writeFileSync(path.join(__dirname, 'resources', 'js', 'roadmapData.json'), JSON.stringify(roadmap, null, 2));
console.log('Successfully generated roadmapData.json', roadmap.length, 'sections found.');
