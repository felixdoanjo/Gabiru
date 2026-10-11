/**
 * Script para preparar todos os arquivos necessários para o instalador offline
 * Baixa e organiza: Python, FFmpeg, Piper TTS, Tesseract OCR e todas as dependências
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const INSTALLER_DEPS_DIR = path.join(__dirname, 'installer-deps');

// URLs de download
const DOWNLOADS = {
  python: {
    url: 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip',
    filename: 'python-embed.zip',
    extractTo: 'python'
  },
  pip: {
    url: 'https://bootstrap.pypa.io/get-pip.py',
    filename: 'get-pip.py'
  },
  ffmpeg: {
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    filename: 'ffmpeg.zip',
    extractTo: 'ffmpeg'
  },
  ytdlp: {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    filename: 'yt-dlp.exe',
    targetDir: 'yt-dlp'
  },
  tesseract: {
    url: 'https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.3.3.20231005.exe',
    filename: 'tesseract-setup.exe'
  },
  piperVoice: {
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx',
    filename: 'pt_BR-faber-medium.onnx',
    targetDir: 'piper-tts'
  },
  piperVoiceConfig: {
    url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json',
    filename: 'pt_BR-faber-medium.onnx.json',
    targetDir: 'piper-tts'
  }
};

// Dependências Python a instalar
const PYTHON_PACKAGES = [
  'faster-whisper==1.0.3',
  'opencv-python==4.10.0.84',
  'numpy==1.26.4',
  'Pillow==10.4.0',
  'rembg==2.0.59',
  'requests==2.32.3',
  'pyautogui==0.9.54',
  'pytesseract==0.3.13'
];

console.log('='.repeat(60));
console.log('PREPARANDO INSTALADOR COMPLETO OFFLINE - GABIRU');
console.log('='.repeat(60));

// Criar diretório principal
if (!fs.existsSync(INSTALLER_DEPS_DIR)) {
  fs.mkdirSync(INSTALLER_DEPS_DIR, { recursive: true });
  console.log(`✓ Diretório criado: ${INSTALLER_DEPS_DIR}`);
}

// Função para baixar arquivo com suporte a redirecionamentos
function downloadFile(url, dest, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Muitos redirecionamentos'));
    
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    
    console.log(`  Baixando: ${path.basename(dest)}...`);
    console.log(`  URL: ${url.substring(0, 80)}...`);
    
    const request = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      // Seguir redirecionamentos
      if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 303 || response.statusCode === 307) {
        file.close();
        fs.unlinkSync(dest);
        const redirectUrl = response.headers.location;
        console.log(`  Redirecionando para: ${redirectUrl.substring(0, 80)}...`);
        return downloadFile(redirectUrl, dest, maxRedirects - 1).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Falha no download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
          const percent = ((downloaded / totalSize) * 100).toFixed(1);
          const mb = (downloaded / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r  Progresso: ${percent}% (${mb}MB)`);
        } else {
          const mb = (downloaded / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r  Baixado: ${mb}MB`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n  ✓ Download completo!');
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
    
    file.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
    
    // Timeout de 5 minutos
    request.setTimeout(300000, () => {
      request.destroy();
      reject(new Error('Timeout no download'));
    });
  });
}

// Função para extrair ZIP
function extractZip(zipPath, destDir) {
  console.log(`  Extraindo: ${path.basename(zipPath)}...`);
  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    execSync(`powershell -command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'"`, {
      stdio: 'inherit'
    });
    console.log('  ✓ Extração completa!');
  } catch (err) {
    console.error('  ✗ Erro ao extrair:', err.message);
    throw err;
  }
}

// Função para achatar subpasta (mover conteúdo de subpasta para pasta pai)
function flattenSubfolder(dir) {
  const entries = fs.readdirSync(dir);
  // Se só tem uma subpasta, mover conteúdo para cima
  if (entries.length === 1) {
    const subDir = path.join(dir, entries[0]);
    if (fs.statSync(subDir).isDirectory()) {
      console.log(`  Achatando subpasta: ${entries[0]}/`);
      const tempDir = dir + '_temp';
      fs.renameSync(subDir, tempDir);
      // Mover conteúdo da temp para o diretório original
      const subEntries = fs.readdirSync(tempDir);
      for (const entry of subEntries) {
        fs.renameSync(path.join(tempDir, entry), path.join(dir, entry));
      }
      fs.rmdirSync(tempDir);
      console.log('  ✓ Subpasta achatada!');
    }
  }
}

// Verificar se uma dependência já está pronta
function isDepReady(name) {
  switch (name) {
    case 'python':
      return fs.existsSync(path.join(INSTALLER_DEPS_DIR, 'python', 'python.exe'));
    case 'python-packages':
      return fs.existsSync(path.join(INSTALLER_DEPS_DIR, 'python-packages', 'faster_whisper'));
    case 'ffmpeg':
      // Verificar se existe ffmpeg.exe em algum lugar dentro da pasta
      const ffDir = path.join(INSTALLER_DEPS_DIR, 'ffmpeg');
      if (!fs.existsSync(ffDir)) return false;
      try {
        const findExe = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isFile() && e.name === 'ffmpeg.exe') return true;
            if (e.isDirectory() && findExe(path.join(dir, e.name))) return true;
          }
          return false;
        };
        return findExe(ffDir);
      } catch { return false; }
    case 'ytdlp':
      return fs.existsSync(path.join(INSTALLER_DEPS_DIR, 'yt-dlp', 'yt-dlp.exe'));
    case 'piper':
      return fs.existsSync(path.join(INSTALLER_DEPS_DIR, 'piper-tts', 'piper.exe'));
    case 'tesseract':
      return fs.existsSync(path.join(INSTALLER_DEPS_DIR, 'tesseract-setup.exe'));
    default:
      return false;
  }
}

// Main
async function main() {
  try {
    // ── PYTHON ─────────────────────────────────────────────────────────
    if (isDepReady('python')) {
      console.log('\n[1/5] ✓ Python já está pronto, pulando...');
    } else {
      console.log('\n[1/5] Baixando Python Embeddable...');
      const pythonZip = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.python.filename);
      await downloadFile(DOWNLOADS.python.url, pythonZip);
      const pythonDir = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.python.extractTo);
      extractZip(pythonZip, pythonDir);
      
      // Habilitar pip no Python embeddable
      const pthFile = fs.readdirSync(pythonDir).find(f => f.endsWith('._pth'));
      if (pthFile) {
        const pthPath = path.join(pythonDir, pthFile);
        let content = fs.readFileSync(pthPath, 'utf8');
        content = content.replace('#import site', 'import site');
        // Adicionar Lib\site-packages explicitamente
        if (!content.includes('Lib\\site-packages')) {
          content += '\nLib\\site-packages\n';
        }
        fs.writeFileSync(pthPath, content);
        console.log('  ✓ Python configurado para usar pip e site-packages');
      }
      
      // Instalar pip
      console.log('  Instalando pip...');
      const getPipPath = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.pip.filename);
      if (!fs.existsSync(getPipPath)) {
        await downloadFile(DOWNLOADS.pip.url, getPipPath);
      }
      const pythonExe = path.join(pythonDir, 'python.exe');
      execSync(`"${pythonExe}" "${getPipPath}"`, { stdio: 'inherit' });
      console.log('  ✓ pip instalado');
    }
    
    // ── PYTHON PACKAGES ────────────────────────────────────────────────
    if (isDepReady('python-packages')) {
      console.log('\n[2/5] ✓ Bibliotecas Python já estão prontas, pulando...');
    } else {
      console.log('\n[2/5] Instalando bibliotecas Python...');
      const packagesDir = path.join(INSTALLER_DEPS_DIR, 'python-packages');
      fs.mkdirSync(packagesDir, { recursive: true });
      
      const pythonExe = path.join(INSTALLER_DEPS_DIR, 'python', 'python.exe');
      for (const pkg of PYTHON_PACKAGES) {
        console.log(`  Instalando ${pkg}...`);
        try {
          execSync(`"${pythonExe}" -m pip install --target="${packagesDir}" ${pkg}`, {
            stdio: 'inherit'
          });
        } catch (err) {
          console.warn(`  ⚠ Aviso: Erro ao instalar ${pkg}: ${err.message}`);
        }
      }
      console.log('  ✓ Todas as bibliotecas instaladas');
    }
    
    // ── FFMPEG ──────────────────────────────────────────────────────────
    if (isDepReady('ffmpeg')) {
      console.log('\n[3/6] ✓ FFmpeg já está pronto, pulando...');
    } else {
      console.log('\n[3/6] Baixando FFmpeg...');
      const ffmpegZip = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.ffmpeg.filename);
      if (!fs.existsSync(ffmpegZip) || fs.statSync(ffmpegZip).size < 1000000) {
        await downloadFile(DOWNLOADS.ffmpeg.url, ffmpegZip);
      }
      const ffmpegDir = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.ffmpeg.extractTo);
      if (fs.existsSync(ffmpegDir)) {
        fs.rmSync(ffmpegDir, { recursive: true, force: true });
      }
      extractZip(ffmpegZip, ffmpegDir);
      // Achatar subpasta (ex: ffmpeg-master-latest-win64-gpl/ -> conteúdo direto)
      flattenSubfolder(ffmpegDir);
      console.log('  ✓ FFmpeg pronto');
    }
    
    // ── YT-DLP ──────────────────────────────────────────────────────────
    if (isDepReady('ytdlp')) {
      console.log('\n[4/6] ✓ yt-dlp já está pronto, pulando...');
    } else {
      console.log('\n[4/6] Baixando yt-dlp...');
      const ytdlpDir = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.ytdlp.targetDir);
      fs.mkdirSync(ytdlpDir, { recursive: true });
      const ytdlpExe = path.join(ytdlpDir, DOWNLOADS.ytdlp.filename);
      await downloadFile(DOWNLOADS.ytdlp.url, ytdlpExe);
      console.log('  ✓ yt-dlp pronto');
    }
    
    // ── PIPER TTS ──────────────────────────────────────────────────────
    if (isDepReady('piper')) {
      console.log('\n[5/6] ✓ Piper TTS já está pronto, pulando...');
    } else {
      console.log('\n[5/6] Preparando Piper TTS...');
      const piperDir = path.join(INSTALLER_DEPS_DIR, 'piper-tts');
      fs.mkdirSync(piperDir, { recursive: true });
      
      // Copiar do diretório local do projeto (já tem tudo funcionando)
      const localPiper = path.join(__dirname, 'piper-tts');
      if (fs.existsSync(localPiper) && fs.existsSync(path.join(localPiper, 'piper.exe'))) {
        console.log('  Copiando Piper TTS do projeto local...');
        copyDirRecursive(localPiper, piperDir);
        console.log('  ✓ Piper TTS copiado do projeto!');
      } else {
        // Fallback: baixar da internet
        console.log('  Piper local não encontrado, baixando...');
        
        // Baixar piper.exe
        const piperZipUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
        const piperZip = path.join(INSTALLER_DEPS_DIR, 'piper_win.zip');
        await downloadFile(piperZipUrl, piperZip);
        extractZip(piperZip, piperDir);
        flattenSubfolder(piperDir);
        
        // Baixar voz PT-BR
        console.log('  Baixando voz PT-BR...');
        const voiceFile = path.join(piperDir, DOWNLOADS.piperVoice.filename);
        await downloadFile(DOWNLOADS.piperVoice.url, voiceFile);
        const voiceConfigFile = path.join(piperDir, DOWNLOADS.piperVoiceConfig.filename);
        await downloadFile(DOWNLOADS.piperVoiceConfig.url, voiceConfigFile);
        console.log('  ✓ Voz PT-BR baixada');
      }
    }
    
    // ── TESSERACT OCR ──────────────────────────────────────────────────
    if (isDepReady('tesseract')) {
      console.log('\n[6/6] ✓ Tesseract já está pronto, pulando...');
    } else {
      console.log('\n[6/6] Baixando Tesseract OCR...');
      const tesseractExe = path.join(INSTALLER_DEPS_DIR, DOWNLOADS.tesseract.filename);
      try {
        await downloadFile(DOWNLOADS.tesseract.url, tesseractExe);
        console.log('  ✓ Tesseract OCR baixado');
      } catch (err) {
        console.log('  ⚠ Aviso: Não foi possível baixar o Tesseract OCR (Erro: ' + err.message + ')');
        console.log('  ⚠ O instalador continuará sem o Tesseract.');
      }
    }
    
    // ── SUMÁRIO ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('✓ PREPARAÇÃO COMPLETA!');
    console.log('='.repeat(60));
    
    // Mostrar tamanho de cada componente
    const components = ['python', 'python-packages', 'ffmpeg', 'yt-dlp', 'piper-tts'];
    for (const comp of components) {
      const dir = path.join(INSTALLER_DEPS_DIR, comp);
      if (fs.existsSync(dir)) {
        const size = getDirSize(dir);
        console.log(`  ${comp}: ${(size / 1024 / 1024).toFixed(1)}MB`);
      }
    }
    
    const tesseractFile = path.join(INSTALLER_DEPS_DIR, 'tesseract-setup.exe');
    if (fs.existsSync(tesseractFile)) {
      const size = fs.statSync(tesseractFile).size;
      console.log(`  tesseract-setup.exe: ${(size / 1024 / 1024).toFixed(1)}MB`);
    }
    
    console.log('\nPróximo passo: Execute "npm run build" para criar o instalador');
    
  } catch (err) {
    console.error('\n✗ ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Helper: copiar diretório recursivamente
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Helper: calcular tamanho de diretório
function getDirSize(dir) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(full);
      } else {
        size += fs.statSync(full).size;
      }
    }
  } catch {}
  return size;
}

main();
