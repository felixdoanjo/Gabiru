"""
search_image.py — Busca e baixa imagens via Google Images (com fallback para Bing).
Uso: python search_image.py "query" "C:/saida.jpg" [skip=N]
     python search_image.py "query" "C:/saida.jpg" multi [count=12]
"""

import sys
import json
import os
import re
import threading
import urllib.request
import urllib.parse
import html as htmllib

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    'Referer': 'https://www.google.com/',
}

IMG_HEADERS = {
    **HEADERS,
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://www.google.com/',
}


def search_google_images(query: str) -> list:
    """Extrai URLs de imagens do Google Imagens via scraping do HTML."""
    encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={encoded}&tbm=isch&hl=pt-BR&gl=BR"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except Exception:
        return []

    urls = []

    # Padrão 1: JSON embutido com "ou" (original URL) no Google Images
    matches = re.findall(r'"ou":"(https?://[^"]+)"', raw)
    urls.extend(matches)

    # Padrão 2: imgurl= nos links
    if not urls:
        matches2 = re.findall(r'imgurl=(https?://[^&"]+)', raw)
        urls.extend([urllib.parse.unquote(u) for u in matches2])

    # Padrão 3: data-src ou src em tags img com domínios externos
    if not urls:
        matches3 = re.findall(r'(?:data-src|src)="(https?://(?!www\.google)[^"]+\.(?:jpg|jpeg|png|webp|gif))"', raw)
        urls.extend(matches3)

    # Filtra para manter só imagens reais
    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif')
    filtered = [u for u in urls if any(u.lower().split('?')[0].endswith(ext) for ext in image_exts)]
    result = filtered if filtered else urls

    # Remove duplicatas mantendo ordem
    seen = set()
    deduped = []
    for u in result:
        if u not in seen:
            seen.add(u)
            deduped.append(u)

    # Filtra thumbnails/logos pequenos
    thumb_pattern = re.compile(
        r'[-_/](logo|icon|favicon|avatar|thumb|small|mini|preview|s\d{1,3}x\d{1,3})[-_./]|'
        r'gstatic\.com/images|encrypted-tbn|1x1|pixel',
        re.IGNORECASE
    )
    preferred = [u for u in deduped if not thumb_pattern.search(u)]
    rest = [u for u in deduped if thumb_pattern.search(u)]
    return preferred + rest


