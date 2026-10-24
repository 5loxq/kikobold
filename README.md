# Local LLM Chat

**Version:** 4.3.41 | **Lizenz:** MIT | **Status:** Produktionsreif

Ein datenschutzfreundlicher LLM-Chat, der komplett im Browser läuft. Die Modelle
werden lokal heruntergeladen, im Browser gecacht und die Inferenz erfolgt
100 % auf dem eigenen Gerät — keine Nachricht verlässt den Browser, kein Server
verarbeitet irgendetwas.

Live-Demo: **https://kikobold.net**

---

## Funktionen

| Funktion | Beschreibung |
|---|---|
| **100 % lokal** | Inferenz im Browser (WebGPU oder WASM), keine Datenübertragung an Dritte |
| **6 kuratierte Modelle** | Klare Auswahl statt Modell-Wüste, mit Empfehlung und Zweck-Beschreibung + Bildgenerierung (LCM DreamShaper) |
| **Self-Hosting** | Modelle liegen auf dem eigenen Webspace, mit automatischem HuggingFace-Fallback |
| **Download-Anzeige** | Fortschritt in Prozent, Geladene/Gesamtgröße („340 MB von 600 MB") und Geschwindigkeit |
| **Light/Dark-Mode** | Umschalter in der Sidebar, folgt standardmäßig dem System, Auswahl wird gespeichert |
| **Barrierefreiheit** | Textgröße skalierbar (Klein bis Sehr groß, direkt im Chat per Aa-Knopf), hoher Kontrast, lesbare Schrift (Atkinson Hyperlegible), Lesbarkeits-Modus, Animationen abschaltbar, Nachrichten-Navigation per Tastatur (J/K/C), Vorlesen pro Nachricht, Screenreader-Ankündigungen, sichtbare Fokus-Ringe, Fokus-Fallen in Dialogen, WCAG-AA-Kontraste (Ziel: WCAG 2.1 AA) |
| **Streaming** | Antworten erscheinen Token für Token, abbrechbar |
| **Profile** | Standard / Kreativ / Präzise (deutsch) — der System-Prompt wird tatsächlich an das Modell übergeben |
| **Chats** | Verlauf in IndexedDB mit Ordnern, Suche im Chat, Export/Import als JSON |
| **Sprache** | Deutsch und Englisch, umschaltbar |
| **Offline** | Service Worker; nach dem Modell-Download funktioniert der Chat offline |
| **Anhänge** | Dokumente als Kontext; Spracheingabe per Mikrofon |

## Modelle

| Modell | Wofür | Größe | Engine |
|---|---|---|---|
| **LFM 2.5 1.6B** (empfohlen) | Allzweckmodell für Alltag, Wissen und Texte — Fragen, Zusammenfassungen, Übersetzungen. Mit Bildverstehen (Vision). Läuft in jedem Browser, auch ohne WebGPU | 664 MB | WASM (wllama) |
| **LFM 2.5 350M** | Schnellstes Modell, ideal für ältere Geräte und kurze Fragen | 210 MB | WASM (wllama) |
| **Qwen 3.5 2B** (empfohlen) | Stärkstes Modell: längere Texte, beste Qualität, denkmodus | 1 GB | WebGPU (WebLLM) |
| **Qwen 3 1.7B** | Mathe- und Logik-Spezialist mit sichtbarem Gedankengang | 939 MB | WebGPU (WebLLM) |
| **Qwen 3 0.6B** | Kurze Fragen, schnelle Antworten — ideal zum Ausprobieren | 335 MB | WebGPU (WebLLM) |
| **Gemma 4 E2B** | Kompaktes Allzweckmodell | — | WASM (wllama) |
| **LCM DreamShaper v7** | Bildgenerierung aus Textbeschreibungen | ~2 GB | ONNX |

- Beim ersten Auswählen wird gefragt, ob der Download starten soll (mit Größenangabe).
- Der Download läuft vom eigenen Webspace (siehe unten); ist dieser nicht erreichbar, wird automatisch der HuggingFace-CDN genutzt.
- Browser ohne WebGPU (Firefox, Safari) nutzen automatisch das WASM-Modell.
- Nach dem Download cacht der Browser die Modelle (OPFS bzw. Cache Storage) — der nächste Start ist sofort bereit.

## Setup (Entwicklung)

Voraussetzungen: Node.js ≥ 20, npm ≥ 9.

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ausprobieren
npm run type-check # TypeScript prüfen
npm run lint       # ESLint
```

Für WebGPU-Modelle: Chrome/Edge 126+ verwenden. Firefox und Safari fallen
automatisch auf das WASM-Modell zurück.

## Deployment (Webspace)

Die App ist ein statisches Frontend — der komplette Inhalt von `dist/` kommt
ins Web-Root (HTTPS ist Pflicht: WebGPU, OPFS und Cache Storage brauchen einen
Secure Context).

### Ein Befehl: `npm run deploy`

Baut die App und lädt `dist/` per SFTP auf den Webspace (Modelle ausgenommen,
`--ignore-time` spart Upload-Zeit). Das SFTP-Passwort liegt im macOS-Keychain
(Service `webgui-deploy`, Account `rrbitr_1`) — nie im Klartext im Projekt:

```bash
security add-generic-password -s webgui-deploy -a rrbitr_1 -w '<PASSWORT>'
```

### Sync-Workflow (Git + GitHub)

- `git push` läuft über das Personal Access Token. **Achtung:** das Token hat
  keinen `workflow`-Scope — Commits, die `.github/workflows/` ändern, werden
  von GitHub abgelehnt.
- Workflow-Dateien deshalb über die GitHub-App (Connector) pushen
  (`push_files`), danach lokal `git pull`.
- Nach jedem Push läuft die CI-Pipeline (type-check, lint, build,
  i18n-Paritäts-Check). Dependabot öffnet wöchentliche Update-PRs
  (`.github/dependabot.yml`).
- Das Repository hat Git-LFS-Hooks, aber kein installiertes `git-lfs` —
  `git push` braucht deshalb `--no-verify`, oder einmalig
  `brew install git-lfs`.

### Struktur auf dem Server

```
/                       # App (index.html, assets/, sw.js, wllama/, .htaccess)
/models/                # Self-gehostete Modell-Dateien (optional)
├── LFM2.5-VL-1.6B-Q4_0.gguf
├── Qwen3.5-2B-q4f16_1-MLC/
├── Qwen3-1.7B-q4f16_1-MLC/
└── Qwen3-0.6B-q4f16_1-MLC/
```

### Modelle selbst hosten

1. Dateien von HuggingFace laden:
   - `LiquidAI/LFM2.5-VL-1.6B-GGUF` → nur `LFM2.5-VL-1.6B-Q4_0.gguf`
   - `mlc-ai/Qwen3.5-2B-q4f16_1-MLC`, `mlc-ai/Qwen3-1.7B-q4f16_1-MLC`,
     `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` → komplette Repos
2. Unter `/models/` ablegen (Struktur siehe oben).
3. Die Pfade sind in `src/services/models/model-registry.ts` hinterlegt
   (`selfHostedPath`). Fehlt eine Datei, greift automatisch der HF-Fallback.

Der Server muss Range-Requests unterstützen (für abbrechbare/fortsetzbare
Downloads) — die mitgelieferte `.htaccess` setzt zusätzlich die nötigen Header
(COOP/COEP für Multi-Threading, korrekter WASM-MIME-Type, SPA-Fallback).

### Wichtig nach jedem Deploy

Der Service Worker aktualisiert sich selbstständig (Navigation ist
Network-First). Falls trotzdem eine alte Version hängt:
DevTools → Application → Service Workers → *Unregister*, dann neu laden.

## Architektur

```
src/
├── components/
│   ├── Chat/          # ChatWindow, MessageList, InputBox, Markdown, Export
│   ├── Layout/        # MainLayout, Sidebar (inkl. Theme-Toggle), LanguageSwitcher
│   ├── Profiles/      # Profil-Verwaltung
│   └── Help/          # Hilfe
├── hooks/
│   ├── useEnhancedInference.ts   # Modell-Laden + Generierung (beide Engines)
│   ├── useChat.ts                # Chat-Verlauf (IndexedDB)
│   ├── useModels.ts              # Modell-Auswahl/-Registry-Zustand
│   └── useProfiles.ts            # Profile
├── services/
│   ├── inference/wllama-engine.ts       # GGUF/WASM-Engine (llama.cpp)
│   ├── models/model-registry.ts         # Kuratierte Modell-Liste + Pfade
│   └── storage/                          # Chat (IndexedDB), Profile (localStorage)
└── locales/           # de.json, en.json
```

**Zwei Engines:**
- **WebLLM** (`@mlc-ai/web-llm`): MLC-Modelle über WebGPU — schnell, braucht moderne Browser
- **wllama** (`@wllama/wllama`): GGUF über WASM/llama.cpp — läuft überall, CPU-basiert

Beide Engines bekommen den System-Prompt des Profils, die letzten 10 Nachrichten
als Verlauf und die Sampling-Parameter (Temperatur, Top-P, Max Tokens) des
aktiven Profils.

## Datenschutz

- Keine Telemetrie, kein Analytics, kein Account
- Inferenz ausschließlich lokal im Browser
- Chat-Verlauf: IndexedDB (lokal), Profile: localStorage (lokal)
- Export/Import liegt komplett beim Nutzer

## Changelog

Die vollständige Versionshistorie steht in [CHANGELOG.md](CHANGELOG.md). Die wichtigsten Etappen:

### 4.3.41 (2026-10-24)
- UX-Runde: Empfehlungs-Button auch im leeren Chat, Profil-Auswahl erst nach Modell-Load editierbar, Update-Toast bei neuer Version, Retry-Button bei fehlgeschlagenem Modell-Download, WebGPU-Speed-Hinweis für Firefox/Safari
- E2E-Smoke-Test (`e2e/`) + GitHub-Actions-Workflow gegen die Live-Site (manuell; Tages-Cron bis 01.11. pausiert)
- Open-Source-Vorbereitung: MIT-LICENSE, Attribution im README, deploy.sh parametrisiert

### 4.3.36 – 4.3.40 (2026-10-11)
- **iOS-Support geklärt:** Klare Warnung statt Endlos-Spinner (WebKit fehlen MEMORY64/JSPI); Deadlock in der Modell-Vorbereitung behoben (Single-Thread ohne JSPI, selbst gehosteter wllama-Compat-Build)
- **Mobile robust:** Fortsetzbarer Modell-Download (HTTP-Range-Resume), Cache-Validierung vor dem Start, Screen-Wake-Lock, kleineres LFM-2.5-350M-Modell für Handys, scrollbarer Mobile-Drawer

### 4.2.x – 4.3.35 (2026-10-09 bis 10-11)
- SEO-Grundlagen (robots, sitemap, JSON-LD, FAQ-Seite), og:image-Banner, www→apex-Redirect
- Empfehlungs-Button „Modell für mein Gerät empfehlen“ (WebGPU + RAM-Erkennung)
- self-hosted Modelle mit HuggingFace-Fallback

### 4.0.0 (2026-10-09)
- Barrierefreiheit nach WCAG 2.1 AA: Textgröße, Kontraste, Screenreader-Live-Regions, Fokus-Fallen, Tastaturbedienung

### 3.4.0 (2026-10-08)
- Offline-Banner, Engine-Anzeige (WebGPU/WASM), Vitest-Testsuite, Service-Worker-Versionierung

### 2.0.0
- Komplettes UI-Redesign: Light/Dark-Mode, Glas-Header, zentrierte Chat-Spalte
- Kuratierte Modelle mit Zweck-Beschreibungen, Download-Anzeige mit Geschwindigkeit, deutsche Profile

### 1.x
- Basis-App mit WebLLM + wllama, Profilen, Chats, Export, Offline-Support

## Mitwirken

```bash
npm run lint && npm run type-check && npm run build
```

Muss alles grün sein vor dem Commit.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

Entwickelt von **5loxq** mit Unterstützung von KI-Agenten (Mistral Vibe, GLM).
