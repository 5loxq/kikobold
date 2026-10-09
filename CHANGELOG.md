# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [4.0.0] - 2026-10-09

### Neu: Barrierefreiheit (Ziel: WCAG 2.1 AA)

- **Textgröße einstellbar** (Einstellungen → Barrierefreiheit): Klein / Standard / Groß / Sehr groß - das gesamte rem-basierte UI skaliert über die Schriftgröße des html-Elements, Auswahl wird wie das Theme persistiert.
- **Lesbarkeit erhöhen**: Optionaler Schalter für mehr Zeilenabstand (1.8) und leichten Zeichenabstand in Nachrichten und Eingabefeld.
- **Animationen reduzieren**: Schalter deaktiviert alle Bewegungen und Übergänge unabhängig von der OS-Einstellung (`prefers-reduced-motion` greift zusätzlich weiterhin automatisch, jetzt auch für Spin/Pulse-Animationen).
- **Screenreader-Unterstützung**: Skip-Link „Zum Chat springen" als erster Tab-Stop, semantisches `<main>`, Live-Region kündigt Generierungs-Start und fertige Antwort an, Nachrichten tragen „Du"/„KI"-Kennzeichnung für Screenreader, Modell-Download wird angesagt (Start/Phase, ohne Prozent-Flut), Fehlermeldungen per `role="alert"`.
- **Tastatur**: Global sichtbare Fokus-Ringe (`:focus-visible`, 2px Indigo), Fokus-Fallen in allen Dialogen (What's New, Willkommensseite, Tour, Bildvorschau) mit Esc und Fokus-Rückgabe, Chat-Verlauf ist jetzt per Tastatur bedienbar (vorher nur per Maus klickbar), Mindest-Zielgröße 24×24px für Buttons.
- **Kontraste (WCAG AA)**: Nutzer-Nachrichtenblase dunkler (Indigo-600 statt 500 - weißer Text jetzt 6.3:1 statt 4.5:1), Hinweis-Texte zinc-400 → zinc-500 (hell) bzw. zinc-600 → zinc-400 (dunkel), Amber-Hinweise auf amber-700, Tour-Label auf Indigo-600.
- **Mindest-Schriftgrößen**: Alle 11px-Texte auf 12px angehoben (Sidebar, Modelle-Seite, Tour, Datenschutzhinweis).
- **Labels**: Alle Icon-Buttons haben jetzt sprechende ARIA-Labels (zweisprachig), Such-Toggle mit `aria-expanded`/`aria-controls`, Theme-Toggle-Label übersetzt (vorher hardcoded Englisch).

## [3.4.0] - 2026-10-08

### Neu

- **Offline-Banner**: Ist keine Internetverbindung da, zeigt ein schmaler Hinweis, dass bereits heruntergeladene Modelle und Chats weiter funktionieren - nur Downloads brauchen eine Verbindung.
- **Engine-Anzeige**: Neben der Modellauswahl steht, worauf das Modell gerade läuft - „Engine: WebGPU" (Grafikkarte) oder „Engine: WASM" (Prozessor-Fallback), mit Erklärung als Tooltip.
- **App-Cache aufräumen**: Neue Sektion auf der Daten-Seite räumt den Browser-Cache der App auf (Chats und Modelle bleiben unberührt).
- **Profile zweisprachig**: Die Profil-Seite (Export/Import/Bearbeiten/Löschen usw.) läuft jetzt vollständig über i18next - vorher standen dort feste englische Texte.
- **Testsuite**: Vitest mit 37 Tests für die Kern-Logik (Thinking-Trennung, Markdown-Block-Splitter, Bibliotheks-Resolver, Prompt-Budgets, Versionsvergleich, Download-Parser, Modell-Registry) - läuft per `npm run test` und in der CI.
- **Dependabot**: Wöchentliche Update-PRs für npm-Pakete und GitHub Actions (`.github/dependabot.yml`).
- **Service-Worker-Versionierung**: `sw.js` bekommt bei jedem Build die App-Version als Cache-Namen injiziert - Browser-Updates greifen zuverlässiger, alte Caches werden automatisch aufgeräumt.
- **Zentraler localStorage-Adapter**: Alle localStorage-Zugriffe laufen durch eine zentrale Stelle mit einheitlicher Fehlerbehandlung (Quota, Privat-Modus); der alte `secureLocalStorage`-Duplikat ist entfernt.
- **Doku**: README um Sync-/Deploy-Workflow ergänzt (Keychain, `npm run deploy`, Connector-Push für Workflows, LFS-Hinweis), veraltete Modell-Tabelle korrigiert; IndexedDB-Migrationskonzept in `ChatStorage` dokumentiert.

- **Deutlich schnellerer Start**: Die Web-LLM-Engine (~4,5 MB - der größte Teil der App) wird jetzt durchgehend dynamisch importiert und landet in einem eigenen Chunk, der erst lädt, wenn wirklich ein Modell geladen oder sein Cache angefasst wird. Der Start der Seite ist um diesen Anteil schlanker. KaTeX (~300 KB JS-Anteil plus Schriften) lädt ebenfalls erst, wenn eine Nachricht tatsächlich eine Formel enthält.
- **Lange Chats bleiben flüssig**: Die Nachrichtenliste zeigt die letzten 50 Nachrichten und lädt ältere erst beim Hochscrollen nach (Button „↑ ältere Nachrichten laden" oder Scrollen an den oberen Rand) - mit stabiler Scroll-Position. Chats mit hunderten Nachrichten ruckeln nicht mehr.
- **Roadmap aktualisiert**: Erledigte Punkte (Geschwindigkeit, Fehler-Schutz, Shortcuts, Such-Hervorhebung, Tab-Titel, Installations-Hinweis, Download-Dashboard) sind entfernt; neu aufgenommen: Prüfung eines Bild-Modells (im Browser möglich, aber große Downloads und langsam - unter Vorbehalt).
- **Absturz-Schutz (ErrorBoundary)**: Ein unerwarteter Fehler in der Oberfläche zeigt jetzt eine verständliche Meldung mit „Seite neu laden"-Button statt einer weißen Seite. Chats und Daten liegen in IndexedDB/localStorage und bleiben erhalten.
- **Tastatur-Shortcuts**: Strg+K bzw. Cmd+K öffnet und schließt die Chat-Suche; Esc bricht die laufende Generierung ab (offene Popups wie die @-Vorschläge werden dabei nicht gestört). Alle Shortcuts sind in der Hilfe dokumentiert.
- **Dynamischer Tab-Titel**: Der Browser-Tab zeigt jetzt den aktuellen Zustand - „Modell wird geladen…", „KI denkt nach…" oder den Namen des aktiven Modells. Praktisch, wenn die Seite in mehreren Tabs offen ist.
- **Chat-Suche in eigenen Nachrichten**: Suchtreffer werden jetzt auch in den Nachrichten des Nutzers hervorgehoben, nicht nur in den Antworten der KI.
- **Hinweis „Als App installieren"**: Wiederkehrende Besucher bekommen (wo der Browser es unterstützt, z.B. Chrome/Edge) einen dezente Aufforderung, die Seite als App zu installieren - mit eigenem Fenster und Offline-Start. „Später" schließt den Hinweis dauerhaft.
- **Denkmodus abschaltbar**: Bei Modellen mit Denkmodus (Qwen 3) schaltet ein 💭-Button neben der Modellauswahl das sichtbare Nachdenken an und aus. „Aus" setzt den Qwen-Soft-Switch `/no_think` im System-Prompt — schnellere, direkte Antworten bei einfachen Fragen. Die Wahl wird gespeichert.
- **Mobile-Optimierungen**: Die Nachrichtenliste nutzt jetzt die dynamische Viewport-Höhe (100dvh) — das Eingabefeld verschwindet nicht mehr hinter der Bildschirmtastatur, und die Höhe passt sich Browser-Leisten an. Das Eingabefeld räumt der iPhone-Home-Anzeige (Safe Area) Platz ein. Textfelder sind auf dem Handy 16px groß — iOS zoomt dadurch nicht mehr unbeabsichtigt rein.
- **Neues KI-Lexikon (Menü → Lexikon)**: Einfach erklärt, was künstliche Intelligenz, Machine Learning und Sprachmodelle sind; was „Thinking" bedeutet und wann es sinnvoll ist; kurze Vorstellung bekannter Modelle (ChatGPT, Gemini, Claude, Llama, Mistral - und die beiden lokalen); was KI kann und nicht kann (inkl. Halluzinationen); aufklappbares Glossar der Seiten-Begriffe (Token, Kontextfenster, Quantisierung, Temperatur, WebGPU, WASM). Statischer Inhalt - funktioniert ohne heruntergeladenes Modell. Zweisprachig de/en.
- **Fehlermeldungen zweisprachig**: Die Meldungen beim Modell-Laden (CORS, 404, WebGPU, WASM) laufen jetzt über i18next statt hardcoded auf Deutsch.
- **i18n-Paritäts-Check automatisiert**: Neues Skript `npm run check:i18n` prüft, dass de.json und en.json deckungsgleich sind und jeder im Code benutzte Key existiert; läuft zusätzlich in der CI-Pipeline.

### Behoben (aus dem Code-Review vor dieser Version)

- **Code-Antworten wurden beim Speichern verstümmelt**: Die Voll-Sanitizing löschte Muster wie „data:", „on x =" oder „javascript:" aus normalem Text - Code-Antworten der Modelle kamen beschädigt aus der Datenbank zurück. Nachrichten werden jetzt wie Gedächtnis und Bibliothek nur von HTML-Tags befreit; Markdown-Links und -Bilder akzeptieren ausschließlich sichere Protokolle (http/https/mailto/relativ).
- **Codeblöcke mit Leerzeilen wurden zerrissen**: Der Markdown-Renderer zerschnitt Codeblöcke am Absatz-Splitter - sie erschienen als kaputte Absätze mit Backtick-Resten. Der Splitter kennt jetzt Code-Fences.
- **Fehlender Text im Lade-Hinweis**: „chat.modelLoadingBubble" existierte nicht in den Sprachdateien - im UI wäre der rote Key erschienen.
- **Anhänge über dem Limit**: Mehrere Dateien auf einmal konnten das Limit von 3 Anhängen überschreiten; jetzt gekappt.
- **Bibliotheks-Picker nach dem Senden**: Der 📚-Picker blieb nach dem Absenden offen und blockierte die @-Autocomplete für die nächste Nachricht.

### Intern

- Tote Platzhalter-Hooks entfernt (`useInferencePerformance`, `useModelPreloader`), doppelt registrierte Offline-Listener verhindert, nur API-Feldparameter an die WebLLM-Engine übergeben.

## [3.3.0] - 2026-10-07

### Neu

- **Neue Modelle mit Thinking**: Qwen 3.5 2B (beste Qualität, Kontext 262.144 Zeichen), Qwen 3 1.7B (Denk-Spezialist) und Qwen 3 0.6B (schnellstes Modell) ersetzen Gemma 2 2B und Qwen 2 0.5B. Alle drei Modelle sind auf dem eigenen Webspace gehostet. LFM 2.5 1.6B bleibt als universelles WASM-Modell mit Bildverständnis erhalten.
- **Sichtbares Thinking**: Modelle mit Denkmodus zeigen ihren Gedankengang (``-Block) als aufklappbaren Bereich direkt in der Antwort - standardmäßig zugeklappt, auch während der Generierung live.
- **Modellseite**: Neuer Menüpunkt "Modelle" stellt alle Modelle vor: Stärken und Schwächen, Erscheinungsdatum (mit Monat), Download-Größe, Engine und Kontextlänge.
- **Roadmap**: Neuer Menüpunkt "Roadmap" (unter Hilfe) mit geplanten Verbesserungen - ausdrücklich ohne zeitliche Abfolge oder Zusagen.
- **Alte Modelle entfernt**: Gemma 2 2B und Qwen 2 0.5B sind von der Webseite gelöscht und aus der Auswahl entfernt. Bereits heruntergeladene alte Modelle werden beim nächsten Start automatisch aus dem Browser-Speicher gelöscht (Best-Effort, beide Download-Quellen).
- **@-Erwähnungen mit Autovervollständigung**: Tippt man @ im Chatfeld, erscheinen sofort die Dateien aus der Bibliothek als Vorschlagsliste - live gefiltert während des Tippens, auswählbar mit Pfeiltasten/Enter oder Maus. Zusätzlich wählt ein 📚-Button im Chatfeld Dateien direkt aus. Dateinamen mit Leerzeichen, Umlauten und Sonderzeichen funktionieren (der Resolver gleicht per längstem Dateinamen-Match); bei leerer Bibliothek gibt die Liste einen Hinweis, wo Dateien hochgeladen werden können.
- **Vorlesen standardmäßig aus**: Antworten werden nicht mehr automatisch vorgelesen. Wer es möchte, kann es in den Einstellungen wieder einschalten (bestehende gespeicherte Einstellungen bleiben unangetastet).
- Tour und Neuigkeiten entsprechend erweitert.

## [3.2.1] - 2026-10-04

### Behoben

- **Kontext-Fehler ("request exceeds the available context size")**: Das WASM-Modell (LFM 2.5) lief mit dem winzigen Standard-Kontext von 1024 Tokens - schon ein System-Prompt mit Gedächtnis plus Verlauf oder ein angehängter Text sprengte das Fenster. Der Kontext wurde auf 4096 Tokens erhöht, angehängte Dokumente werden auf 4000 Zeichen pro Datei (10000 gesamt) gekürzt, und bei langen Unterhaltungen werden die ältesten Verlaufsnachrichten automatisch weggelassen.
- **Download ohne Geschwindigkeitsanzeige (Gemma 2, Qwen)**: WebLLM hat das Format der Fortschrittsmeldungen geändert; der Parser erkannte das neue Format nicht, deshalb blieben Größe, Geschwindigkeit und Restzeit leer. Der Parser versteht jetzt beide Formate.
- **Falsche "Modell geladen"-Meldung**: Wenn die eigene Modelldatei nicht abrufbar ist (z.B. Fehlerseite statt Modell), meldete die Engine fälschlich Erfolg. Der Ladevorgang wird jetzt verifiziert und fällt bei Bedarf auf HuggingFace zurück.

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
