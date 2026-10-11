import sys
import os
import base64
import io

def main():
    if len(sys.argv) < 3:
        print("Uso: python enhance_image.py <input_path> <output_path> [--base64]")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    is_base64 = len(sys.argv) > 3 and sys.argv[3] == "--base64"
    
    try:
        from PIL import Image, ImageEnhance, ImageFilter
        import numpy as np

        if is_base64:
            with open(input_path, 'r', encoding='utf-8') as f:
                base64_str = f.read().strip()
            if ',' in base64_str:
                base64_str = base64_str.split(',', 1)[1]
            img_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(img_bytes))
        else:
            img = Image.open(input_path)

        # Preservar alpha se existir
        has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
        if img.mode == 'P':
            img = img.convert('RGBA')
        
        alpha_channel = None
        if has_alpha and img.mode == 'RGBA':
            alpha_channel = img.split()[3]
            img_rgb = img.convert('RGB')
        else:
            img_rgb = img.convert('RGB')

        # ── 1. Upscale 2x com Lanczos se imagem for pequena ──────────────
        max_dim = 2048
        upscaled = False
        if img_rgb.width < max_dim and img_rgb.height < max_dim:
            new_w = img_rgb.width * 2
            new_h = img_rgb.height * 2
            try:
                resample_filter = Image.Resampling.LANCZOS
            except AttributeError:
                resample_filter = getattr(Image, 'LANCZOS', Image.ANTIALIAS)
            img_rgb = img_rgb.resize((new_w, new_h), resample=resample_filter)
            if alpha_channel:
                alpha_channel = alpha_channel.resize((new_w, new_h), resample=resample_filter)
            upscaled = True

        arr = np.array(img_rgb, dtype=np.float32)

        # ── 2. Denoising leve via média de blur gaussian ──────────────────
        # Fazemos isso antes do sharpening para não amplificar ruído
        from PIL import ImageFilter as IF
        denoised_pil = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        denoised_pil = denoised_pil.filter(IF.GaussianBlur(radius=0.4))
        arr = np.array(denoised_pil, dtype=np.float32)

        # ── 3. Unsharp Mask (sharpening real, não apenas contraste) ───────
        # Formula: sharp = original + amount * (original - blurred)
        blurred_pil = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        blurred_pil = blurred_pil.filter(IF.GaussianBlur(radius=1.2))
        blurred_arr = np.array(blurred_pil, dtype=np.float32)
        
        amount = 0.65  # intensidade do sharpening (0.5-1.0 é bom)
        sharpened = arr + amount * (arr - blurred_arr)
        arr = np.clip(sharpened, 0, 255)

        # ── 4. Correção de gamma suave (levanta sombras, não clareia demais) ─
        gamma = 0.95  # < 1.0 = levanta levemente as sombras
        arr_norm = arr / 255.0
        arr_norm = np.power(arr_norm, gamma)
        arr = arr_norm * 255.0

        # ── 5. Boost de saturação leve (para cores mais vivas) ────────────
        # Convertemos para HSV e aumentamos S
        r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
        max_c = np.max(arr, axis=2)
        min_c = np.min(arr, axis=2)
        delta = max_c - min_c
        
        # Luminance (média simples para não distorcer cores)
        lum = (max_c + min_c) / 2.0
        
        # Saturação: empurra pixels coloridos para serem um pouco mais saturados
        # sem afetar pixels acromáticos
        sat_boost = 1.12
        mid = 128.0
        r = mid + (r - mid) * sat_boost
        g = mid + (g - mid) * sat_boost
        b = mid + (b - mid) * sat_boost
        
        arr[:,:,0] = np.clip(r, 0, 255)
        arr[:,:,1] = np.clip(g, 0, 255)
        arr[:,:,2] = np.clip(b, 0, 255)

        # ── 6. Claridade local suave (aumenta microtextura sem mudar gamma global) ─
        # Diferença entre imagem e blur de grande raio = camada de detalhe
        result_pil = Image.fromarray(arr.astype(np.uint8))
        macro_blur = result_pil.filter(IF.GaussianBlur(radius=8))
        macro_arr = np.array(macro_blur, dtype=np.float32)
        
        clarity_amount = 0.18  # leve — só para adicionar "punch" de detalhe
        arr_final = arr + clarity_amount * (arr - macro_arr)
        arr_final = np.clip(arr_final, 0, 255)

        # ── Reconstituir com alpha se necessário ──────────────────────────
        result_img = Image.fromarray(arr_final.astype(np.uint8), 'RGB')
        
        if alpha_channel is not None:
            result_img = result_img.convert('RGBA')
            result_img.putalpha(alpha_channel)

        # ── Salvar ────────────────────────────────────────────────────────
        if is_base64:
            out_buffer = io.BytesIO()
            result_img.save(out_buffer, format="PNG", optimize=False)
            out_bytes = out_buffer.getvalue()
            out_base64 = base64.b64encode(out_bytes).decode('utf-8')
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(out_base64)
            print("Qualidade da imagem melhorada com sucesso!")
        else:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            result_img.save(output_path, "PNG", optimize=False)
            print("Qualidade da imagem melhorada com sucesso!")
        sys.exit(0)
        
    except ImportError as ie:
        print(f"Dependência faltando: {str(ie)}. Instale com: pip install Pillow numpy", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro ao melhorar qualidade: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
