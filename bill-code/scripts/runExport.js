const { VideoExportEngine } = require('../dist-electron/exportEngine.js');
const fs = require('fs');

async function main() {
  try {
    const clipsPath = process.argv[2];
    const settingsPath = process.argv[3];
    
    if (!fs.existsSync(clipsPath) || !fs.existsSync(settingsPath)) {
      throw new Error('Paths to clips or settings not found.');
    }

    const clips = JSON.parse(fs.readFileSync(clipsPath, 'utf-8'));
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));

    console.log('Iniciando Motor NLE Node.js...');
    const engine = new VideoExportEngine();
    
    const finalPath = await engine.renderProject(clips, settings, (p) => {
      console.log(`PROGRESS:${p}`);
    });
    
    console.log(`SUCCESS:${finalPath}`);
  } catch (err) {
    console.error(`FATAL_ERROR:${err.message}`);
    process.exit(1);
  }
}

main();
