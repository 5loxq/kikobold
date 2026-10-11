#!/bin/sh
# Downloads the image generation model (LCM DreamShaper v7, ONNX) from
# HuggingFace into public/models/sd/ - the same layout the diffusers.js
# engine requests under the self-hosting prefix /models/sd.
# public/models/ is gitignored; the files are uploaded to the webspace
# separately (the deploy mirror excludes the models directory).
set -eu

cd "$(dirname "$0")/.."

REPO="aislamov/lcm-dreamshaper-v7-onnx"
TARGET="public/models/sd/$REPO"

FILES="
model_index.json
scheduler/scheduler_config.json
text_encoder/model.onnx
tokenizer/merges.txt
tokenizer/special_tokens_map.json
tokenizer/tokenizer_config.json
tokenizer/vocab.json
unet/config.json
unet/model.onnx
unet/model.onnx_data
vae_decoder/config.json
vae_decoder/model.onnx
vae_decoder/model.onnx_data
vae_encoder/model.onnx
"

# The diffusers.js engine allocates download buffers from the raw
# Content-Length header - gzip would break it (see .htaccess comment).
cat > "$TARGET/../.htaccess" <<'HTACCESS'
<IfModule mod_deflate.c>
  SetEnv no-gzip 1
</IfModule>
RemoveOutputFilter .json .txt .onnx
HTACCESS

for file in $FILES; do
  mkdir -p "$TARGET/$(dirname "$file")"
  if [ -f "$TARGET/$file" ] && [ "$(wc -c < "$TARGET/$file")" -gt 0 ]; then
    echo "==> $file bereits vorhanden, ueberspringe"
    continue
  fi
  echo "==> Lade $file ..."
  curl -L --fail --retry 3 --retry-delay 2 --progress-bar \
    -o "$TARGET/$file" "https://huggingface.co/$REPO/resolve/main/$file"
done

echo "==> Fertig. Gesamtgroesse:"
du -sh "$TARGET"
