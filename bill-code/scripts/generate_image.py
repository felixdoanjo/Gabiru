import sys
import os
import json
import requests
import urllib.parse


def main():
    if len(sys.argv) < 3:
        print('Uso: python generate_image.py "prompt" "caminho_saida.png" [api_key]')
        sys.exit(1)

    prompt = sys.argv[1]
    output_path = sys.argv[2]
    api_key = sys.argv[3].strip() if len(sys.argv) > 3 else ''

    print(f'Iniciando geração de imagem via Pollinations para: {prompt}')

    if not api_key:
        print('Aviso: chave da Pollinations não configurada. Usando endpoint público e gratuito.')

    try:
        encoded_prompt = urllib.parse.quote(prompt)
        if api_key:
            url = (
                f'https://gen.pollinations.ai/image/{encoded_prompt}'
                f'?model=zimage&width=512&height=512&key={urllib.parse.quote(api_key)}'
            )
        else:
            url = f'https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true'

        response = requests.get(url, stream=True, timeout=120)

        if response.status_code == 200:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            print('Imagem salva com sucesso!')
            sys.exit(0)

        error_msg = f'A API retornou status {response.status_code}'
        try:
            body = response.json()
            if isinstance(body, dict) and 'error' in body:
                err = body['error']
                if isinstance(err, dict) and err.get('message'):
                    error_msg = err['message']
                elif isinstance(err, str):
                    error_msg = err
        except (json.JSONDecodeError, ValueError):
            pass

        if response.status_code == 401:
            error_msg = (
                'Chave da Pollinations inválida ou ausente. '
                'Verifique em Configurações ou gere uma nova em https://enter.pollinations.ai'
            )
        elif response.status_code == 402:
            error_msg = (
                'Saldo de Pollen insuficiente na Pollinations. '
                'Acesse https://enter.pollinations.ai para recarregar ou aguardar o refill gratuito.'
            )

        print(f'Erro na geração: {error_msg}', file=sys.stderr)
        sys.exit(1)

    except Exception as e:
        print(f'Erro fatal: {str(e)}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
