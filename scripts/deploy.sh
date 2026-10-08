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

echo "==> Upload nach www613.your-server.de (Modelle ausgenommen)..."
lftp -u "rrbitr_1","$PASS" sftp://www613.your-server.de \
  -e 'mirror -R --delete --ignore-time --exclude .DS_Store --exclude models ./dist .; bye'

echo "==> Fertig. Hinweis: kurz im Browser testen (Modell laden, Nachricht senden)."
