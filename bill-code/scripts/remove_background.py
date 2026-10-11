import sys
import os
import base64
import io

def main():
    if len(sys.argv) < 3:
        print("Uso: python remove_background.py <input_path> <output_path> [--base64]")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    is_base64 = len(sys.argv) > 3 and sys.argv[3] == "--base64"
    
    try:
        from rembg import remove
        from PIL import Image
        
        if is_base64:
            # Modo Base64
            # Ler string base64 do arquivo de entrada
            with open(input_path, 'r', encoding='utf-8') as f:
                base64_str = f.read().strip()
                
            # Limpar cabeçalho do data URL se houver
            if ',' in base64_str:
                base64_str = base64_str.split(',', 1)[1]
                
            # Decodificar
            img_bytes = base64.b64decode(base64_str)
            input_image = Image.open(io.BytesIO(img_bytes))
            
            # Remover fundo
            output_image = remove(input_image)
            
            # Salvar em memória como PNG
            out_buffer = io.BytesIO()
            output_image.save(out_buffer, format="PNG")
            out_bytes = out_buffer.getvalue()
            
            # Codificar para base64
            out_base64 = base64.b64encode(out_bytes).decode('utf-8')
            
            # Escrever resultado
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(out_base64)
                
            print("Fundo de base64 removido com sucesso!")
            sys.exit(0)
            
        else:
            # Modo arquivo normal
            input_image = Image.open(input_path)
            output_image = remove(input_image)
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            output_image.save(output_path, "PNG")
            print("Fundo de arquivo removido com sucesso!")
            sys.exit(0)
            
    except Exception as e:
        print(f"Erro ao remover fundo: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
