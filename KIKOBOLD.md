# KI Kobold — Technische Dokumentation

Zusammenfassung der Architektur-Entscheidungen und technischen Grundlagen von
**KI Kobold** (https://kikobold.net). Diese Datei fasst die früheren
Arbeits- und Analyse-Dokumente inhaltlich zusammen; die Nutzer- und
Feature-Sicht steht in `README.md`, die Versionshistorie in `CHANGELOG.md`.

---

## 1. Ziel und Prinzip

KI Kobold ist ein datenschutzfreundlicher LLM-Chat, der komplett im Browser
läuft: Modelle werden lokal heruntergeladen, im Browser gecacht, die Inferenz
erfolgt 100 % auf dem eigenen Gerät. Keine Nachricht verlässt den Browser,
es gibt kein Backend, keine Telemetrie, keinen Account.

## 2. Architektur: zwei Inference-Engines

| Engine | Paket | Formate | Läuft auf | Rolle |
|---|---|---|---|---|
| **WebLLM** | `@mlc-ai/web-llm` | MLC-Modelle (Shards) | Browser mit WebGPU (Chrome/Edge 126+) | Schnellste Variante, GPU-basiert |
| **wllama** | `@wllama/wllama` | GGUF (llama.cpp) | Alle modernen Browser (WASM) | Universeller Fallback, CPU-basiert |

- Browser ohne WebGPU (Firefox, Safari) nutzen automatisch das WASM-Modell.
- **Bild-Engine (Alpha):** `@aislamov/diffusers.js` mit ONNX-Runtime (WebGPU)
  — LCM DreamShaper v7, läuft ebenfalls lokal im Browser (eigenes
  ORT-WASM-Setup, siehe `scripts/copy-ort-wasm.mjs`).
- In Browsern ohne JSPI (z. B. Firefox) läuft die WASM-Engine deutlich langsamer;
  die App zeigt dafür einen Hinweis und empfiehlt Chrome/Edge. Das ist eine
  Browser-Beschränkung, kein Fehler der App.
- Beide Engines erhalten den System-Prompt des Profils, die letzten
  Nachrichten als Verlauf und die Sampling-Parameter (Temperatur, Top-P,
  Max Tokens) des aktiven Profils.

### Historie

Früher lief die Inferenz über `@xenova/transformers`, was für den Browser
ungeeignet war: Ladezeiten von 5–10 Minuten oder Absturz, 0–5 Tokens/s. Der
Umstieg auf WebLLM brachte Ladezeiten von 10–30 Sekunden und 10–30 Tokens/s
(WebGPU). Der Zusatzbau mit wllama machte die App auf allen Browsern nutzbar.

## 3. Modell-Caching im Browser

WebLLM unterstützt verschiedene Cache-Backends:

```typescript
const appConfig = {
  ...prebuiltAppConfig,
  cacheBackend: 'opfs' // Origin Private File System (empfohlen)
};
```

| Backend | Beschreibung | Vorteile | Nachteile |
|---|---|---|---|
| `'cache'` | Browser Cache API | Einfach | Begrenzter Speicher |
| `'indexeddb'` | IndexedDB | Persistent | Langsam |
| `'opfs'` | Origin Private File System | Empfohlen, schnell und persistent | Nur moderne Browser |
| `'cross-origin'` | Cross-Origin Storage | Experimentell | Benötigt Extension |

Beide Engines cachen die Modelle selbst im OPFS-Speicher. Dadurch ist die
App nach dem erstmaligen Download offline nutzbar (Service Worker liefert die
App-Shell aus).

## 4. Modell-Download

- **Fortschritt**: Prozent, geladene/gesamte Größe, Geschwindigkeit, Restzeit
  (ETA). Der Parser versteht beide Fortschrittsformate von WebLLM (alt und neu).
- **Verifizierung**: Wird die eigene Modelldatei nicht korrekt ausgeliefert
  (z. B. Fehlerseite statt Datei), fällt der Ladevorgang automatisch auf den
  HuggingFace-CDN zurück, statt fälschlich Erfolg zu melden.
- **Fortsetzbar**: Range-Requests erlauben abbrechbare/fortsetzbare Downloads;
  der Server muss Range-Requests unterstützen.
- **Robust**: Wiederholungslogik mit exponentiellem Backoff, parallele
  Downloads mit konfigurierbarem Limit, Warteschlange.
- **Am Service Worker vorbei**: Modell-Downloads (.gguf, .bin-Shards) laufen
  direkt am Service Worker vorbei — sonst würde der SW die komplette Datei
  puffern und der Fortschritt bliebe bei 0 %.

## 5. Self-Hosting der Modelle

Struktur auf dem Webspace:

```
/                       # App (index.html, assets/, sw.js, wllama/, .htaccess)
/models/
├── LFM2.5-VL-1.6B-Q4_0.gguf
├── LFM2.5-350M-Q4_0.gguf
├── Qwen3.5-2B-q4f16_1-MLC/
├── Qwen3-1.7B-q4f16_1-MLC/
└── Qwen3-0.6B-q4f16_1-MLC/
```

- Pfade stehen in `src/services/models/model-registry.ts` (`selfHostedPath`).
- Fehlt eine Datei, greift automatisch der HuggingFace-Fallback.
- Die `.htaccess` setzt die nötigen Header: Range-Requests, COOP/COEP für
  Multi-Threading, korrekter WASM-MIME-Type, SPA-Fallback; `sw.js` wird mit
  `no-cache` ausgeliefert, damit Updates sofort greifen.

## 6. Offline / Service Worker

- Navigation ist Network-First, statische Assets Cache-First — deshalb
  aktualisiert sich die App selbstständig.
- Falls eine alte Version hängt: DevTools → Application → Service Workers →
  *Unregister*, dann neu laden.
- Modell-Downloads laufen bewusst nicht über den Service Worker (siehe 4).

## 7. Sicherheit

- **HTTPS ist Pflicht** (WebGPU, OPFS und Cache Storage brauchen einen
  Secure Context; WASM ebenfalls).
- HTTPS-Validierung und Whitelist vertrauenswürdiger Domains für
  Modell-Downloads.
- Strukturvalidierung und Bereinigung beim Speichern (Chats, Import, Bibliothek);
  XSS-Schutz über Sanitizer.
- Sichere Wrapper für localStorage/sessionStorage mit Validierung.
- **Markdown-Renderer (Chat-Antworten):**
  - Code-Blöcke über `Highlight` (prism-react-renderer v2) mit Render-Prop —
    **niemals** `Prism` als Komponente casten (Namespace-Objekt, crasht zur
    Laufzeit; war Ursache des P0-Crash in 4.3.41).
  - Bilder nur `data:image/`, `blob:` und same-origin (`isSafeImageUrl`);
    fremde `https:`-Bilder wären Tracking-Pixel bei Selfhosting ohne CSP.
  - Links: `isSafeUrl` erlaubt `http(s):`, `mailto:`, Pfad- und Anker-URLs —
    protocol-relative `//host` ist explizit ausgeschlossen.
- **CSP-Hinweis:** `script-src 'unsafe-eval'` ist bewusst nötig — onnxruntime-web
  (Text- UND Bild-Engine) ruft `eval()` direkt auf. Nicht entfernen, siehe
  Kommentar in `public/.htaccess`.
- **Soft-404-Konvention:** Der SPA-Fallback greift nur für endungslose Pfade;
  Pfade mit Dateiendung müssen 404 liefern (`.htaccess` + `404.html`). Neue
  statische Dateien mit Endung landen in `public/` und sind damit ausgeschlossen.
- **`protobufjs` Override:** `^7.4.0` in `package.json` (transitiv via
  onnx-proto/onnxruntime-web; 6.x hat offene OSV-Advisories). Bei
  onnxruntime-Updates prüfen, ob der Override noch nötig/kompatibel ist.

## 8. Fehlerbehebung

| Fehler | Ursache | Lösung |
|---|---|---|
| „WebGPU not supported" | Browser ohne WebGPU | Chrome/Edge verwenden; automatisch fällt die App auf das WASM-Modell zurück |
| „Out of memory" | Modell zu groß für den Browser | Kleineres Modell wählen, Tab neu öffnen, Gerät mit mehr RAM |
| „Model not found" | Falsche Modell-ID oder URL | Modell-ID in `model-registry.ts` prüfen; bei Self-Hosting URL prüfen |
| „Failed to load WASM" | HTTPS/CORS-Problem | HTTPS verwenden, CORS-Header prüfen, Browser-Cache leeren |
| „Network error" | Download schlägt fehl | Verbindung/Firewall prüfen; HF-Fallback greift automatisch |
| „request exceeds the available context size" | Kontext zu klein | Kontext des WASM-Modells: 2048 Tokens auf Mobilgeräten, 4096 auf Desktop; Anhänge werden gekürzt, alte Verlaufsnachrichten entfallen zuerst |

Debugging: `setLogLevel("debug")` aus `@mlc-ai/web-llm` aktiviert Engine-Logs;
im Network-Tab nach `wasm`/`model` filtern, um Modell-Downloads zu prüfen.

## 9. Performance-Erwartungen

| Metrik | WebGPU (WebLLM) | WASM (wllama) |
|---|---|---|
| Ladezeit (erster Download) | abhängig von Leitung | abhängig von Leitung |
| Start aus Cache | wenige Sekunden | wenige Sekunden |
| Antwortgeschwindigkeit | 10–30 Tokens/s | deutlich langsamer, browserabhängig (JSPI) |
| Offline nach erstem Laden | ja | ja |

## 10. Entwicklung und Deployment

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173)
npm run build      # Produktions-Build nach dist/
npm run type-check # TypeScript prüfen
npm run lint       # ESLint
```

Vor jedem Commit müssen `npm run lint && npm run type-check && npm run build`
grün sein. Deployment: komplettes `dist/` ins Web-Root synchronisieren
(HTTPS erforderlich, siehe 7).

---

*Zentrale Dokumente: `README.md` (Nutzer- und Feature-Sicht),
`CHANGELOG.md` (Versionshistorie).*
