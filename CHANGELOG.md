# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [3.2.0] - 2026-10-04

### Neu

- **Daten & Backup**: Neuer Menüpunkt "Daten" als zentrale Anlaufstelle für alle lokal gespeicherten Daten:
  - Übersicht: Anzahl Chats (mit Nachrichten), Gedächtnis-Einträge, Bibliotheks-Dateien, heruntergeladene Modelle samt Größe und belegtem Browserspeicher
  - "Alles exportieren": komplettes Backup aus allen Chats, dem Gedächtnis und der Bibliothek als eine JSON-Datei
  - "Backup importieren": stellt Chats, Gedächtnis und Bibliothek wieder her (auch auf anderen Geräten)
  - "Alle Daten löschen": räumt Chats, Gedächtnis und Bibliothek weg (doppelte Sicherheitsfrage); Modelle bleiben und werden in den Einstellungen verwaltet
- **Chat-Header ausgedünnt**: "Alle exportieren" und "Importieren" sind in die Daten-Seite gezogen; der Chat behält nur die kontextbezogenen Buttons "Chat exportieren" und "Teilen"
- Hilfe, Tour und Neuigkeiten entsprechend aktualisiert

## [3.1.0] - 2026-10-04

### Behoben

- **"Modell wird geladen" ohne Laden**: Der Chat zeigte "Modell wird geladen...", sobald kein Modell aktiv war - auch direkt nach dem Start, wenn gar nichts geladen wurde. Jetzt wird unterschieden: kein Modell ausgewählt ("Wähle oben ein Modell aus"), Modell ausgewählt aber nicht aktiv, oder tatsächlich am Laden.
- **Neuigkeiten-Anzeige erschien bei manchen Rückkehrern nie**: Wer die Seite vor Version 2.4.0 besucht hatte, hatte nie eine Version lokal gespeichert und bekam das "Das ist neu"-Fenster deshalb nie zu sehen. Solche Rückkehrer werden jetzt als "zuletzt Version 2.3.0 gesehen" behandelt und holen nach.
- **Neuigkeiten-Fenster zu groß**: Das Fenster überlagerte sich bei vielen Einträgen und ließ sich schlecht scrollen. Die Eintragsliste hat jetzt eine eigene Scrollfläche (max. 85% Fensterhöhe), Kopf und "Alles klar!"-Button bleiben immer sichtbar.

## [3.0.0] - 2026-10-04

### Neu

- **Bibliothek**: Neuer Menüpunkt "Bibliothek" - Textdateien (bis 512 KB) einmal hinterlegen und im Chat per "@Name" referenzieren; die KI erhält den Dateiinhalt als Kontext (max. 4000 Zeichen pro Datei, 12000 gesamt). Falsche Formate werden abgelehnt, Vorschau und Löschen inklusive. Export/Import sichert die Bibliothek mit (Format v1.2).
- **Gedächtnis mit vordefinierten Feldern**: Fertige Felder für Name, Arbeit, Hobbys und Wohnort (automatisches Speichern beim Verlassen des Feldes, Leeren löscht) plus eigene freie Einträge. Felder werden der KI als "Name: Max" usw. übergeben.
- **Neue Einstellungsseite**: Theme (System/Hell/Dunkel), Standard-Profil, Standard-Modell (nur wenn bereits heruntergeladen), "Antworten vorlesen" an/aus, "Gedächtnis verwenden" an/aus - alles dauerhaft gespeichert.
- **PWA**: Die Seite ist als App installierbar (Smartphone und Desktop) - Manifest, Icons (192/512/Apple), Meta-Tags; der bestehende Service Worker liefert die Offline-Fähigkeit.
- **Drag & Drop-Warnung**: Wer eine Datei ins Fenster zieht, sieht eine Warnung, dass Drag & Drop nicht unterstützt wird - die Datei wird weder geöffnet noch gesendet; Verweis auf die Büroklammer.
- **Hilfe: Anhänge & Bibliothek**: Neue Sektion erklärt, welche Dateien funktionieren (Textdateien bis 512 KB, max. 3 pro Nachricht; Bilder nur mit multimodalen Modellen) und welche nicht (PDF, Word, Excel, Drag & Drop).
- **"Das ist neu"-Anzeige** für Version 3.0.0.

## [2.4.0] - 2026-10-04

### Neu

- **"Das ist neu"-Anzeige**: Die App merkt sich lokal, welche Version der Nutzer zuletzt gesehen hat. Bei einem Update sehen wiederkehrende Nutzer beim nächsten Besuch ein Fenster mit allen Änderungen seit ihrem letzten Besuch ( gruppiert nach Version, Deutsch/Englisch). Erstbesucher bekommen es nicht - sie sehen weiterhin Willkommensseite und Tour.
- **Einführung erneut starten**: Auf der Hilfeseite gibt es jetzt den Button "Einführung erneut starten" - die geführte Tour lässt sich jederzeit ansehen.
- **Alle Neuigkeiten nachlesen**: Ebenfalls auf der Hilfeseite: "Alle Neuigkeiten ansehen" öffnet die komplette Änderungsübersicht aller Versionen.

## [2.3.0] - 2026-10-04

### Neu

- **Kontaktseite**: Neuer Menüpunkt "Kontakt" mit der E-Mail-Adresse kikobold.kepmu@8alias.com - hier kann sich jeder melden, der Fragen hat oder Hilfe benötigt. Mit Klick-öffnen-Button und Hinweis, dass viele Antworten schon auf der Hilfeseite stehen.
- **Firefox-Warnung**: Firefox-Nutzer sehen beim Besuch einen wegklickbaren Warnhinweis: Die KI-Modelle laufen dort deutlich langsamer, weil Firefox kein JSPI (JavaScript Promise Integration) unterstützt und die Engine für WASM-Modelle einen langsamen Umweg nehmen muss. Empfehlung: Chrome oder Edge. Der Hinweis lässt sich dauerhaft ausblenden. Eine technische Lösung gibt es nicht - es ist eine Browser-Beschränkung, kein Fehler der Seite.
- **Tour & Hilfe**: Menü-Tour und "Noch Fragen?"-Sektion verweisen jetzt auch auf den Kontakt.

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
