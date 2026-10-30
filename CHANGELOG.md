# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [4.3.42] - 2026-10-30

### Behoben (P0 — Funktionsausfall)
- **Code-Block-Crash:** Jede Modellantwort mit einem ```-Block riss die komplette Oberfläche mit (ErrorBoundary-Abfang in `main.tsx`). Ursache: `Prism` aus `prism-react-renderer` ist ein Namespace-Objekt, keine Komponente — der Cast `as unknown as React.ComponentType` verdeckte den Typfehler, und `customStyle` stammt aus der API von `react-syntax-highlighter`, die es hier nicht gibt. Neu: `Highlight` mit echter Render-Prop-API (`tokens`/`getLineProps`/`getTokenProps`), Theme-Objekte als `PrismTheme` typisiert.

### Sicherheit (P1)
- **Markdown-Bilder auf same-origin beschränkt:** Die `Image`-Komponente erlaubt nur noch `data:image/`, `blob:` und same-origin URLs — fremde `https:`-Bilder in Chat-Antworten waren bislang Tracking-Pixel (die CSP fing sie auf kikobold.net ab, aber Selfhosting-Instanzen ohne `.htaccess` hätten sie geladen).
- **Protocol-relative URLs abgewiesen:** `isSafeUrl('//evil.example/x')` gab vorher `true` (kein XSS, aber der Filter verspricht „nur sichere Schemes“ und ließ fremde Hosts durch). `//`-Präfixe werden jetzt vor der Scheme-Prüfung ausgeschlossen.

### Härtung (P2)
- **Soft-404 gefixt:** Der SPA-Catch-all rewritet nur noch Pfade ohne Dateiendung auf `index.html`; fehlende Dateien (z. B. `/favicon.ico`-Tippfehler, fehlende Assets) liefern jetzt echtes 404 statt der HTML-Shell mit HTTP 200. `ErrorDocument 404 /404.html` ergänzt (eigene 404-Seite im Brand-Stil).
- **`/favicon.ico` ist jetzt ein echtes ICO** (PNG-in-ICO-Container aus `icon-192.png`, 16/32/48/64 px Einträge) — vorher lieferte der Pfad die 4-kB-HTML-Shell.
- **`/.well-known/security.txt` ergänzt** (Contact + Expires, ein Jahr gültig).
- **`protobufjs` per npm-Override auf ^7.4.0** (installiert: 7.6.6): 6.11.6 kam transitiv über `onnx-proto` (onnxruntime-web) und trägt vier offene OSV-Advisories (2× Code-Injection, 2× DoS). Build und Tests laufen mit 7.x unverändert.
- **CSP-`unsafe-eval` dokumentiert:** Die Direktive muss bleiben — `onnxruntime-web` und `@aislamov/onnxruntime-web64` rufen `eval()` direkt auf (Build-Warnung mit Byte-Offset bestätigt es). Ohne die Direktive läuft keine Inferenz. Kommentar in der `.htaccess` verhindert versehentliches „Aufräumen“.

### Verifiziert
- Lint + Type-Check + 79 Tests grün; Build 2,5 s. Live: neuer Build-Hash ausgeliefert, Code-Blöcke rendern, Soft-404-Checks (`/gibtsnicht.png` → 404, `/gibtsnicht` → 200 SPA), `favicon.ico` mit `image/vnd.microsoft.icon`, `security.txt` 200, Apex→www-301 intakt.

## [4.3.41] - 2026-10-24

### Neu (UX-Runde, alle per echtem Browser-Test verifiziert)
- **Empfehlungs-Button im leeren Chat:** „✨ Modell für mein Gerät empfehlen“ steht jetzt auch auf dem Willkommens-Screen direkt unter der Modell-Auswahl (vorher nur auf der Modelle-Seite); die Empfehlungs-Logik ist in die Modell-Registry gezogen (`getRecommendedModelId()`) und wird von beiden Stellen geteilt.
- **Profil-Auswahl gesperrt bis Modell lädt:** Der Antwortstil-Select ist deaktiviert, solange kein Modell geladen ist (Tooltip erklärt warum) — vorher konnte man ihn vor dem Modell-Load sinnlos umstellen.
- **Update-Toast:** Der Service Worker rollt Deployments sofort aus, aber lange offene Tabs merkten nichts. Jetzt prüft ein Toast (initial + alle 30 min) auf einen wartenden Service Worker und bietet „Neu laden“ an (skipWaiting + Reload; Chats liegen in IndexedDB und bleiben erhalten).
- **Download-Retry:** Fehlschlagene Modell-Downloads zeigen einen 🔄-„Erneut versuchen“-Button direkt neben der Fehlermeldung (Chat-Header und Willkommens-Screen).
- **WebGPU-Speed-Hinweis:** Browser ohne WebGPU (Firefox/Safari) sehen unter dem Warn-Banner einen dezenten Tipp, dass Chrome/Edge deutlich schneller läuft.

### Infrastruktur
- **E2E-Smoke-Test im Repo:** `e2e/e2e-test.mjs` (Playwright, Headless-Chromium) testet App-Boot, Onboarding, alle Seiten, Empfehlungs-Button, FAQ, Modell-Download + echten Chat mit Antwort-Prüfung. GitHub-Actions-Workflow `.github/workflows/e2e.yml` (manuell auslösbar; Tages-Cron bis 01.11.2026 pausiert — Actions-Kontingent).
- **Open-Source-Vorbereitung:** MIT-`LICENSE` ergänzt, `package.json` mit `author`/`license`, README-Lizenz-Notiz (Entwicklung mit KI-Unterstützung: Mistral Vibe, GLM), Open-Source-Claims in Website/FAQ wiederhergestellt (Revert), `deploy.sh` mit parametrisiertem Host/User (`DEPLOY_HOST`/`DEPLOY_USER`).

## [4.3.40] - 2026-10-11

### Neu (iOS-Warnung)
- **Klare Meldung statt Endlos-Spinner:** Auf iOS-Geräten (alle Browser — auch Chrome/Firefox auf iOS, da alle WebKit nutzen müssen) erscheint jetzt eine verwerfbare Warnung: KI-Modelle lassen sich im Browser auf iOS derzeit nicht starten (WebKit fehlen MEMORY64 und JSPI; auch der Asyncify-Compat-Build wird bei der Initialisierung nicht fertig — auf einem iPhone 13 mit iOS 27.1 verifiziert). Empfehlung: Desktop oder Chrome auf Android; native App geplant. Der Watchdog-Fehler nach dem Timeout nennt auf iOS ebenfalls die Plattform-Beschränkung statt eines generischen Speicherhinweises.
- **iOS-Erkennung:** `isIOSDevice()` in `src/utils/device.ts` (UA + iPad-Desktop-UA-Touch-Trick).

## [4.3.39] - 2026-10-11

### Behoben (Root Cause gefunden: iOS-Deadlock in der Modell-Vorbereitung)
- **Ursache:** kikobold.net ist cross-origin isoliert (COOP/COEP, nötig für die Bild-Engine) — damit aktiviert wllama auf dem iPhone den pthread-Multi-Thread-Modus. Safari hat kein JSPI und läuft im Asyncify-Modus, und **Asyncify + pthreads deadlockt die Modell-Initialisierung auf iOS**: Der Download läuft durch (JS), die Vorbereitung hängt für immer. ensu (ente) geht das Problem komplett anders an — ensu.ente.com sendet gar keine COOP/COEP-Header, läuft also auf iOS immer im Single-Thread-Modus.
- **Fix 1 — Single-Thread erzwingen ohne JSPI:** `n_threads: 1` in Browsern ohne JSPI (Safari, Firefox); Chrome/Edge behalten Multi-Threading. Die Isolation bleibt für die Bild-Engine bestehen.
- **Fix 2 — Compat-Build selbst hosten:** Ohne JSPI lädt wllama 3.x standardmäßig sein Asyncify-WASM vom jsdelivr-CDN — den die CSP nicht erlaubt und der offline nicht funktioniert. Der Compat-Build (@wllama/wllama-compat 3.8.1) liegt jetzt unter `/wllama/compat/` auf dem eigenen Webspace und wird per `setCompat()` angebunden.
- **Verifiziert:** iPhone-Simulation (isoliert + kein JSPI) lädt das 350M-Modell in ~4 s — Single-Thread, lokales Compat-WASM, null Fehler; Chrome (JSPI) läuft unverändert mit Multi-Threading (4 s).

## [4.3.38] - 2026-10-11

### Neu (Fortsetzbarer Modell-Download, übernommen von ente/ensu)
- **Downloads überleben Abbrüche:** wllamas eigener Downloader truncatet die Cache-Datei bei jedem Versuch und startet immer bei Byte 0 — auf dem Handy (Bildschirmsperre, Tab-Wechsel, Netzwechsel mitten im Download) bedeutet das: Endlos-Neustarts und eine halbe Datei ohne Metadaten, an der die Initialisierung hängt. Neu: `ensureModelCachedResumable()` lädt per HTTP-Range-Requests direkt in die OPFS-Cache-Datei und setzt einen unterbrochenen Download beim nächsten Versuch beim letzten Byte fort (Ansatz aus ente/ensu, `web/apps/ensu/src/services/llm/inference.ts`). Metadaten werden im wllama-eigenen Format geschrieben, `loadModelFromUrl` findet danach einen gültigen Cache und lädt ohne erneuten Download.
- **Edge-Cases:** 416 (Offset am Dateiende) wird als „Datei bereits vollständig, Metadaten fehlen" erkannt und über einen 1-Byte-Probe vervollständigt; eine Datei, die LÄNGER als das Original ist, wird gelöscht und neu geladen; ohne OPFS/Writable-File-Handles greift wllamas eigener Downloader.
- **Verifiziert:** Frischer Download, Resume nach künstlichem Abbruch bei 40 % (Fortschritt startet beim Offset, Range-Request wird vom Server mit 206 bedient), Laden aus vollständigem Cache — jeweils mit Modell-Load danach, ohne Fehler.

