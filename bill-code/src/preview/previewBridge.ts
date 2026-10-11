import bridgeScript from '../../preview-bridge/previewBridgeScript.js?raw';

export function injectPreviewBridge(html: string): string {
  if (!html || html.includes('bill-preview-bridge')) return html;
  const script = `<script id="bill-preview-bridge">${bridgeScript}</script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${html}${script}`;
}

export function postToPreviewFrame(iframe: HTMLIFrameElement | null, type: string, payload: Record<string, unknown> = {}) {
  iframe?.contentWindow?.postMessage({ source: 'bill-host', type, ...payload }, '*');
}
