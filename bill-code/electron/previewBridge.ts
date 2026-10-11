import fs from 'fs';
import path from 'path';

let cachedBridgeScript: string | null = null;

function getBridgeScript(): string {
  if (cachedBridgeScript) return cachedBridgeScript;
  const candidates = [
    path.join(__dirname, '../preview-bridge/previewBridgeScript.js'),
    path.join(__dirname, '../../preview-bridge/previewBridgeScript.js'),
    path.join(process.cwd(), 'preview-bridge/previewBridgeScript.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedBridgeScript = fs.readFileSync(candidate, 'utf8');
      return cachedBridgeScript;
    }
  }
  cachedBridgeScript = '';
  return cachedBridgeScript;
}

export function injectPreviewBridge(html: string): string {
  if (!html || html.includes('bill-preview-bridge')) return html;
  const bridgeScript = getBridgeScript();
  if (!bridgeScript) return html;
  const script = `<script id="bill-preview-bridge">${bridgeScript}</script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${html}${script}`;
}
