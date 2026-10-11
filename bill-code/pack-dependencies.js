const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('📦 Empacotando dependências...');

const output = fs.createWriteStream(path.join(__dirname, 'release', 'Gabiru-Dependencies.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Máxima compressão
});

output.on('close', function() {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`✅ Gabiru-Dependencies.zip criado (${sizeMB} MB)`);
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Adiciona todas as dependências
archive.directory('installer-deps/python', 'runtime/python');
archive.directory('installer-deps/python-packages', 'runtime/python/Lib/site-packages');
archive.directory('installer-deps/ffmpeg', 'runtime/ffmpeg');
archive.directory('installer-deps/yt-dlp', 'runtime/yt-dlp');
archive.directory('installer-deps/piper-tts', 'runtime/piper-tts');

archive.finalize();
