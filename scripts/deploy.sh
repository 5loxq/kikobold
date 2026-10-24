#!/bin/sh
# Build the app and upload it to the webspace in one step - an outdated build
# can never be uploaded by accident.
#
# The SFTP password is read from the macOS keychain (service "webgui-deploy",
# account "rrbitr_1") and is never stored in a project file. To (re)create the
# keychain entry:
#   security add-generic-password -s webgui-deploy -a rrbitr_1 -w '<PASSWORT>'
#
# --ignore-time: lftp compares file sizes only, so unchanged files are not
# uploaded again on every deploy (saves time on the ~6 MB engine chunk).
set -eu

cd "$(dirname "$0")/.."

echo "==> Build..."
npm run build

echo "==> Lese SFTP-Passwort aus dem macOS-Keychain..."
PASS=$(security find-generic-password -s webgui-deploy -a rrbitr_1 -w)

DEPLOY_HOST="${DEPLOY_HOST:-www613.your-server.de}"
DEPLOY_USER="${DEPLOY_USER:-rrbitr_1}"

echo "==> Upload nach $DEPLOY_HOST (Modelle ausgenommen)..."
# --ignore-time compares file sizes only (saves re-uploading unchanged
# assets). index.html and sw.js are re-uploaded explicitly afterwards:
# their content changes with every build while their size often stays
# identical - size comparison alone would skip them.
# --env-password: the password travels via the environment, not as a CLI
# argument (where it would be visible to every local process via ps).
# cmd:fail-exit: abort on the first failed command - a half-uploaded
# deploy (new index.html, old assets) must never exit with code 0.
LFTP_PASSWORD="$PASS" lftp -u "$DEPLOY_USER" --env-password sftp://"$DEPLOY_HOST" \
  -e 'set cmd:fail-exit true; mirror -R --delete --ignore-time --exclude .DS_Store --exclude models ./dist .; put -O . ./dist/index.html; put -O . ./dist/sw.js; bye'

echo "==> Fertig. Hinweis: kurz im Browser testen (Modell laden, Nachricht senden)."
