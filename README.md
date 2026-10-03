# Local LLM Chat

**Version:** 2.0.0 | **Lizenz:** MIT | **Status:** Produktionsreif

Ein datenschutzfreundlicher LLM-Chat, der komplett im Browser läuft. Die Modelle
werden lokal heruntergeladen, im Browser gecacht und die Inferenz erfolgt
100 % auf dem eigenen Gerät — keine Nachricht verlässt den Browser, kein Server
verarbeitet irgendetwas.

Live-Demo: **https://www.posthiel.de**

---

## Funktionen

| Funktion | Beschreibung |
|---|---|
| **100 % lokal** | Inferenz im Browser (WebGPU oder WASM), keine Datenübertragung an Dritte |
| **3 kuratierte Modelle** | Klare Auswahl statt Modell-Wüste, mit Empfehlung und Zweck-Beschreibung |
| **Self-Hosting** | Modelle liegen auf dem eigenen Webspace, mit automatischem HuggingFace-Fallback |
| **Download-Anzeige** | Fortschritt in Prozent, Geladene/Gesamtgröße („340 MB von 600 MB") und Geschwindigkeit |
| **Light/Dark-Mode** | Umschalter in der Sidebar, folgt standardmäßig dem System, Auswahl wird gespeichert |
| **Streaming** | Antworten erscheinen Token für Token, abbrechbar |
| **Profile** | Standard / Kreativ / Präzise (deutsch) — der System-Prompt wird tatsächlich an das Modell übergeben |
| **Chats** | Verlauf in IndexedDB, Suche im Chat, Export/Import als JSON |
| **Sprache** | Deutsch und Englisch, umschaltbar |
| **Offline** | Service Worker; nach dem Modell-Download funktioniert der Chat offline |
| **Anhänge** | Dokumente als Kontext; Spracheingabe per Mikrofon |

## Modelle

| Modell | Wofür | Größe | Engine |
|---|---|---|---|
| **LFM 2.5 1.6B** (empfohlen) | Allzweckmodell für Alltag, Wissen und Texte — Fragen, Zusammenfassungen, Übersetzungen. Läuft in jedem Browser, auch ohne WebGPU | 664 MB | WASM (wllama) |
| **Gemma 2 2B** | Anspruchsvollere Aufgaben: längere Texte, bessere Erklärungen, solidere Qualität beim Schreiben | 1,4 GB | WebGPU (WebLLM) |
| **Qwen 2 0.5B** | Kurze Fragen und schnelle Antworten — ideal zum Ausprobieren und auf älteren Geräten | 400 MB | WebGPU (WebLLM) |

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

### Struktur auf dem Server

```
/                       # App (index.html, assets/, sw.js, wllama/, .htaccess)
/models/                # Self-gehostete Modell-Dateien (optional)
├── LFM2.5-VL-1.6B-Q4_0.gguf
├── Qwen2-0.5B-Instruct-q4f16_1-MLC/
└── gemma-2-2b-it-q4f16_1-MLC/
```

### Modelle selbst hosten

1. Dateien von HuggingFace laden:
   - `LiquidAI/LFM2.5-VL-1.6B-GGUF` → nur `LFM2.5-VL-1.6B-Q4_0.gguf`
   - `mlc-ai/Qwen2-0.5B-Instruct-q4f16_1-MLC` → komplettes Repo
   - `mlc-ai/gemma-2-2b-it-q4f16_1-MLC` → komplettes Repo
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

### 2.0.0
- Komplettes UI-Redesign: Light/Dark-Mode mit Umschalter (persistiert, folgt sonst dem System), Glas-Header, zentrierte Chat-Spalte, moderne Eingabe-Kapsel
- 3 kuratierte Modelle (LFM 2.5 1.6B, Gemma 2 2B, Qwen 2 0.5B) mit Zweck-Beschreibungen statt Modell-Wüste
- Self-Hosting der Modelle auf dem eigenen Webspace inkl. HuggingFace-Fallback
- Download-Anzeige mit Größe („340 MB von 600 MB") und Geschwindigkeit
- Bestätigungsdialog vor dem ersten Modell-Download (mit Größenangabe)
- Deutsche Standard-Profile (Standard/Kreativ/Präzise); System-Prompts werden jetzt tatsächlich an die Modelle übergeben
- Behoben: Nachrichten verschwanden nach der Antwort (Stale-Closure in useChat)
- Behoben: unlesbare Antworten im Dark-Mode (weiße Blase + heller Text)
- Behoben: weiße Seite nach Deploys (Service Worker cached jetzt Network-First und nie HTML als Asset)
- Behoben: falsche WebLLM-Modell-ID für Gemma (Case-Sensitive)
- Entfernt: Fake-Download-Seite „Modelle" (Auswahl läuft über das Chat-Dropdown, Verwaltung in den Einstellungen)

### 1.x
- Basis-App mit WebLLM + wllama, Profilen, Chats, Export, Offline-Support

## Mitwirken

```bash
npm run lint && npm run type-check && npm run build
```

Muss alles grün sein vor dem Commit.

## Lizenz

MIT