## [4.3.37] - 2026-10-11

### Verbessert (Cache-Validierung nach dem Vorbild von ente/ensu)
- **Korrupter Modell-Cache wird erkannt und beseitigt:** Vor dem Laden wird der wllama-Cache validiert (`ModelManager.validate()`). Ein unterbrochener Download (z. B. abgebrochener Ladeversuch) hinterlässt eine kaputte Cache-Datei, an der die Speicher-Initialisierung hängt oder scheitert — genau das konnte das endlose „Modell wird geladen" auf dem Handy erklären. Ungültige Einträge werden gelöscht und das Modell frisch heruntergeladen. Ensue (ente/ente, web/apps/ensu) validiert seine Modelle auf dieselbe Weise; sein „läuft überall" beruht aber auf dem nativen Tauri-Backend (llama.cpp mit mmap, ohne Tab-RAM-Limit) — im Browser gilt für ensu dieselbe Physik wie für uns.

## [4.3.36] - 2026-10-11

### Behoben (Mobile-Drawer, zweite Runde)
- **Höhen-Fallback:** Der Drawer nutzte `h-dvh` allein — iOS-Versionen ohne dvh-Unterstützung bekommen damit GAR keine Höhe (Drawer wächst mit dem Inhalt, unten abgeschnitten, nichts scrollbar). Jetzt `h-screen` als Basis und `dvh` nur per `supports-[height:100dvh]`-Query, wo der Browser es kann.
- **Scroll-Safety-Net:** Der Inhalts-Wrapper des Drawers scrollt jetzt selbst (`overflow-y-auto`), wenn die fixen Teile der Sidebar (z. B. aufgeklappte Navigationsgruppen) die Drawer-Höhe sprengen — vorher wurde der untere Teil einfach abgeschnitten. Die Chat-Liste scrollt weiterhin intern.

## [4.3.35] - 2026-10-11

### Neu (Mobile-Modell)
- **LFM 2.5 350M:** Neues kleines WASM-Modell (LiquidAI/LFM2.5-350M-GGUF, Q4_0, 219 MB) für Handys und ältere Geräte — selbstgehostet unter `/models/LFM2.5-350M-Q4_0.gguf`. Das 1,6B-Modell (664 MB) überfordert die RAM-Grenze mobiler Safari-Tabs; die Vorbereitung im Speicher dauert dort sehr lange oder scheitert. Das 350M startet auf Handys in Sekunden.
- **Mobil-aware Fallback:** `getWasmFallbackModelId` wählt auf Handys jetzt das kleinste GGUF-Modell (350M) statt des empfohlenen 1,6B — WebGPU-Ausfall oder zu wenig RAM landen damit auf dem Modell, das auf dem Handy tatsächlich läuft.
- **Mobile-Empfehlung:** Modelle-Seite und Mobile-Hinweis empfehlen auf Handys ausdrücklich LFM 2.5 350M (de/en); neue Modellkarte mit Stärken/Schwächen.

## [4.3.34] - 2026-10-11

