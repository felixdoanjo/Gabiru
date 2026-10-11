import pyautogui
import requests
import base64
import json
import sys
import time
import pytesseract
from io import BytesIO
from PIL import Image
import os

# Configuração do Tesseract - busca no runtime do instalador primeiro
_script_dir = os.path.dirname(os.path.abspath(__file__))
_runtime_tess = os.path.join(os.path.dirname(_script_dir), 'runtime', 'tesseract', 'tesseract.exe')
_exe_tess = os.path.join(os.path.dirname(os.path.dirname(_script_dir)), 'runtime', 'tesseract', 'tesseract.exe')
if os.path.exists(_runtime_tess):
    pytesseract.pytesseract.tesseract_cmd = _runtime_tess
elif os.path.exists(_exe_tess):
    pytesseract.pytesseract.tesseract_cmd = _exe_tess
else:
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def capture_and_describe():
    try:
        screenshot = pyautogui.screenshot()
        screenshot.thumbnail((768, 768)) 
        
        buffered = BytesIO()
        screenshot.save(buffered, format="JPEG", quality=85)
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        payload = {
            "model": "moondream",
            "prompt": "Identify the main subject and describe the scene with detail.",
            "stream": False,
            "images": [img_str]
        }
        
        response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=60)
        if response.status_code == 200:
            print(response.json().get("response", "Nenhuma descrição disponível."))
        else:
            print(f"Erro no Ollama: {response.status_code}")
    except Exception as e:
        print(f"Erro na visão: {e}")

def capture_and_ocr():
    try:
        screenshot = pyautogui.screenshot()
        texto = pytesseract.image_to_string(screenshot, lang='por')
        print(texto.strip() if texto.strip() else "Nenhum texto detectado.")
    except Exception as e:
        print(f"Erro no OCR: {e}")

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "describe"
    
    # Aguarda um pouco para minimizar
    time.sleep(0.5)
    
    if mode == "ocr":
        capture_and_ocr()
    else:
        capture_and_describe()
