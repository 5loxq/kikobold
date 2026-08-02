#!/usr/bin/env python3
"""
Skript zum Herunterladen von MLC-Modellen für WebLLM.
Verwendet die huggingface_hub Bibliothek.

Ziel: Modelle in public/models/ speichern, damit sie direkt mit der App deployt werden können.
"""

from huggingface_hub import snapshot_download, login, whoami
import os
import shutil

# Modell-Konfigurationen
MODELS = [
    {
        "id": "Qwen2-0.5B-Instruct-q4f16_1-MLC",
        "repo_id": "mlc-ai/Qwen2-0.5B-Instruct-q4f16_1-MLC",
        "size": "~400MB",
        "recommended": True
    },
    {
        "id": "TinyLlama-1.1B-q4f16_1-MLC",
        "repo_id": "mlc-ai/TinyLlama-1.1B-q4f16_1-MLC",
        "size": "~300MB",
        "recommended": True
    },
    {
        "id": "Phi-2-q4f16_1-MLC",
        "repo_id": "mlc-ai/Phi-2-q4f16_1-MLC",
        "size": "~700MB",
        "recommended": True
    }
]

TARGET_DIR = "public/models"

def download_model(model_info):
    """Lade ein einzelnes Modell herunter."""
    model_id = model_info["id"]
    repo_id = model_info["repo_id"]
    target_path = os.path.join(TARGET_DIR, model_id)
    
    print(f"📥 Lade Modell: {model_id}")
    print(f"   Repo: {repo_id}")
    print(f"   Ziel: {target_path}")
    
    # Erstelle Zielordner
    os.makedirs(target_path, exist_ok=True)
    
    try:
        # Herunterladen mit huggingface_hub
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_path,
            local_dir_use_symlinks=False,
            ignore_patterns=["*.msgpack", "*.h5", "*.tflite", "*.safetensors"],
            allow_patterns=["*.json", "*.wasm", "*.txt", "*.model"],
            resume_download=True
        )
        
        # Überprüfen, ob Dateien heruntergeladen wurden
        files = os.listdir(target_path)
        if not files:
            print(f"❌ Keine Dateien heruntergeladen für {model_id}")
            return False
        
        print(f"✅ Modell {model_id} heruntergeladen ({len(files)} Dateien)")
        return True
        
    except Exception as e:
        print(f"❌ Fehler beim Herunterladen von {model_id}: {e}")
        return False

def main():
    print("🚀 MLC-Modelle für WebLLM herunterladen")
    print(f"Zielverzeichnis: {TARGET_DIR}/")
    print()
    
    # Erstelle Zielverzeichnis
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    # Alle Modelle herunterladen
    successful = []
    failed = []
    
    for model in MODELS:
        if download_model(model):
            successful.append(model["id"])
        else:
            failed.append(model["id"])
    
    print()
    print("=" * 50)
    print("📊 Zusammenfassung:")
    print(f"   ✅ Erfolgreich: {len(successful)}/{len(MODELS)}")
    print(f"   ❌ Fehlgeschlagen: {len(failed)}/{len(MODELS)}")
    
    if successful:
        print(f"\n   Erfolgreiche Modelle: {', '.join(successful)}")
    if failed:
        print(f"\n   Fehlgeschlagene Modelle: {', '.join(failed)}")
    
    print()
    print("📁 Verzeichnisstruktur:")
    for root, dirs, files in os.walk(TARGET_DIR):
        level = root.replace(TARGET_DIR, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in files[:5]:  # Zeige nur erste 5 Dateien pro Ordner
            print(f'{subindent}{file}')
        if len(files) > 5:
            print(f'{subindent}... und {len(files) - 5} weitere Dateien')
    
    print()
    print("📝 Nächste Schritte:")
    print("1. Führe 'npm run build' aus")
    print("2. Lade den Inhalt von 'dist/' auf www.posthiel.de hoch")
    print("3. Die Modelle werden automatisch von /models/ geladen")
    print()
    print("⚠️  WICHTIG:")
    print("   - Die Modelle müssen auf www.posthiel.de/models/ verfügbar sein")
    print("   - HTTPS ist erforderlich!")
    print("   - CORS ist kein Problem, da die Modelle auf derselben Domain sind")

if __name__ == "__main__":
    main()