def search_bing_images(query: str) -> list:
    """Fallback: Bing Images."""
    encoded = urllib.parse.quote(query)
    url = f"https://www.bing.com/images/search?q={encoded}&form=HDRSC2&first=1"
    req = urllib.request.Request(url, headers={**HEADERS, 'Referer': 'https://www.bing.com/'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except Exception:
        return []

    urls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', raw)
    if not urls:
        decoded = htmllib.unescape(raw)
        urls = re.findall(r'"murl"\s*:\s*"(https?://[^"]+)"', decoded)

    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif')
    filtered = [u for u in urls if any(u.lower().split('?')[0].endswith(ext) for ext in image_exts)]
    result = filtered if filtered else urls

    thumb_pattern = re.compile(
        r'[-_/](logo|icon|favicon|avatar|thumb|small|mini|preview|236x|200x|\d{1,3}x\d{1,3})[-_./]',
        re.IGNORECASE
    )
    preferred = [u for u in result if not thumb_pattern.search(u)]
    rest = [u for u in result if thumb_pattern.search(u)]
    return preferred + rest


def search_images(query: str) -> list:
    """Tenta Google primeiro, usa Bing como fallback apenas se Google retornar zero."""
    results = search_google_images(query)
    if results:
        return results
    # Fallback para Bing só se Google falhou completamente
    return search_bing_images(query)
    encoded = urllib.parse.quote(query)
    url = f"https://www.bing.com/images/search?q={encoded}&form=HDRSC2&first=1"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except Exception:
        return []

    # Bing HTML-encoda o JSON interno — regex no HTML bruto
    urls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', raw)

    # Fallback: HTML decodificado
    if not urls:
        decoded = htmllib.unescape(raw)
        urls = re.findall(r'"murl"\s*:\s*"(https?://[^"]+)"', decoded)

    # Filtra extensões de imagem
    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif')
    filtered = [u for u in urls if any(u.lower().split('?')[0].endswith(ext) for ext in image_exts)]
    result = filtered if filtered else urls

    thumb_pattern = re.compile(
        r'[-_/](logo|icon|favicon|avatar|thumb|small|mini|preview|236x|200x|\d{1,3}x\d{1,3})[-_./]',
        re.IGNORECASE
    )
    preferred = [u for u in result if not thumb_pattern.search(u)]
    rest      = [u for u in result if thumb_pattern.search(u)]
    return preferred + rest


def try_download(url: str, out_path: str) -> str | None:
    """Tenta baixar. Retorna o path final salvo, ou None se falhou/muito pequeno."""
    try:
        req = urllib.request.Request(url, headers=IMG_HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            if len(data) < 30_000:
                return None
            ct = resp.headers.get('Content-Type', '')
            base = os.path.splitext(out_path)[0]
            if 'png' in ct:   ext = '.png'
            elif 'webp' in ct: ext = '.webp'
            elif 'gif' in ct:  ext = '.gif'
            else:
                for e in ('.png', '.webp', '.gif'):
                    if e in url.lower(): ext = e; break
                else:
                    ext = '.jpg'
            final = base + ext
            with open(final, 'wb') as f:
                f.write(data)
            return final
    except Exception:
        return None


def try_download_with_size(url: str, out_path: str) -> tuple:
    saved = try_download(url, out_path)
    if saved and os.path.exists(saved):
        return (saved, os.path.getsize(saved))
    return (None, 0)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Uso: search_image.py <query> <output_path> [skip|multi] [count]"}))
        sys.exit(1)

    query    = sys.argv[1]
    out_path = sys.argv[2]
    mode     = sys.argv[3] if len(sys.argv) > 3 else '0'
    count    = int(sys.argv[4]) if len(sys.argv) > 4 else 12

    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # ── MODO MULTI: retorna N imagens de uma única busca ──────────────────────
    if mode == 'multi':
        urls = search_images(query)
        if not urls:
            print(json.dumps({"success": False, "error": f"Nenhuma imagem encontrada para: {query}"}))
            sys.exit(1)

        # Pega as primeiras (count * 2) URLs para ter candidatos suficientes
        candidates = urls[:count * 2]
        saved_paths = [None] * len(candidates)

        def fetch_multi(i, url):
            base = os.path.splitext(out_path)[0] + f'_multi{i}'
            saved = try_download(url, base)
            saved_paths[i] = saved

        threads = [threading.Thread(target=fetch_multi, args=(i, u)) for i, u in enumerate(candidates)]
        for t in threads: t.start()
        for t in threads: t.join()

        results = [p for p in saved_paths if p][:count]
        print(json.dumps({"success": True, "paths": results, "count": len(results)}))
        sys.exit(0)

    # ── MODO SINGLE (skip) ────────────────────────────────────────────────────
    skip = int(mode) if mode.isdigit() else 0

    urls = search_images(query)
    if not urls:
        print(json.dumps({"success": False, "error": f"Nenhuma imagem encontrada para: {query}"}))
        sys.exit(1)

    start   = skip % len(urls)
    ordered = urls[start:] + urls[:start]

    candidates = ordered[:5]
    results = [None] * len(candidates)

    def fetch_one(i, url):
        base = os.path.splitext(out_path)[0] + f'_cand{i}'
        results[i] = try_download_with_size(url, base)

    threads = [threading.Thread(target=fetch_one, args=(i, u)) for i, u in enumerate(candidates)]
    for t in threads: t.start()
    for t in threads: t.join()

    valid = [(path, size, candidates[i]) for i, (path, size) in enumerate(results) if path]
    if not valid:
        for url in ordered[5:15]:
            saved = try_download(url, out_path)
            if saved:
                print(json.dumps({"success": True, "path": saved, "url": url}))
                sys.exit(0)
        print(json.dumps({"success": False, "error": "Não foi possível baixar nenhuma imagem válida"}))
        sys.exit(1)

    best_path, best_size, best_url = max(valid, key=lambda x: x[1])
    final_ext = os.path.splitext(best_path)[1]
    final_path = os.path.splitext(out_path)[0] + final_ext
    os.replace(best_path, final_path)

    for path, _, _ in valid:
        if path != best_path and os.path.exists(path):
            try: os.remove(path)
            except: pass

    print(json.dumps({"success": True, "path": final_path, "url": best_url, "size": best_size}))


if __name__ == '__main__':
    main()


import sys
import json
import os
import re
import threading
import urllib.request
import urllib.parse
import html as htmllib

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
}

IMG_HEADERS = {
    **HEADERS,
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://www.bing.com/',
}


def search_bing_images(query: str) -> list:
    encoded = urllib.parse.quote(query)
    url = f"https://www.bing.com/images/search?q={encoded}&form=HDRSC2&first=1"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
    except Exception:
        return []

    # Bing HTML-encoda o JSON interno — regex no HTML bruto
    urls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', raw)

    # Fallback: HTML decodificado
    if not urls:
        decoded = htmllib.unescape(raw)
        urls = re.findall(r'"murl"\s*:\s*"(https?://[^"]+)"', decoded)

    # Filtra extensões de imagem
    image_exts = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif')
    filtered = [u for u in urls if any(u.lower().split('?')[0].endswith(ext) for ext in image_exts)]
    result = filtered if filtered else urls

    # Separa em duas listas: URLs sem indicador de tamanho pequeno (preferidas) e o resto
    # Padrão de thumbnail/logo: 213x300, 200x150, /logo/, /icon/, thumb, small, mini
    thumb_pattern = re.compile(
        r'[-_/](logo|icon|favicon|avatar|thumb|small|mini|preview|236x|200x|\d{1,3}x\d{1,3})[-_./]',
        re.IGNORECASE
    )
    preferred = [u for u in result if not thumb_pattern.search(u)]
    rest      = [u for u in result if thumb_pattern.search(u)]

    # Retorna preferidas primeiro, depois o resto como fallback
    return preferred + rest


def try_download(url: str, out_path: str) -> str | None:
    """Tenta baixar. Retorna o path final salvo, ou None se falhou/muito pequeno."""
    try:
        req = urllib.request.Request(url, headers=IMG_HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            # Descarta imagens menores que 30KB (thumbnails, ícones, placeholders)
            if len(data) < 30_000:
                return None
            ct = resp.headers.get('Content-Type', '')
            base = os.path.splitext(out_path)[0]
            if 'png' in ct:   ext = '.png'
            elif 'webp' in ct: ext = '.webp'
            elif 'gif' in ct:  ext = '.gif'
            else:
                # Tenta pela URL
                for e in ('.png', '.webp', '.gif'):
                    if e in url.lower(): ext = e; break
                else:
                    ext = '.jpg'
            final = base + ext
            with open(final, 'wb') as f:
                f.write(data)
            return final
    except Exception:
        return None


def try_download_with_size(url: str, out_path: str) -> tuple:
    """Retorna (saved_path, size_bytes) ou (None, 0)."""
    saved = try_download(url, out_path)
    if saved and os.path.exists(saved):
        return (saved, os.path.getsize(saved))
    return (None, 0)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Uso: search_image.py <query> <output_path> [skip]"}))
        sys.exit(1)

    query    = sys.argv[1]
    out_path = sys.argv[2]
    skip     = int(sys.argv[3]) if len(sys.argv) > 3 else 0

    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    urls = search_bing_images(query)
    if not urls:
        print(json.dumps({"success": False, "error": f"Nenhuma imagem encontrada para: {query}"}))
        sys.exit(1)

    # Aplica skip para variar
    start   = skip % len(urls)
    ordered = urls[start:] + urls[:start]

    # Baixa as primeiras 5 em paralelo e escolhe a maior em bytes
    # (imagens de qualidade real são maiores que logos e thumbnails)
    candidates = ordered[:5]
    results = [None] * len(candidates)

    def fetch_one(i, url):
        base = os.path.splitext(out_path)[0] + f'_cand{i}'
        results[i] = try_download_with_size(url, base)

    threads = [threading.Thread(target=fetch_one, args=(i, u)) for i, u in enumerate(candidates)]
    for t in threads: t.start()
    for t in threads: t.join()

    # Escolhe a de maior tamanho entre as que funcionaram
    valid = [(path, size, candidates[i]) for i, (path, size) in enumerate(results) if path]
    if not valid:
        # Fallback: tenta mais 5 em sequência
        for url in ordered[5:15]:
            saved = try_download(url, out_path)
            if saved:
                print(json.dumps({"success": True, "path": saved, "url": url}))
                sys.exit(0)
        print(json.dumps({"success": False, "error": "Não foi possível baixar nenhuma imagem válida"}))
        sys.exit(1)

    best_path, best_size, best_url = max(valid, key=lambda x: x[1])

    # Renomeia para o caminho final correto
    final_ext = os.path.splitext(best_path)[1]
    final_path = os.path.splitext(out_path)[0] + final_ext
    os.replace(best_path, final_path)

    # Remove os outros candidatos
    for path, _, _ in valid:
        if path != best_path and os.path.exists(path):
            try: os.remove(path)
            except: pass

    print(json.dumps({"success": True, "path": final_path, "url": best_url, "size": best_size}))


if __name__ == '__main__':
    main()