### Behoben (Mobile-Test auf dem iPhone)
- **Seitenmenü scrollbar:** Der Mobile-Drawer (Hamburger-Menü) war `h-screen` hoch, enthielt aber zusätzlich einen eigenen ~57px-Kopf — die eingebettete Sidebar (ebenfalls `h-screen`) lief damit über den Drawer hinaus: Der untere Teil (Navigation, Verlauf, Fußzeile) war abgeschnitten und es gab keine Möglichkeit, dorthin zu scrollen. Der Drawer ist jetzt eine Flex-Spalte mit fixem Kopf; die Sidebar füllt den verbleibenden Platz (`fillHeight`-Prop) und scrollt intern. Zusätzlich `h-dvh` statt `h-screen`: Auf iOS Safari umfasst 100vh auch den Bereich hinter der Browser-Leiste, der Drawer-Unterrand wäre dort teilweise verdeckt gewesen.
- **Vorbereitungs-Phase auf dem Handy:** Erwartung jetzt sofort korrekt („auf dem Handy kann das einige Minuten dauern, das ist normal") statt „paar Sekunden" mit Korrektur erst nach 60 s; Watchdog auf Mobilgeräten 10 statt 5 Minuten — iOS Safari hat kein JSPI, das Modell wird im WASM-Langsam-Modus initialisiert, das darf länger dauern.

## [4.3.33] - 2026-10-11

### Behoben (Mobile: LLM-Download bleibt bei „Modell wird geladen" hängen)
- **Ursache:** Mobile Browser (v. a. iOS Safari) pausieren die Seite komplett, wenn der Bildschirm sperrt oder der Tab in den Hintergrund geht — Download und Speicher-Vorbereitung frieren mitten ein und der Spinner dreht ewig.
- **Screen Wake Lock:** Neuer Service `src/services/wake-lock.ts` hält den Bildschirm während Modell-Download, Speicher-Vorbereitung und Textgenerierung wach (Wake-Lock-API, Safari 16.4+; referenzgezählt, damit die rekursiven Fallback-Ladungen den Lock halten, bis die letzte fertig ist; bei Tab-Rückkehr wird der Lock automatisch neu angefordert). Nicht unterstützte Browser laufen einfach ohne Lock weiter.
- **Weniger RAM auf Handys:** wllama lädt auf Mobilgeräten mit 2048 statt 4096 Token Kontext — der KV-Cache ist ein großer Teil des WASM-Heaps obendrauf, und iOS Safari killt Tabs um ~1–1,5 GB.
- **Kein Endlos-Spinner mehr:** Die Vorbereitungsphase zeigt jetzt einen mitlaufenden Timer („Vorbereitung läuft seit 2:05 min"), nach 60 Sekunden einen Hinweis, dass das auf Mobilgeräten mehrere Minuten dauern kann, und ein Watchdog (5 Minuten ohne Fortschritt) zeigt eine klare Fehlermeldung mit Empfehlung (Seite neu laden, kleineres Modell) statt ewig zu warten.
- **Mobile-Hinweise:** Overlay zeigt auf Handys „Bildschirm anlassen und Tab offen halten" (Download und Vorbereitung); die Modelle-Seite erklärt auf Handys, dass WebGPU-Modelle (Qwen) am Desktop laufen und auf dem iPhone automatisch das kleinere LFM-Modell geladen wird (de/en).
- **Android: WebGPU-Falle geschlossen:** Chrome auf Android hat WebGPU — dort versuchte die App bisher die großen Qwen-MLC-Modelle auf dem Handy, was nach ~1 GB Download am RAM-Limit scheitert (auf dem iPhone trat das nie auf, weil Safari kein WebGPU hat). Jetzt: Warndialog beim Auswählen eines WebGPU-Modells auf dem Handy (de/en), automatischer Rückfall auf das LFM-WASM-Modell, wenn Chrome auf Android ≤ 2 GB RAM meldet (`navigator.deviceMemory`, meldet nur Chrome — Safari/Firefox geben nichts an), und die Mobil-Erkennung ist als gemeinsamer Helper `src/utils/device.ts` gebündelt (`isMobileLike()`, `getDeviceMemoryGB()`), statt vierfach dupliziertem Regex.

## [4.3.32] - 2026-10-11

### Geändert
- **Roadmap gestrafft:** Von 10 Kategorien mit 45 Punkten auf 5 Kategorien mit 16 kurzen Einzeilern reduziert (Bild-Studio, Chat & Assistent, Dokumente & Wissen, Privatsphäre, Erweiterbarkeit). Die ausführlichen Ausarbeitungen aller 45 Ideen bleiben in der lokalen `VERBESSERUNGS-IDEEN.md` erhalten. Die zwei bereits existierenden Punkte (Sprachausgabe, Textskalierung) sind entfallen.

## [4.3.31] - 2026-10-11

### Neu
- **Roadmap kräftig erweitert:** Von 3 Kategorien mit 8 Punkten auf 10 Kategorien mit 45 Ideen - große Features (Bild-zu-Bild/Inpainting, Dokumente befragen (lokales RAG), Antworten zweier Modelle vergleichen, dauerhaftes Gedächtnis, App-Sperre per WebAuthn, eigene GGUF-Modelle, MCP-Werkzeuge) und kleine (Tastenkürzel, Drag & Drop, Schriftgröße, Sprachausgabe/-eingabe, Stil-Presets, Prompt-Bibliothek). Der veraltete Punkt „Bildgenerierung wird geprüft" ist durch aktuelle Bild-Modell-Pläne ersetzt (das Studio ist ja live).

## [4.3.30] - 2026-10-11

### Neu
- **Betreiber-Hinweis im Bild-Studio:** Ergänzender Absatz in der Nutzungsregeln-Box: Die Bildgenerierung läuft vollständig lokal im Browser; der Betreiber hat keinen Zugriff auf erzeugte Bilder (kein Einsehen, Speichern, Löschen) und keine Kontrolle über die Generierung. Die Verantwortung liegt ausschließlich beim Nutzer; für rechtswidrige Inhalte trotz der Schutzfilter haftet der Verursacher, nicht der Betreiber (de/en).

## [4.3.29] - 2026-10-11

### Neu (Sicherheitsfilter für die Bildgenerierung)
- **Prompt-Filter vor der Generierung:** Prompts mit sexuell expliziten Inhalten oder Bezug zu Kindern/Minderjährigen werden gesperrt, bevor das Modell geladen oder ausgeführt wird (`src/services/image-safety.ts`). Normalisierung faltet Groß-/Kleinschreibung, Umlaute/Diakritika, Leetspeak (`p0rn`) und Trennzeichen-Tricks (`n s f w`); Altersangaben bis 17 Jahre gelten als Minderjährige. Jugendwörter allein („Mädchen mit rotem Luftballon") sperren nicht — erst die Kombination mit sexuellen Begriffen eskaliert zur Kategorie ‚Minderjährige'. Der Negative Prompt wird bewusst NICHT geprüft: Negative Prompts unterdrücken Konzepte, „nsfw" dort ist legitime Sicherheitsnutzung.
- **Output-Heuristik nach dem VAE-Decode:** Vor der Anzeige/Download wird das Rohtensor auf den Hautfarben-Anteil geprüft (klassische RGB-Skin-Regel nach Peer et al.); ab 55 % Hautanteil wird das Bild gesperrt (Vollbild-Nudität liegt typischerweise bei 60–80 %, legitime Portraits bei 15–45 %). Bewusst konservativ: Teilnudität kann durchrutschen, monochrome hautfarbene Flächen können falsch positiv werden — dokumentierte Heuristik, kein Klassifikator.
- **Sichtbares Nutzungsverbot:** Hinweisbox mit Nutzungsregeln im Bild-Studio (inkl. § 184b StGB, der auch virtuelle/KI-generierte kinderpornografische Inhalte erfasst) und neue Sektion „Nutzungsbedingungen / Untersagung bestimmter Inhalte" im Impressum.
- **Ehrliche Einordnung im Code dokumentiert:** Alles läuft client-seitig — ein entschlossener Nutzer kann Filter per Devtools umgehen. Der Filter erhöht die Schwelle, blockiert den beiläufigen Weg und dokumentiert die Betreiber-Position; er ist keine Garantie.

## [4.3.28] - 2026-10-11

### Behoben (Voll-Audit: Security, Bugs, Syntax, Barrierefreiheit)
- **Barrierefreiheit — Overlay-Backdrops waren keine Tastatur-Ziele:** Das mobile Sidebar-Overlay und der Bildvorschau-Modal schlossen sich per `div` mit `onClick` — für Tastatur- und Screenreader-Nutzer war die „Klick auf den Hintergrund“-Fläche kein bedienbares Element. Beide Backdrops sind jetzt echte `<button>`-Elemente mit `aria-label` (Esc funktioniert weiterhin).
- **Barrierefreiheit — klickbare Markdown-Bilder:** Ein Bild mit Lightbox-Handler war ein `img` mit `role="button"`/`tabIndex` — ein Semantik-Trick, der Screenreadern ein „Bild als Button“ meldet. Der Klick liegt jetzt auf einem echten `<button>`, der das Bild umschließt.
- **Token-Zähler im nicht-streamenden wllama-Pfad:** `generate()` zeigte für wllama-Modelle immer 0 Tokens an (kein Usage-Report) — jetzt mit der gleichen ~4-Zeichen-pro-Token-Schätzung wie im WebLLM-Fallback.
- **Lint-Konfiguration:** `label-has-associated-control` mit `depth: 4` — die Settings-Labels schachteln ihren Text in `label > span > span > {t(...)}`, was die Regel bei Standard-Tiefe 2 nicht sieht und fälschlich als „kein zugänglicher Text“ meldete (axe-core bestätigte: keine echten Verstöße). Non-Null-Assertions in Tests sind bewusst erlaubt (Fixture-Narrowing). Die vier `autoFocus`-Stellen (Rename-/Suchfeld, Ordner-Formulare) sind dokumentierte Ausnahmen — der Fokus gehört auf das gerade geöffnete Feld.
- **Syntax-Kosmetik:** `};//` in system-info.ts und ein `const //`-Kommentar-Dangling in Sidebar.tsx aufgeräumt.

### Optimiert
- **`downloadEta` dedupliziert:** Die identische Restzeit-Berechnung stand in MainLayout und ImageStudio — jetzt einmal in `utils/format.ts`.
- **`accept`-Attribut zentral:** Der Datei-Picker-Filter (`accept=".txt,.md,..."`) war in InputBox und LibraryManager hartkodiert und konnte von der tatsächlichen Allowlist (`ALLOWED_EXTENSIONS`) abweichen — jetzt wird `DOC_ACCEPT_ATTRIBUTE` aus der Allowlist generiert (Single Source of Truth).

### Geprüft (ohne Funde)
- Security-Review: CSP/.htaccess, KaTeX-Ausgabe, URL-Scheme-Whitelist, Import-/Export-Validierung, Storage-Layer, Service Worker (Same-Origin-Caching) — keine neuen Schwachstellen. `server-zugangsdaten.txt` liegt nicht und lag nie im Git.
- `npm run lint` (jetzt 0 Warnungen), `npm run type-check`, `npm test` (47 Tests), `npm run check:i18n` und `npm run audit:a11y` (axe-core: 0 Verstöße in Hell- und Dunkel-Modus) — alles grün.

## [4.3.27] - 2026-10-11

### Entfernt (toter Code) / Optimiert

- **Toter Inference-Code aus dem Bundle entfernt:** `useBatchInference`/`useConversationInference` (nie importiert), `preloadModel` (reiner Log-Platzhalter), `unloadModel` (nie aufgerufen — das eigentliche Freigeben macht der Unmount-Cleanup), die `autoLoad`/`modelId`-Hook-Optionen (einziger Konsument war der Auto-Load-Effekt, der am einzigen Einsatzort konstant deaktiviert war). Dazu die verwaisten Typen `UseInferenceReturn`, `InferenceOptions`, `InferenceResult`, `ThemeSettings`/`CustomizationSettings`/`ThemeMode`.
- **GPU-Erkennung: ein Adapter statt drei.** `getSystemInfo()` öffnete bis zu drei Adapter und zwei Devices pro Aufruf (`checkWebGPUSupport` in `detectGPU` UND `detectFeatures`, plus ein separater Adapter für den GPU-Namen). Neuer gecachter `probeGPU()` in system-info teilt Adapter + Device-Test für alle Detektionen; `checkWebGPUSupport` aus security.ts ist damit aufruferfrei und entfernt.
- **Sidebar: Chats in einem Durchlauf gruppieren** statt die komplette Liste pro Ordner zu filtern (O(chats × Ordner) → O(chats + Ordner) pro Render; die Sidebar rendert bei jeder Chat-Änderung neu).
- `getEstimatedSizeFromModelSize` (useModels) blieb: Der Audit-Verdacht „ohne Aufrufer" war falsch — es ist der legitime Fallback für Registry-Einträge ohne explizites `fileSizeMB`. Der `visibleMessages`-Memo in ChatWindow war bereits optimal (Filter nur bei aktiver Suche).

## [4.3.26] - 2026-10-11

### Geändert (Umsetzung der zurückgestellten Aufräum-Kandidaten)

- **Sidebar/Daten-Seite laden keine Nachrichten mehr:** Neue `ChatStorage.getChatMetadatas()` (Cursor-Read) liefert die Chat-Liste ohne Nachrichten plus `messageCount` — bisher materialisierte `getAllChats()` jede Nachricht jedes Chats im Speicher, nur um Titel/Datum/Ordner zu rendern. Der Typ `ChatMetadata` ersetzt `Chat` in Sidebar, DataManager und `useChat.chats`; der Daten-Export liest die vollen Chats zur Laufzeit frisch aus der DB.
- **Markdown-Streaming deutlich günstiger:** `splitBlocks(content)` läuft in `MarkdownContent` jetzt memoized — die Streaming-Bubble rendert pro Token und hat sonst den jeweils kompletten Text neu in Blöcke zerlegt (quadratische Arbeit über die Antwortlänge).
- **Profile-Import robust:** Fehlende/ungültige `temperature`/`topP`/`maxTokens`/`updatedAt` aus fremden oder hand-editierten Exporten werden normalisiert (Clamps wie `saveProfile` sie erzwingt), statt den Import mitten drin abbrechen zu lassen; gespeichert wird pro Profil mit eigenem try/catch — State und Storage können nicht mehr divergieren, ein kaputtes Profil reißt die anderen nicht mit.
- **security.ts aufgeräumt:** Der MIME-Typ-Check war tot (`fileName.endsWith(fileExtension)` ist immer true, weil die Extension aus dem Namen abgeleitet wird) — entfernt; der Browser-MIME ist ohnehin plattformabhängig unzuverlässig, die Extension-Allowlist ist das echte Gate und die Importer validieren den Inhalt strukturell. `checkWASMSupport` gab in beiden Zweigen `true` zurück (der `instantiateStreaming`-Zweig war wirkungslos) — auf die eigentliche Aussage reduziert.
- **Theme-Service-Konsolidierung: bereits erledigt** — die Prüfung zeigt, dass v4.2.1 („Dark-Mode ohne Prop-Drilling") das vollständig umgesetzt hat; keine duplizierte Theme-Logik mehr im Code, alle Konsumenten laufen über `services/theme.ts` bzw. `useDarkMode`.

## [4.3.25] - 2026-10-11

### Behoben (Voll-Audit: komplette Code-Analyse + Security-Review)

- **Kritisch — Antwort landete im falschen Chat:** Wechselt man während der laufenden Generierung den Chat (oder legt einen neuen an), wurde die Antwort dauerhaft im dann-aktiven Chat gespeichert, die Frage blieb im alten. Der Sendefluss pinnt jetzt die Chat-ID (`addMessage` nimmt die ID an; der Ziel-Chat wird bei Abweichung aus der DB geladen).
- **Thinking-Tags im Prompt:** Frühere Reasoning-Blöcke (imd/think) wurden roh in die History zurückgegeben — Thinking-Modelle reagieren darauf mit erneuten, abgebrochenen Denkblöcken. Die History wird jetzt pro Nachricht gestrippt.
- **Vorlesen sprach versteckte Reasoning mit:** TTS bekam den Rohinhalt inkl. der unsichtbaren Tags; jetzt wird nur der angezeigte Text vorgelesen.
- **Nachrichtenverlust bei Umbenennen/Verschieben:** `renameChat`/`moveChatToFolder` liefen als get/put über zwei Transaktionen — ein paralleler Schreiber (zweiter Tab) verlor dabei Nachrichten. Neues `updateChatMetadata` macht das in einer Transaktion.
- **Abgestorbene DB-Init blieb für immer gecacht:** Schlug das Öffnen einer IndexedDB einmal fehl (transient), schlugen bis zum Neuladen alle Operationen fehl. Der Fehler wird jetzt nicht mehr gespeichert (Chats, Library, Memory).
- **Bibliothek: permanente Duplikate** — erneutes Hochladen/Importieren einer Datei mit vorhandenem Namen legte eine zweite Zeile an, die nach dem nächsten Neuladen doppelt erschien. Neues Upsert-by-Name in einer Transaktion.
- **wllama-Race:** Ein neuer Generierungsstart brach eine laufende wllama-Generierung nicht ab — der alte Stream schrieb weiter in die Anzeige. `cancelWllamaGeneration()` läuft jetzt auch beim Start eines neuen Streams. Außerdem gab `loadWllamaModel` bei parallelem Laden eines anderen Modells dessen Ergebnis zurück (UI zeigte Modell B, geladen war A).
- **„Alle Daten löschen“ lässt jetzt auch Chat-Ordner weg** (vorher blieben leere Ordner in der Sidebar); der Daten-Export fängt Fehler ab (z. B. „keine Chats“) und zeigt sie an.
- **Fehlerbanner:** Sendefehler blieben über Chat-Wechsel hinweg stehen — sie werden beim Chat-Wechsel/Neu-Anlegen jetzt gelöscht.
- **Markdown:** Mehrzeilige Zitate (`> Z1\n> Z2`) wurden ab der zweiten Zeile als Fließtext mit literalen `>` gerendert; Code-Fences mit längerem Closing-Fence fielen aus dem Block-Parsing und zeigten Backticks. Beide Fälle korrekt erkannt.
- **Kleinere Fixes:** Token-Zähler im nicht-streamenden Pfad nutzt jetzt die usage-Daten statt immer 0; totes setError in loadModel entfernt; Objekt-URLs angehängter Bilder werden beim Tab-Wechsel freigegeben; GuidedTour wird bei abgebrochener Zielsuche als gesehen markiert; Modell-Select resettet bei Löschung des aktiven Modells; Ordner-Umbenennen validiert den Namen wie Anlegen; Truncation-Marker wird aufs Dokument-Budget angerechnet; GPU-Name über `adapter.info` (requestAdapterInfo wurde aus Chrome entfernt); iPadOS wird nicht mehr als macOS erkannt.
- **Security:** Service Worker cached jetzt nur noch Same-Origin-Assets; `npm audit fix` (18 → 14 Funde, keiner davon aktiv im Browser-Bundle; protobufjs ist transitiv über den ORT-Fork und wird nicht ins Bundle ausgeliefert). Security-Review der Angriffsflächen (XSS/KaTeX, Import/Export, Storage-Keys, SW, externe Zugriffe): keine kritischen oder hohen Findings im Anwendungscode.

## [4.3.24] - 2026-10-11

### Behoben

- **Bild-Studio: „9 Bilder auf einem Bild" behoben — Root Cause war die Kanal-Lesung des VAE-Outputs.** Der ONNX-VAE-Decoder liefert NCHW `[1, 3, H, W]` mit **planarer** Datenlage (drei vollständige R/G/B-Ebenen hintereinander); `tensorToDataUrl` las die Daten aber **interleaved** (RGB-Tripel pro Pixel). Dadurch setzte sich jeder Pixel aus drei benachbarten Werten *derselben* Ebene zusammen: Das Bild erschien als 3x3-Raster von Kanal-Slices (und war quasi graustufig, weil R≈G≈B pro Pixel). Pixel-Analyse des Harness-Bildes bestätigte die Struktur (kanalnah gleiche Pixel überall, keine natürliche Farbe). Die Konvertierung liest NCHW jetzt planar (R = `[0..HW)`, G = `[HW..2HW)`, B = `[2HW..3HW)`) und NHWC weiterhin interleaved; zusätzlich prüft sie die Datenlänge gegen die Dims.
- **Bild-Studio: Seed-Anzeige.** `generateImage` liefert jetzt den verwendeten Seed zurück; das Studio schreibt ihn nach der Generierung ins Seed-Feld und zeigt ihn unter dem Ergebnis an — ein Klick auf „Erneut erzeugen" mit demselben Seed reproduziert das Bild.
- **Seed-Reproduzierbarkeit: Das Zwischen-Rauschen des Schedulers ist jetzt geseedet.** Der Fork zieht das Rauschen, das `LCMScheduler.step` zwischen den Diffusionsschritten addiert, **ungeseedet** (`randomNormalTensor(dims)` ohne Seed) — derselbe Seed lieferte also trotzdem jedes Mal ein anderes Bild. Post-Load-Patch (wie `prepare_model_inputs`/`Tensor.reshape`): `step` wird durch eine Kopie der Fork-Implementierung ersetzt, deren einzigter Unterschied ein deterministischer RNG (FNV-1a-Hash aus Seed + Schrittindex, mulberry32, Box-Muller) für das Rauschen ist. Gleicher Seed + gleicher Prompt + gleiche Schritte = exakt dasselbe Bild.

## [4.3.23] - 2026-10-11

### Behoben

- **Bild-Engine: „unreachable" beim Generieren behoben — Root Cause war die JSPI-Suspending-Übersetzung.** Der Fehler ließ sich mit einem neuen Headless-Chrome-Harness (`scripts/sd-repro/webgpu-repro.mjs`, echtes WebGPU/Metal, CDP-Exception-Debugger) exakt reproduzieren und bis auf die Ursache zurückverfolgen: Der Text-Encoder lief komplett auf der GPU durch, dann scheiterte der GPU-Readback mit „data does not exist", das Wasm fängt das, wirft fatal und trappt „unreachable". Ursache: Die finale `WebAssembly.Suspending()`-API übergibt der JS-Funktion das Promise (den führenden externref des Imports) als **zusätzliches erstes Argument** — die Draft-API, gegen die der Fork gebaut ist, tat das nicht. Dadurch verschoben sich alle Parameter um eins und `Number(undefined)` wurde als GPU-Data-ID `NaN` übergeben. Der Shim entfernt das erste Argument jetzt in der Suspending-Übersetzung. Im Harness bestätigt: Die angeforderte ID war `NaN` bei gültigen Cache-Schlüsseln.

## [4.3.22] - 2026-10-11

### Behoben

- **Bild-Engine: "this.prepare_model_inputs is not a function" behoben — die Pipeline läuft jetzt komplett durch.** Der 4.3.21-Fix wirkte (alle Sessions erstellen sich), der Fehler rückte in die Generierung. Vollständiger Node-Ende-Ende-Test (`scripts/sd-repro/sd-pipeline-e2e.mjs`, Browser-Builds von diffusers.js und ORT gegen die echten Modelle) hat drei weitere Inkompatibilitäten des Forks gefunden und jeweils reproduziert + Fix verifiziert:
  - **Tokenizer:** Der Fork ruft `this.prepare_model_inputs(...)` auf — ein Hook aus transformers.js v1, den `@xenova/transformers` 2.x nicht mehr definiert. Wiederhergestellt als Pass-Through (wie im Original) auf dem Prototyp des Tokenizers.
  - **Tensor.reshape:** Die LCM-Pipeline reshape-t das Guidance-Embedding; xenovas Tensor erbt die Methode aus `onnxruntime-common` — aufgelöst wird die verschachtelte 1.14.0, die sie noch nicht hat. Wiederhergestellt exakt wie onnxruntime-common 1.16 sie implementiert. `@xenova/transformers` ist jetzt eine direkte Dependency (exakt 2.17.2, dedupliziert).
  - **JSPI-Promising:** Der Draft-Wrapper streicht den führenden externref der Async-Exports (im Wasm verifiziert: `OrtRun` ist `(externref, i64 x 8) -> i32`); die finale `WebAssembly.promising()`-API behält ihn. Der Shim injiziert einen Platzhalter, sonst stirbt der erste `OrtRun`-Aufruf an "Cannot convert undefined to a BigInt".
  - Im Test erzeugt die Pipeline danach ein echtes Bild (256x256, 1 Schritt, CPU-Wasm-EP in 27 s). Phase 1 ohne Patches reproduziert exakt den gemeldeten Fehler.

## [4.3.21] - 2026-10-11

### Behoben

- **Bild-Engine: "offset is out of bounds" beim Session-Aufbau endgültig behoben.** Tiefenanalyse von Bundle und Wasm-Binary plus direkter Node-Repro gegen das echte `ort-wasm-simd.jsep.wasm` (siehe `scripts/sd-repro/`) hat die Ursache gefunden: Das nicht-Threaded-Wasm definiert seinen 16-GiB-Heap *intern* (memory64, 16 MiB initial) - der JS-Konstruktor wird nie aufgerufen, deshalb griff der bisherige Memory-Shim ins Leere. Die Emscripten-Glue des Forks wächst den Heap mit `memory.grow(NUMBER)` - die finale memory64-API (Chrome 133+) verlangt aber einen BigInt. Jedes Grow wirft `TypeError: Cannot convert ... to a BigInt`, die Glue schluckt die Ausnahme, `_malloc` liefert 0, und `createSessionAllocate` starb an `HEAPU8.set(model, 0)` - exakt der gemeldete Fehler. Der Fix übersetzt Number<->BigInt in `WebAssembly.Memory.prototype.grow`, sobald der native Aufruf den Argumenttyp ablehnt (i32-Memories der Chat-Modelle unchanged, da der erste Aufruf nativ gelingt). Im Node-Test reproduziert der Fehler sich exakt und ist mit dem Patch behoben: text_encoder (246 MB) und unet inkl. 1,6 GB External Weights erstellen ihre Sessions erfolgreich. Der JSPI-Shim ersetzt jetzt auch ein natives `WebAssembly.Function` ohne statisches `.type()`; außerdem ist belegt, dass der Webspace byte-identische Dateien liefert (Wasm-Hash und onnx_data-Prüfsummen stimmen mit lokal überein).

## [4.3.20] - 2026-10-11

### Geändert

- **Accessor-Diagnose für `WebAssembly.Memory`**: Der 4.3.19-Bericht bestätigte, dass der gepatchte Konstruktor während des gesamten Ladens *nie aufgerufen* wird - obwohl die Glue läuft. Der Shim ersetzt die Property jetzt durch einen Accessor (`Object.defineProperty` mit get/set), der jedes Lesen und jede Neu-Zuweisung protokolliert, und unmittelbar vor dem Modell-Laden wird verifiziert, dass die Property noch unseren Patch enthält. Damit klärt der nächste Bericht endgültig: liest die Glue die Property überhaupt (und bekommt dabei was), oder läuft sie in einem anderen Binding/Realm.

## [4.3.19] - 2026-10-11

### Geändert

- **Memory-Diagnose protokolliert jetzt jeden Konstruktor-Aufruf**: Der 4.3.18-Bericht zeigte Shim-Installation und env-Zustand, aber keinerlei Memory-Anlage der Glue - obwohl das Wasm lief. Die Diagnose zeichnet jetzt jeden Aufruf des gepatchten Konstruktors *am Funktionseingang* auf (mit vollem Descriptor), bevor irgendeine Verzweigung oder Konstruktion laufen kann; schlägt die übersetzte Anlage fehl, wird der Fehler protokolliert und weitergeworfen. Damit unterscheidet der nächste Bericht sicher: wird der Patch nie aufgerufen (anderer Realm/Binding) oder schlägt die Anlage fehl?

## [4.3.18] - 2026-10-11
## [4.3.18] - 2026-10-11

### Behoben

- **Memory-Diagnose wurde von sich selbst geflutet**: Die Browser-Probe (`getImageGenRuntimeIssue`) lief bei *jedem* React-Render des Bild-Studios - und das Studio rendert bei jedem Progress-Event. Beim Laden des gecachten Modells feuert die Engine tausende Progress-Events, also tausende Proben à drei Memory-Anlagen - darunter je eine Shared-Memory mit 16-GiB-Reservierung. Die 20er-Log-Grenze wurde von Proben überschwemmt und die eigentlich interessanten Einträge (Memory-Erzeugung der Glue, grow-Operationen) herausgedrängt - deshalb zeigte der 4.3.17-Bericht nur Proben. Die Probe ist jetzt gecacht (einmal pro Seitenladung); das behebt nebenbei auch die hundertfache Memory-Allokation pro Render.

## [4.3.17] - 2026-10-11

### Geändert

- **Memory-Diagnose verschärft**: Der Fehlerbericht von v4.3.16 zeigte Downloads erfolgreich, aber einen *leeren* Memory-Abschnitt - obwohl die Glue ihre Memory zwingend anlegen muss, bevor das Wasm läuft. Die Diagnose protokolliert jetzt zusätzlich: die Shim-Installation selbst, Memory-Anlagen über *beide* Konstruktor-Zweige (auch ohne i64-Index, falls der Descriptor unerwartet anders aussieht) und den env-Zustand (numThreads, proxy, wasmPaths) zum Zeitpunkt des Ladens. Damit ist der nächste Bericht dreifach eindeutig: lief der Shim, welchen Descriptor sah er, und in welchem Modus lief ORT.

## [4.3.16] - 2026-10-11

### Behoben

- **Modell-Download der Bild-Engine blieb bei ~100 MB stehen**: Das Request-Recording aus 4.3.11 hatte einen Doppel-Fetch-Bug - für `/models/sd/`-Dateien wurde versehentlich ein zweiter, verworfener Fetch parallel zum eigentlichen (no-store-)Download gestartet; der Verwaiste lud dieselbe 1,6-GB-Datei als Parallel-Stream mit und störte den aktiven Download. Jetzt gibt es genau einen Fetch pro Anfrage. Zusätzlich drosselt das Bild-Studio die Progress-Updates auf höchstens 10 pro Sekunde - bei ~27 MB/s feuert die Engine über tausend Events pro Sekunde, deren individuelle React-Renders den Main-Thread sättigen.

## [4.3.15] - 2026-10-11

### Geändert

- **Versionskennzeichnung in Fehlermeldungen der Bild-Engine**: Die Diagnose-Anhänge der Ladefehler beginnen jetzt mit der App-Version (`[v4.3.15] [requests: ...] [memory: ...]`). Hintergrund: Ein Fehlerbericht ohne Memory-Diagnose erwies sich als Lauf gegen den alten, noch im Service-Worker-Cache hängenden Stand - mit der Versionskennung ist das auf einen Blick unterscheidbar.

## [4.3.14] - 2026-10-11

### Geändert

- **Memory-Diagnose in Fehlermeldungen der Bild-Engine**: Der Fehler „offset is out of bounds" in `createSessionAllocate` (Kopieren der Modell-Bytes in den Wasm-Heap) bedeutet, dass `malloc` einen Zeiger jenseits der JS-Heap-Views lieferte - entweder wuchs der Heap nicht richtig oder die Views sind veraltet. Der memory64-Shim protokolliert jetzt jede erzeugte Memory (Initial-/Maximum-Größe, shared) und jede grow-Operation mit der resultierenden Puffergröße; das Protokoll wird wie das Request-Log an Ladefehler angehängt. Damit zeigt der nächste Fehler die exakte Heap-Historie.

## [4.3.13] - 2026-10-11

### Geändert

- **Fehlermeldungen der Bild-Engine enthalten jetzt die Aufrufstellen**: „Model could not be loaded: offset is out of bounds" nennt keine Ursache - die Meldung zeigt jetzt die obersten Stack-Frames des Fehlers an (z. B. `@ DbCache.retrieveFile <- ...`), sodass die nächste Diagnose die exakte Stelle im Engine-/Glue-Code benennt, statt sie aus Symptomen zu raten. Das Request-Log aus 4.3.11 bleibt erhalten.

## [4.3.12] - 2026-10-11

### Behoben

- **„offset is out of bounds" nach dem Laden der ORT-Runtime**: Das Request-Log aus 4.3.11 zeigte die Ursache exakt - die Glue lud `ort-wasm-simd.wasm`, die **Nicht-JSEP**-Variante. Die im Bundle inline liegende Emscripten-Glue hat nämlich ihre eigene, fest verdrahtete `locateFile`-Funktion (scriptDirectory + schlichter Dateiname) und ignoriert das Pfad-Mapping der ORT-Factory komplett - sie forderte die Runtime also immer schon relativ an, und das Fetch-Sicherheitsnetz aus 4.3.11 lieferte ihr die falsche (nicht-JSEP) Datei. Die WebGPU-Glue braucht aber die JSEP-Variante; mit dem falschen Binary läuft sie in „offset is out of bounds". Das Sicherheitsnetz bildet jetzt dasselbe Mapping ab, das die ORT-Factory beabsichtigt hat (`ort-wasm-simd.wasm` → `ort-wasm-simd.jsep.wasm`, ebenso für die Threaded-Variante).

## [4.3.11] - 2026-10-11

### Behoben

- **„expected magic word 00 61 73 6d, found 3c 21 64 6f" beim Initialisieren der Bild-Engine**: Die ORT-Runtime holte ihre Wasm-Datei über eine *relative* URL (ohne `/ort/`-Prefix) - der Server antwortet auf nicht existierende Pfade mit der SPA-Fallback-Seite (HTML, Status 200), und `WebAssembly.instantiate` bricht mit dem Magic-Word-Fehler ab. Zwei Maßnahmen: (1) Ein Fetch-Sicherheitsnetz biegt jede Same-Origin-`ort-wasm-*`-Anfrage ohne `/ort/`-Prefix auf unser selbst gehostetes `/ort/`-Verzeichnis um - egal welche ORT-Kopie sie auslöst; (2) die Wasm-Seite läuft jetzt bewusst mit `numThreads = 1`: Der pthread-Worker wird von ORT aus einem Blob mit eigener, nicht patchbarer Glue erzeugt (unseren assert-/JSPI-Shims fehlen dort) - ohne Threads läuft die komplette Glue im Hauptthread, wo alle Shims greifen; die Rechenlast trägt ohnehin die WebGPU.
- **Ladefehler zeigen jetzt die gestellten Requests**: Bei einem Modell-Ladefehler protokolliert die Engine die letzten Requests (URL, Status, Content-Type) und hängt sie der Fehlermeldung an - damit zeigt der nächste Fehler die exakte Ursache statt eines Symptoms weiter unten.

## [4.3.10] - 2026-10-11

### Behoben

- **„WebAssembly.Function is not a constructor" beim Initialisieren der Bild-Engine**: Der ORT-Fork nutzt für seine asynchronen Kernel den *alten JSPI-Entwurf* - `new WebAssembly.Function(typ, fn, {suspending:"first"})` für Async-Imports und `{promising:"first"}` für Async-Exports. Chrome hat `WebAssembly.Function` (Typ-Reflektion) nie ausgeliefert; die finale JSPI-API (Chrome ab 137) heißt `WebAssembly.Suspending` / `WebAssembly.promising`. Ein Shim übersetzt die Entwurfs-Aufrufe zur Laufzeit in die finale API - im Hauptthread (sd-engine) und im pthread-Worker (der das Wasm-Modul mit denselben instrumentierten Imports erneut instanziiert; der Shim wird beim Kopieren der Worker-Datei vorangestellt). Der Preflight prüft zusätzlich früh, ob überhaupt eine der beiden APIs verfügbar ist (Chrome/Edge ab 137), bevor der große Download startet.

## [4.3.9] - 2026-10-11

### Behoben

- **„Dieser Browser unterstützt kein WebAssembly memory64" auf aktuellem Chrome - falsche Diagnose, echte Ursache gefunden**: Der ORT-Fork der Bild-Engine nutzt für die 16-GB-Memory-Anlage noch den *Entwurf* der memory64-JS-API (`index: "i64"` mit Number-Limits). Die finale API (Wasm 3.0, in Chrome seit Version 133) heißt aber `address: "i64"` mit BigInt-Limits - Chrome ignoriert das unbekannte `index`-Property und lehnt die Anlage mit „value 262144 is above the upper bound 65536" ab. Die Bild-Engine war dadurch auf keinem aktuellen Chrome lauffähig. Jetzt übersetzt ein Shim zur Laufzeit die alten Deskriptoren in die finale API (inklusive `grow`, das dort ebenfalls BigInt verlangt; die Glue ruft es mit Number auf). Die Browser-Probe prüft jetzt die echte finale API und unterscheidet drei Ursachen: kein memory64, abgelehnte 16-GB-Reservierung, fehlende Cross-Origin-Isolation - mit je eigener Meldung im Studio.

## [4.3.8] - 2026-10-11

### Geändert

- **Präzisere Browser-Diagnose im Bild-Studio**: Der memory64-Check unterscheidet jetzt zwei Ursachen: (1) Der Browser unterstützt WebAssembly memory64 nicht (Chrome/Edge ab Version 133 nötig) - in der Warnung wird zusätzlich die erkannte Browser-Version angezeigt („Erkannter Browser: Chrome/Edge 129"), damit sofort sichtbar ist, wie alt der Browser ist; (2) die Seite ist nicht cross-origin isoliert (COOP/COEP fehlen) - nötig für den geteilten WebAssembly-Speicher der Engine. Beide Prüfungen probieren exakt dieselbe Memory-Anlage, die die Engine später durchführt.

## [4.3.7] - 2026-10-11

### Behoben

- **„Das Bildmodell konnte nicht geladen werden: ... RangeError: WebAssembly.Memory(): Property 'maximum': value 262144 is above the upper bound 65536"**: Kein Bug unsererseits - der Browser unterstützt das WebAssembly-memory64-Proposal nicht. Der ORT-Fork der Bild-Engine („web64") ist vollständig für memory64 kompiliert: Die Glue legt eine shared Memory mit 16 GiB Maximum an (`index: "i64"`, 262144 Pages). Browser ohne memory64 wenden noch das 32-Bit-Limit von 65536 Pages (4 GiB) an und werfen genau diesen RangeError - bislang leider erst nach dem kompletten 2-GB-Download. Jetzt prüft ein Preflight vor dem Download mit derselben Memory-Anlage, ob der Browser memory64 beherrscht, und scheitert früh mit klarer Meldung. Zusätzlich zeigt das Bild-Studio bei fehlendem memory64 direkt eine Warnung (wie bei fehlendem WebGPU) und sperrt die Eingaben - niemand lädt mehr vergeblich 2 GB herunter. memory64 ist verfügbar seit Chrome/Edge 133 und Firefox 134; die heruntergeladenen Modell-Daten in der IndexedDB bleiben beim Browser-Update erhalten.

## [4.3.6] - 2026-10-11

### Behoben

- **„Das Bildmodell konnte nicht geladen werden: ... ReferenceError: assert is not defined"**: Der Fehler trat erst nach dem kompletten 2-GB-Download auf, beim Initialisieren der ONNX-Runtime. Ursache ist ein Build-Bug im minifizierten `ort.webgpu.min.js`-Bundle (das der Browser-Export des Packages liefert): Die eingebaute Emscripten-Glue ruft ein nacktes `assert(...)` auf, das der Minifier nie definiert hat - im unminifizierten Bundle existiert die Funktion. Der nackte Bezeichner wird über die Scope-Kette bis `globalThis` aufgelöst, deshalb installiert die Bild-Engine jetzt vor dem Start einen kleinen Fallback (`globalThis.assert`), falls noch keines existiert. Der pthread-Worker definiert `assert` selbst und ist nicht betroffen.

### Neu

- **Download-Anzeige für das Bildmodell wie bei den Chat-Modellen**: Das Bild-Studio zeigt beim Modell-Download jetzt Gesamtfortschritt über alle Modell-Dateien (nicht nur die jeweils aktuelle Datei), geladene MB von Gesamt-MB, Tempo in MB/s und die geschätzte Restzeit - gleiche Darstellung und Formulierungen wie beim Download der Chat-Modelle. Die Engine reicht dafür die Byte-Zähler des aktuellen Downloads durch; das Studio aggregiert über alle Dateien.

## [4.3.5] - 2026-10-11

### Behoben

- **Bildmodell-Laden steckte noch im Browser-HTTP-Cache fest**: Der gzip-Fix von 4.3.4 war korrekt auf dem Server aktiv, aber die alte gzip-komprimierte Antwort (mit der falschen Content-Length) war im Browser-HTTP-Cache ohne Cache-Control-Header gespeichert und wurde heuristisch noch als frisch wiederverwendet - der Fehler blieb dadurch identisch. Jetzt doppelt gefixt: (1) Die Engine umgeht den HTTP-Cache für `/models/sd/`-Anfragen während des Modellladens (`cache: no-store`, chirurgisch nur für diese URLs, danach wiederhergestellt) - die Engine hält ohnehin ihren eigenen IndexedDB-Cache; (2) der Server sendet für den Modellbaum `Cache-Control: no-store`, damit keine veralteten Antworten mehr gecacht werden und die 2 GB nicht doppelt (HTTP-Cache + IndexedDB) vorgehalten werden.

## [4.3.4] - 2026-10-11

### Behoben

- **"Invalid typed array length: 633" beim Laden des Bildmodells**: Der Webserver komprimierte die JSON-Dateien unter `/models/sd/` mit gzip - der Content-Length-Header nannte dann die komprimierte Größe (z. B. 269 statt 633 Bytes), während `fetch()` den Inhalt transparent dekomprimiert. Die diffusers.js-Engine allokiert ihren Download-Puffer aber nach dem rohen Header und der erste Schreibzugriff lief über das Pufferende hinaus. Eine `.htaccess` unter `/models/sd/` deaktiviert gzip für den Modellbaum (verifiziert: alle Dateien liefern jetzt die echte Größe); das Download-Skript legt die Datei für künftige Kopien automatisch mit an. HuggingFace als Fallback ist von Haus aus nicht betroffen.

## [4.3.3] - 2026-10-11

### Behoben

- **"Bildmodell konnte nicht geladen werden" jetzt mit Ursache**: Die Meldung versteckte bisher den echten Fehlergrund. Die Engine liefert jetzt die tatsächliche Ursache (fehlende ORT-Dateien, WebGPU-Limit, abgebrochener Download, ...) mit aus - im Studio angezeigt als "Das Bildmodell konnte nicht geladen werden: <Detail>". Zusätzlich prüft ein Preflight vor dem großen Download WebGPU-Verfügbarkeit und die Erreichbarkeit der ORT-Runtime auf dem Server und scheitert früh mit klarer Meldung.

### Geändert

- **"Bilder (Alpha)" direkt unter "Chat"**: Der Tab ist aus der einklappbaren Verwaltungs-Gruppe in die primäre Navigation gewandert (Chat → Bilder (Alpha) → Einstellungen), das Alpha-Marker steht jetzt auch im Tab-Label.

## [4.3.2] - 2026-10-11

### Behoben

- **Modellauswahl immer sichtbar**: Der Modell-Selector existierte nur im Chat-View mit geöffnetem Chat - ohne geöffneten Chat (frischer Besuch, alle Chats geschlossen) zeigte die Willkommenskarte keine Modellauswahl. Der Dropdown ist jetzt eine eigene Komponente und erscheint auch auf dem Willkommensbildschirm.

### Neu

- **Build-Nummer in der Sidebar**: Unter dem Sprach- und Theme-Umschalter steht jetzt die aktuelle Version (z. B. "v4.3.2"); ein Klick öffnet das "Was ist neu"-Fenster mit dem kompletten Changelog.
- **Mobile-Warnung vor großen Modell-Downloads**: Auf Handys (erkennbar über User-Agent oder Touch-Pointer) erscheint vor dem Download-Dialog sehr großer Modelle (ab 2 GB, aktuell Gemma 4 E2B) eine zusätzliche deutliche Warnung - mobiler Datenverbrauch, sehr langsames Laufen oder Abbruch wegen Arbeitsspeicher, Empfehlung Desktop.

### Geändert

- **Gemma 4 E2B ohne Ensu-Bezug**: Beschreibung in Registry und Modellseite nennen nur noch die Fakten (multimodal, Qualität, Größe, Ressourcenbedarf), ohne den Vergleich mit Entes App.

## [4.3.1] - 2026-10-11

### Behoben

- **Markdown wird jetzt auch während des Streamings gerendert**: Die Antwort erschien bisher während der Generierung als Rohtext (literale `**fett**`-Marker, Listenpunkte als Striche) und wurde erst nach Abschluss der Antwort als Markdown aufbereitet - das las sich wie ein Bug. Der Streaming-Bubble rendert jetzt denselben Markdown-Renderer wie die fertige Nachricht; der blinkende Cursor bleibt erhalten.

### Neu

- **Bildmodell selbst gehostet**: LCM DreamShaper v7 (~2,1 GB, 14 Dateien) liegt jetzt auf dem eigenen Webspace unter `/models/sd/` - der erste Bildgenerierungs-Download kommt nicht mehr von HuggingFace, sondern von der eigenen Domain (Fallback auf HF bleibt als Reserve erhalten). Neues Skript `scripts/download-sd-model.sh` hält die lokale Kopie in `public/models/sd/` reproduzierbar.

### Tests

- Neuer Render-Smoke-Test (`markdown-render.test.tsx`): rendert den MarkdownRenderer ins DOM und prüft konkret das gemeldete Szenario (Bold in nummerierten Listen + Sub-Bullets), Inline-Code mit Unterstrichen und mehrzeilige Listen - jetzt 47 Tests gesamt.

## [4.3.0] - 2026-10-11

### Neu

- **Bild-Studio (Alpha)**: Bilder aus Textbeschreibungen - vollständig lokal im Browser über WebGPU. Neuer Menüpunkt "Bilder" mit Prompt-Eingabe, Negativ-Prompt, Schritte-Regler (2-12, Standard 4) und Seed für reproduzierbare Ergebnisse; Download als PNG. Engine: `@aislamov/diffusers.js` (MIT) mit onnxruntime-web, Modell: **LCM DreamShaper v7** (~2,2 GB beim ersten Laden, danach im Browser gecacht). Die onnxruntime-WASM-Dateien (48 MB) werden beim Build aus node_modules nach `public/ort/` kopiert und selbst gehostet - kein CDN nötig. Das Modell wird beim Verlassen des Studios wieder freigegeben (GPU-Speicher). Überall als "Alpha" markiert (Tab, Studio, Modellseite).
- **Gemma 4 E2B** als Chat-Modell: Ensus Mobil-Modell von Google (offizielles QAT-Q4_0-GGUF, Apache-2.0), multimodal - versteht über die mitgelieferte mmproj-Datei auch Bilder. 3,3 GB Download plus ~1 GB Vision-Datei, läuft wie LFM über die WASM-Engine; bewusst nicht als automatischer Fallback für WebGPU-Modelle (zu groß für schwache Geräte).

### Modellseite

- Gemma-4-E2B-Karte mit Stärken/Schwächen (u. a. der Hinweis, dass Ensu selbst das Modell nativ nur auf High-End-Mobilgeräten nutzt - im Browser ist es grenzwertig) und eine Alpha-Sektion zur Bildgenerierung inkl. Lizenzangabe.

### Werkzeuge

- `scripts/copy-ort-wasm.mjs`: kopiert die onnxruntime-WASM-Varianten (SIMD, jsep/nicht-jsep, threaded/nicht-threaded) reproduzierbar aus node_modules - `public/ort/` ist wie `public/models/` ausgeblendet und wird über den dist-Mirror deployt.

## [4.2.3] - 2026-10-11

### Intern (keine sichtbaren Änderungen)

- **Theme-Service konsolidiert** (457 → 141 Zeilen): `theme.ts` hatte eine eigene, konkurrierende Theme-Persistenz (`webgui.theme.settings`), die von der in den App-Settings (`webgui_settings_v1`) überdeckt werden konnte. Der Service ist jetzt reine Apply-Logik (dark-Klasse + meta theme-color + System-Listener), Persistenz läuft ausschließlich über die App-Settings. Die ungenutzte Custom-Color-/Animation-/Sound-/Sprach-Maschinerie (kein CSS nutzte die Variablen) ist entfernt; Nutzer mit nur altem Legacy-Key behalten ihre Theme-Wahl durch einen einmaligen Fallback beim Start.
- **security.ts auf die tatsächlich genutzten Funktionen reduziert** (767 → 175 Zeilen): Der Voll-Sanitizer samt XSS-Pattern-Liste, URL-/Modellpfad-Validatoren, Session-Storage-Wrapper, doppeltes `formatBytes`, Speicher-Schätzung und weitere ~20 Exports hatten null Aufrufer. Übrig bleiben `sanitizeInputLight`, `validateFileUpload`, `checkWebGPUSupport` und `checkWASMSupport`. Nebeneffekt des Aufräumens: `checkWebGPUSupport` zerstört das Probe-GPU-Device jetzt wieder (`device.destroy()`) statt bei jedem App-Start Devices zu leaken.
- **ChatStorage: `updateChatMessages` als atomare Transaktion**: Bisher drei separate Transaktionen (get → mutieren → put) mit doppelter Sanitizing - konkurrierende Schreiber (zweiter Tab, schnelle Folge-Calls) konnten sich gegenseitig Nachrichten still verlieren. Jetzt ein Read-Modify-Write in einer einzigen `readwrite`-Transaktion, Sanitizing nur einmal.

## [4.2.2] - 2026-10-11

### Behoben

- **Senden während laufender Generierung blockiert**: Ein zweiter Sende-Vorgang konnte die laufende Antwort abbrechen und die Streaming-Zustände der beiden Generierungen verschränkten sich (Eingabefeld und MainLayout guarden jetzt; der Inference-Hook zerstört zudem nicht mehr den AbortController eines neueren Streams).
- **Modellwechsel wurde still zurückgesetzt**: Der „Load active model"-Effect lief bei jeder Änderung der Download-Liste neu und setzte die frisch gewählte Modell-ID auf den alten Storage-Wert zurück - läuft jetzt nur noch beim Mount.
- **Markdown-Listen korrekt gerendert**: Mehrzeilige Aufzählungen und nummerierte Listen wurden als einzelner kaputter Punkt bzw. als Absatz mit literalen Nummern angezeigt; Task-Listen (`- [x]`) waren toter Code. Neuer zeilenweiser Listen-Parser (mit Regressionstests).
- **Inline-Code nicht mehr von Italic zerstört**: `` `some_var_name` `` wurde innerhalb des Codes kursiv formatiert; Inline-Code wird jetzt zuerst extrahiert, Underscore-Italic benötigt außerdem Wortgrenzen (snake_case bleibt außen vor).
- **Gedächtnis-Block behält jetzt die NEUEN Einträge**: Bei Überschreitung des Zeichenlimits wurden bisher die ältesten Einträge in den Prompt gebaut und die neuesten (relevantesten) abgeschnitten - die Reihenfolge ist jetzt korrekt.
- **Profil-Texte nicht mehr verstümmelt**: Der Voll-Sanitizer entfernte Muster wie `data:` und `on...=` aus System-Prompts; Profile nutzen jetzt wie Chats/Gedächtnis/Bibliothek die schonende Variante (nur HTML-Tags).
- **Race Conditions beim Modell-Laden (wllama)**: Parallele `loadWllamaModel`-Aufrufe killten gegenseitig ihre Instanz; fehlgeschlagene Loads leakten WASM-Worker - beides gefixt (Load-Guard + `exit()` im Fehlerfall).
- **GPU-Speicher beim Unmount freigegeben**: Der Cleanup des Inference-Hooks nullte nur die Referenz; `engine.unload()` gibt den Grafikspeicher jetzt wirklich her.
- **Vorlesen stoppt beim Chat-Wechsel** und die Screenreader-Ansage „Antwort bereit" feuert nicht mehr bei jedem Chat-Wechsel (nur noch bei echten Generierungs-Übergängen).
- **Auto-Scroll folgt dem Stream nur noch am Boden**: Wer beim Streamen nach oben scrollt, um Älteres zu lesen, wird nicht mehr zurückgerissen; eigene Nachrichten und Chat-Wechsel springen weiterhin nach unten.
- **Lange Chats**: Neue Nachrichten verstecken nicht mehr die oberste sichtbare Nachricht (das sichtbare Fenster wächst mit).
- **Bild-Anhänge am Limit**: Überzählige Object-URLs werden jetzt revoked (kein Leak mehr), vorhandene Anhänge zählen korrekt ins Limit.
- **Mikrofon stoppt beim Verlassen**: Die Spracherkennung wird beim Unmount der Eingabebox abgebrochen.
- **Profil-Editor**: Beim Wechsel des bearbeiteten Profils ohne Neumontierung wurden die Werte von Profil A angezeigt - beim Speichern hätte das B mit A's Texten überschrieben (Remount per `key`).
- **Chat löschen fragt jetzt nach**: Der ✕-Button in der Sidebar löscht nicht mehr ohne Bestätigung (wie Ordner und Profile).
- **KaTeX offline**: Ein fehlgeschlagener Lazy-Import wurde dauerhaft gecacht und als unhandled rejection sichtbar - der Fehlschlag wird jetzt abgefangen und ein Retry beim nächsten Bedarf möglich.
- **Diverse kleinere Fixes**: Dateinamen ohne Punkt erzeugten eine kaputte „Extension"; TTS-onEnd-Race beim Ersetzen einer Ansage; Theme-Reset entfernt gesetzte CSS-Variablen jetzt wirklich; Modell-Cache-Löschung trifft auch den HuggingFace-Fallback; Opera/Vivaldi werden nicht mehr als Chrome erkannt; RAM-Erkennung nutzt `navigator.deviceMemory` statt des JS-Heap-Limits; `isRetryableError` respektiert die konfigurierten Retry-Codes; Settings-Booleans aus dem Storage werden validiert; Offline-Erkennung funktioniert auch ohne Service-Worker; Fokus-Falle greift jetzt auch bei `position: fixed`-Dialogen; Import von Profilen validiert die Einträge; `updateProfile` mutiert nicht mehr das Objekt des Aufrufers.

### Optimiert

- **Streaming-Pfad entlastet**: Nach jeder Nachricht wird nicht mehr die komplette Chat-Liste aus IndexedDB neu geladen (lokaler Patch), Such-Highlighting kompiliert den RegExp nur noch einmal pro Query statt pro Nachricht pro Render.
- **Deploy-Skript härter**: lftp bricht beim ersten fehlenden Kommando ab (`cmd:fail-exit`) und das SFTP-Passwort läuft über die Umgebung statt über die Prozessliste (`--env-password`).
- **Vite-Config aufgeräumt**: Tote `external`-Regexes (`/legacy/` - Laufzeit-Falle für künftige Imports) entfernt; `watch.usePolling` (unnötige CPU-Last auf macOS) entfernt.
- **Kosmetik**: `substr` → `slice`, doppelte `displayName`-Zuweisung, Log-Level-Tabelle als Modul-Konstante, `downloadEta` auf Modulebene, `mobile-web-app-capable`-Meta-Tag ergänzt, gespeicherte Sprache wird vor Anwendung validiert.

## [4.2.1] - 2026-10-09

### Intern (keine sichtbaren Änderungen)

- **Dark-Mode ohne Prop-Drilling**: `isDarkMode`/`darkMode` wird nicht mehr als Prop durch ChatWindow → MessageList → MarkdownRenderer gereicht. Sichtbare Unterschiede laufen jetzt durchgängig über Tailwind-`dark:`-Varianten, der neue `useDarkMode()`-Hook beobachtet die `dark`-Klasse auf `<html>` (per MutationObserver — deckt jetzt auch den Systemwechsel im „system"-Modus korrekt ab, was der alte React-State nicht tat). Memo-Vergleiche der Nachrichten sind dadurch schlanker.
- **ESLint v9 + Flat-Config**: Von ESLint 8.57 auf 9.39 migriert (`.eslintrc.json` → `eslint.config.js`), inklusive typescript-eslint v8, react-hooks v5 und typabhängigen Regeln (`projectService`). Die strengere Version fand 10 Stellen, die jetzt mit `??=`/Optional Chaining bzw. `catch {}` sauberer gelöst sind.

## [4.2.0] - 2026-10-09

### Neu

- **Sidebar entrümpelt**: Aus 13 Menüpunkten werden 4 primäre (Chat, Einstellungen) plus zwei einklappbare Gruppen — „Verwaltung" (Profile, Gedächtnis, Bibliothek, Modelle, Daten) und „Hilfe & Rechtliches" (Hilfe, Roadmap, Lexikon, Kontakt, Datenschutz, Impressum). Verwaltung ist standardmäßig aufgeklappt, Hilfe & Rechtliches zu.
- **Chat-Verlauf immer sichtbar**: Der Verlauf ist nicht mehr an den Chat-Tab gebunden, sondern permanent in der Sidebar und bekommt den gesamten Platz unter dem Menü (flexibel, scrollbar).
- **Ordner für Chats**: Neue Ordner-Struktur im Verlauf — Ordner anlegen (📁+), umbenennen, löschen (Chats bleiben erhalten und werden „ohne Ordner" angezeigt), einklappen, Chats per 📁-Button verschieben. Ordner liegen in localStorage, die Zuordnung am Chat in IndexedDB.
- **Backup-Format v1.3**: Ordner werden beim Komplett-Export mitgesichert und beim Import wiederhergestellt (abwärtskompatibel mit v1.0–v1.2).

## [4.1.0] - 2026-10-09

### Neu

- **Textgröße direkt im Chat**: Neuer Aa-Knopf neben der Suche - Popover mit den vier Stufen (Klein/Standard/Groß/Sehr groß), wirkt sofort, gleicher Speicherstand wie die Einstellungen.
- **Hoher Kontrast**: Schalter in Einstellungen → Barrierefreiheit; verstärkt Text- und Rahmenkontraste in hell und dunkel. `@media (prefers-contrast: more)` wendet dieselben Regeln automatisch an, `forced-colors` (Windows) bleibt funktionsfähig.
- **Lesbare Schrift**: Atkinson Hyperlegible als Option (selbst gehostet, 34 KB, kein Google-Request) - Schriftart speziell für Sehbeeinträchtigte.
- **Nachrichten-Tastaturnavigation**: J/K springt zwischen Nachrichten (mit sichtbarem Fokus-Ring und Scroll-Into-View), C kopiert die fokussierte Nachricht, `?` öffnet eine Shortcut-Übersicht direkt im Chat (auch per Button in der Kopfzeile erreichbar).
- **Vorlesen pro Nachricht**: 🔊-Button an jeder Nachricht - vorlesen, erneut klicken stoppt; Sprechgeschwindigkeit (0.5×-1.5×) einstellbar, gilt auch für das automatische Vorlesen. Sprachausgabe läuft jetzt über einen zentralen TTS-Service.
- **Touch-Trefferflächen 44px**: Auf Touch-Geräten (`pointer: coarse`) bekommen sichtbare Buttons eine unsichtbare 44×44px-Trefferfläche via Pseudo-Overlay - ohne optische Veränderung.

### Behoben

- **`lang`-Attribut bei Sprachwechsel** (WCAG 3.1.1, Level A): Beim Umschalten auf Englisch sprachen Screenreader die UI mit deutscher Aussprache-Engine - `document.documentElement.lang` wird jetzt synchronisiert.
- **Smooth-Scroll vs. Reduce-Motion**: `scrollIntoView({behavior:'smooth'})` ignorierte die „Animationen reduzieren"-Einstellung - jetzt wird auch der programmatische Scroll bei reduzierter Bewegung sofort ausgeführt.
- **Profil-Karten nicht tastaturbedienbar**: Die Karten waren nur per Maus klickbar - jetzt `role="button"`, Tab-fokussierbar, Enter/Leertaste wählt aus.
- **Bild-Vorschauen nicht tastaturbedienbar**: Vorschaubilder in Anhängen und Markdown-Antworten sind jetzt fokussierbar und per Enter zu öffnen.
- **Mobile Sidebar ohne Esc**: Das Overlay lässt sich jetzt auch per Escape schließen.

### Werkzeuge

- **eslint-plugin-jsx-a11y** in Lint und CI: statische A11y-Prüfung (alt-Texte, ARIA-Rollen, Tastatur-Handler) verhindert Regressionen.

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
