# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [2.2.0] - 2026-10-04

### Neu

- **Gedächtnis**: Neuer Menüpunkt "Gedächtnis" - hier legst du Fakten über dich an (Name, Beruf, Vorlieben), die der KI bei jeder Nachricht in jedem Chat mitgegeben werden. Die Einträge lassen sich bearbeiten und löschen, sind begrenzt (300 Zeichen pro Eintrag, 1000 Zeichen insgesamt, damit die kleinen Modelle nicht überfordert werden) und werden beim Export als Backup mitgespeichert und beim Import wiederhergestellt. Wichtig: Die KI liest das Gedächtnis, speichert aber nichts von selbst - was du im Chat erzählst, wird nicht automatisch gemerkt.
- **Hilfeseite**: Neue Sektion zum Gedächtnis; der Punkt "kein Gedächtnis über den Chat hinaus" verweist jetzt auf die neue Funktion.
- **Tour & Sidebar**: Menüpunkt und Tour-Text um das Gedächtnis ergänzt.

## [2.1.0] - 2026-10-04

### Neu

- **Willkommensseite**: Beim allerersten Besuch erscheint eine "Hallo"-Seite mit kurzer Anleitung - was KI Kobold ist, dass alles lokal im Browser läuft, dass ein Modell einmalig heruntergeladen werden muss und wie man chattet (Deutsch/Englisch, danach dauerhaft ausblendbar).
- **Download-Fortschritt**: Beim Modell-Download zeigt das Overlay jetzt das richtige Modell, Prozent, geladene/gesamte MB, Geschwindigkeit und geschätzte Restzeit (ETA) an.
- **JSPI-Hinweis**: In Browsern ohne JSPI (z.B. Firefox) erscheint bei WASM-Modellen ein Hinweis, dass das Modell dort deutlich langsamer läuft und Chrome/Edge empfohlen werden.
- **Hilfeseite komplett überarbeitet**: Erklärt jetzt, wozu die Seite da ist (KI ausprobieren), was die Modelle können und nicht können (kein Internet, begrenztes Wissen, nur Text), wie die KI den Chat versteht (letzte 10 Nachrichten als Kontext), wie Profile funktionieren und was Import/Export leistet - inklusive Backup-Hinweis.
- **Rebranding zu "KI Kobold"**: Titel, Sidebar, Willkommens- und Hilfeseite, Meta-Beschreibung für Suchmaschinen.

### Behoben

- **Download-Fortschritt zeigte 0%**: Der Service Worker fing Modell-Downloads (.gguf, .bin-Shards) ab und pufferte die komplette Datei im Cache, bevor die Seite sie erhielt - der Fortschritt blieb die ganze Zeit bei 0%. Modell-Downloads laufen jetzt direkt am Service Worker vorbei (beide Engines cachen selbst im OPFS-Speicher). Der doppelte Modell-Cache im Service Worker wird beim Update automatisch gelöscht.
- **Chat-Import tat nichts**: Die Inhaltsprüfung lehnte jede Export-Datei ab, deren Nachrichten Code enthielten ("require(", "eval(" usw.) - bei einem KI-Chat fast immer der Fall. Entfernt; die Sicherheit erfolgt über Strukturvalidierung und Bereinigung beim Speichern.
- **Einzel-Chat-Export war nicht importierbar**: "Chat exportieren" erzeugte Markdown (.md) statt der importierbaren JSON-Datei. Beide Export-Buttons erzeugen jetzt dasselbe JSON-Format; Markdown gibt es weiterhin über "Teilen" (Zwischenablage).
- **Nach dem Import passierte nichts Sichtbares**: Der zuletzt aktualisierte importierte Chat öffnet sich jetzt automatisch.
- **Dark/Light-Umschalter funktionierte nicht**: Tailwind stand auf `darkMode: 'media'` (folgt der Betriebssystem-Einstellung) statt `'class'` (folgt dem Toggle). Korrigiert.
- **Hilfe-schließen-Button tat nichts**: `window.close()` wirkt nur bei skript-geöffneten Fenstern; der Button führt jetzt zurück zum Chat.
- **"Database not initialized" beim Start**: Die App konnte versuchen, den initialen Chat zu erstellen, bevor die IndexedDB bereit war. Alle Speicherfunktionen warten jetzt auf die Initialisierung.
- **Profile-Tab blieb leer**: Fehlender Build-Chunk auf dem Server; Deploy-Prozess stellt jetzt sicher, dass das komplette `dist/` synchronisiert wird.

### Technisch

- `.htaccess`: `sw.js` wird mit `no-cache` ausgeliefert, damit Updates sofort greifen.
- Versionsanzeige in den Einstellungen liest die Version jetzt aus `package.json` statt sie fest einzutragen.

## [2.0.0] - 2026-10-03

- UI-Redesign, kuratierte Modelle (LFM 2.5, Gemma 2, Qwen 2), Self-Hosting der Modelle auf eigenem Webspace mit HuggingFace-Fallback, automatischer WASM-Fallback ohne WebGPU, OPFS-Modell-Cache, Chat-Export/Import, Service Worker für Offline-Nutzung.
