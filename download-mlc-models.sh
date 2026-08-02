#!/bin/bash

# Skript zum Herunterladen von MLC-Modellen für WebLLM
# Ziel: Modelle in public/models/ speichern, damit sie direkt mit der App deployt werden können

set -e  # Bei Fehlern abbrechen

echo "🚀 MLC-Modelle für WebLLM herunterladen..."
echo "Zielverzeichnis: public/models/"
echo ""

# Basis-URL für HuggingFace
HF_BASE="https://huggingface.co"

# Zielverzeichnis
TARGET_DIR="public/models"

# Erstelle Zielverzeichnis
mkdir -p "$TARGET_DIR"

# Funktion zum Herunterladen eines Modells
download_model() {
    local model_id="$1"
    local hf_path="$2"
    local target_path="$TARGET_DIR/$model_id"
    
    echo "📥 Lade Modell: $model_id"
    echo "   von: $HF_BASE/$hf_path"
    echo "   nach: $target_path"
    
    # Erstelle Zielordner
    mkdir -p "$target_path"
    
    # Lade alle Dateien mit wget herunter
    wget -r -np -nH --cut-dirs=1 -R "index.*" \
        --no-check-certificate \
        --progress=bar:force \
        -P "$target_path" \
        "${HF_BASE}/${hf_path}/" 2>&1 | grep --line-buffered -E "(Downloading|%|\.\.\.)" || true
    
    echo "✅ Modell $model_id heruntergeladen"
    echo ""
}

# Modell 1: Qwen2-0.5B (empfohlen - beste Balance aus Größe und Performance)
echo "=== Modell 1/3: Qwen2-0.5B-Instruct ==="
download_model "Qwen2-0.5B-Instruct-q4f16_1-MLC" "mlc-ai/Qwen2-0.5B-Instruct-q4f16_1-MLC"

# Modell 2: TinyLlama-1.1B (kleinstes Modell - schnellstes Laden)
echo "=== Modell 2/3: TinyLlama-1.1B ==="
download_model "TinyLlama-1.1B-q4f16_1-MLC" "mlc-ai/TinyLlama-1.1B-q4f16_1-MLC"

# Modell 3: Phi-2 (beste Qualität, aber größer)
echo "=== Modell 3/3: Phi-2 ==="
download_model "Phi-2-q4f16_1-MLC" "mlc-ai/Phi-2-q4f16_1-MLC"

echo ""
echo "🎉 Alle Modelle heruntergeladen!"
echo ""
echo "Verzeichnisstruktur:"
find "$TARGET_DIR" -type f | sort

echo ""
echo "📊 Download-Statistik:"
du -sh "$TARGET_DIR"/*/

echo ""
echo "📝 Nächste Schritte:"
echo "1. Führe 'npm run build' aus"
echo "2. Lade den Inhalt von 'dist/' auf www.posthiel.de hoch"
echo "3. Die Modelle werden automatisch von /models/ geladen"
echo ""
echo "⚠️  WICHTIG:"
echo "   - Die Modelle müssen auf www.posthiel.de/models/ verfügbar sein"
echo "   - HTTPS ist erforderlich!"
echo "   - CORS ist kein Problem, da die Modelle auf derselben Domain sind"
