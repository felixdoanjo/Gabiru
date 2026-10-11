# -*- coding: utf-8 -*-
"""
Screenshot simples - Captura tela toda e retorna base64
Versão sem tkinter para funcionar no Python embeddable
"""

import sys
import os
import base64
from datetime import datetime
from PIL import ImageGrab
import io

if __name__ == '__main__':
    try:
        # Captura a tela inteira
        screenshot = ImageGrab.grab()
        
        # Converte para base64
        buffer = io.BytesIO()
        screenshot.save(buffer, format='PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Retorna o base64
        print(img_base64)
        sys.exit(0)
            
    except Exception as e:
        print(f'Erro: {e}', file=sys.stderr)
        sys.exit(1)
