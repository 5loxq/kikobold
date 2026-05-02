# Local LLM Chat - WebGPU Browser Application

**Version:** `1.0.0` | **Status:** Production-Ready | **License:** MIT

A privacy-first web application that allows you to download and run language models locally in your browser using WebGPU for GPU acceleration. All processing happens 100% locally — no data is sent to any server.

---

## 📌 Quick Links

- **[Features](#-features)** — Full feature list
- **[Installation](#-installation)** — Setup & development
- **[Usage](#-usage)** — How to use the app
- **[API Reference](#-api-reference)** — For developers
- **[Project Structure](#-project-structure)** — Code organization
- **[Versioning](#-versioning)** — Release policy
- **[Contributing](#-contributing)** — How to contribute

---

## ✨ Features

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **WebGPU Acceleration** | GPU-accelerated inference for faster responses | ✅ |
| **Local Inference** | All models run 100% in-browser | ✅ |
| **Voice Input/Output** | Speech recognition & text-to-speech (German) | ✅ |
| **Model Management** | Download, manage, and switch between 5+ models | ✅ |
| **Profile System** | Custom system prompts and inference parameters | ✅ |

### Supported Models

| Model | Size | Recommended | Context Length |
|-------|------|-------------|----------------|
| TinyLLaMA 1.1B | ~2.5GB | ✅ Beginner | 2048 |
| Phi-2 2.7B | ~5GB | ✅ Balanced | 2048 |
| Neural Chat 7B | ~10GB | ⚠️ Advanced | 4096 |
| Mistral 7B Instruct | ~10GB | ⚠️ Advanced | 4096 |
| LLaMA 2 7B Chat | ~10GB | ⚠️ Advanced | 4096 |
| Qwen1.5 0.5B | ~1GB | ✅ Lightweight | 2048 |
| Qwen1.5 1.8B | ~3.5GB | ✅ Balanced | 2048 |
| GPT-2 | ~500MB | ✅ Testing | 1024 |
| DistilGPT2 | ~250MB | ✅ Testing | 1024 |

### Privacy & Security

✅ **100% Local** — No data sent to external servers  
✅ **No Telemetry** — Zero tracking or analytics  
✅ **No Account Required** — Works offline after model download  
✅ **IndexedDB Storage** — Chat history persists across sessions  
✅ **WebGPU Fallback** — Automatic CPU fallback if GPU unavailable  

---

## 🚀 Installation

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **Modern Browser** with WebGPU support (Chrome 126+, Edge 126+)
- **Storage** ≥ 4GB free for models

### Setup

```bash
# Clone the repository
git clone https://github.com/5loxq/webgui.git
cd webgui

# Install dependencies
npm install

# Start development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Optional: Custom port for dev server
VITE_PORT=3000

# Optional: Disable WebGPU (for testing CPU fallback)
VITE_DISABLE_WEBGPU=false

# Optional: Custom model registry URL
VITE_MODEL_REGISTRY_URL=https://huggingface.co
```

---

## 🎯 Usage

### 1. Download a Model

```
→ Navigate to "Models" tab
→ Select a model from the list
→ Click "Download"
→ Wait for download to complete (progress shown)
```

**Note:** Models are loaded from HuggingFace CDN and cached in your browser.

### 2. Create/Select a Profile

```
→ Navigate to "Profiles" tab
→ Click "New Profile" or select existing
→ Customize:
  - Name: Profile identifier
  - System Prompt: Define AI behavior
  - Temperature: 0.1-2.0 (creativity)
  - Top-P: 0.1-1.0 (sampling diversity)
  - Max Tokens: 1-512 (response length)
  - Language: de/en (for voice output)
```

### 3. Start Chatting

```
→ Navigate to "Chat" tab
→ Select a downloaded model
→ Select a profile
→ Click "New Chat"
→ Type message or use 🎤 for voice input
→ Press Enter or click Send
```

**Voice Features:**
- 🎤 **Input:** Click microphone to start speech recognition (German)
- 🔊 **Output:** Responses are automatically read aloud (German)

### 4. Manage Data

```
# Export Profile
→ Profiles tab → Select profile → Click "Export"

# Import Profile
→ Profiles tab → Click "Import" → Select JSON file

# Delete Chat
→ Chat tab → Hover chat → Click 🗑️

# Clear Storage
→ Settings tab → "Clear All Data"
```

---

## 🔧 API Reference

### Inference Engine

**Location:** `src/services/inference/InferenceEngine.ts`

#### Methods

```typescript
// Check WebGPU support
function checkWebGPUSupport(): boolean;

// Load a model
function loadModel(modelId: string): Promise<void>;

// Unload current model
function unloadModel(): Promise<void>;

// Generate text
function generate(
  prompt: string,
  options: InferenceOptions
): Promise<InferenceResult>;

// Get loaded model info
function getCurrentModel(): { id: string; name: string } | null;
```

#### Types

```typescript
interface InferenceOptions {
  temperature: number;    // 0.1-2.0
  topP: number;           // 0.1-1.0
  maxTokens: number;      // 1-512
  systemPrompt?: string;  // Optional
  language?: string;      // 'de' | 'en'
}

interface InferenceResult {
  text: string;          // Generated text
  tokens: number;        // Tokens generated
  duration: number;      // Time in ms
}
```

### Storage Services

**Location:** `src/services/storage/`

#### Chat Storage

```typescript
// Save chat
function saveChat(chat: Chat): Promise<void>;

// Load all chats
function loadAllChats(): Promise<Chat[]>;

// Delete chat
function deleteChat(chatId: string): Promise<void>;

// Export chat
function exportChat(chat: Chat): string; // JSON

// Import chat
function importChat(json: string): Chat;
```

#### Profile Storage

```typescript
// Save profile
function saveProfile(profile: Profile): Promise<void>;

// Load all profiles
function loadAllProfiles(): Promise<Profile[]>;

// Delete profile
function deleteProfile(profileId: string): Promise<void>;

// Export profile
function exportProfile(profile: Profile): string; // JSON

// Import profile
function importProfile(json: string): Profile;
```

#### Model Storage

```typescript
// Save model metadata
function saveModel(model: LocalModel): Promise<void>;

// Load all local models
function loadAllModels(): Promise<LocalModel[]>;

// Delete model
function deleteModel(modelId: string): Promise<void>;
```

### Hooks

**Location:** `src/hooks/`

#### useInference

```typescript
const {
  isLoading,
  error,
  generate,
  currentModel,
  webgpuAvailable,
} = useInference();
```

#### useModels

```typescript
const {
  models,
  localModels,
  downloadModel,
  deleteModel,
  isDownloading,
} = useModels();
```

#### useChat

```typescript
const {
  chats,
  currentChat,
  sendMessage,
  newChat,
  deleteChat,
  exportChat,
  importChat,
} = useChat();
```

#### useProfiles

```typescript
const {
  profiles,
  currentProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  exportProfile,
  importProfile,
} = useProfiles();
```

---

## 📁 Project Structure

```
webgui/
├── public/                    # Static assets
│   └── models/               # Pre-downloaded models (optional)
├── src/
│   ├── components/           # React components
│   │   ├── Chat/             # Chat interface (ChatWindow, InputBox)
│   │   ├── Models/           # Model management (ModelList, ModelCard)
│   │   ├── Profiles/         # Profile management (ProfileEditor, ProfileManager)
│   │   └── Layout/           # Main layout (MainLayout, Sidebar)
│   ├── hooks/                # Custom React hooks
│   │   ├── useChat.ts        # Chat state management
│   │   ├── useInference.ts   # Inference state
│   │   ├── useModels.ts      # Model management
│   │   └── useProfiles.ts    # Profile management
│   ├── services/             # Business logic
│   │   ├── inference/        # Inference engine
│   │   │   └── InferenceEngine.ts
│   │   ├── storage/          # Data persistence
│   │   │   ├── ChatStorage.ts
│   │   │   ├── ModelStorage.ts
│   │   │   └── ProfileStorage.ts
│   │   ├── models/           # Model registry
│   │   │   └── modelRegistry.ts
│   │   ├── security.ts       # WebGPU detection
│   │   └── logging.ts        # Logging utilities
│   ├── types/                # TypeScript definitions
│   │   └── index.ts          # All type interfaces
│   ├── config/               # Configuration
│   │   └── i18n.ts           # Internationalization
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point
├── scripts/                  # Utility scripts
│   └── download-models.js    # Model download helper
├── .env                      # Environment variables
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── tailwind.config.js        # Tailwind CSS config
└── vite.config.ts            # Vite config
```

---

## 📦 Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Frontend** | React | 18.2.0 |
| **Language** | TypeScript | 5.3.3 |
| **Bundler** | Vite | 5.1.4 |
| **Styling** | Tailwind CSS | 3.4.1 |
| **Inference** | Transformers.js | 2.17.0 |
| **WebGPU** | @mlc-ai/web-llm | 0.2.81 |
| **Storage** | IndexedDB | Native |
| **i18n** | i18next | 23.11.2 |
| **Linting** | ESLint | 8.57.0 |

## 🔒 Security Features

This application implements comprehensive security measures:

### ✅ Input Sanitization
- All user inputs are sanitized to prevent XSS attacks
- HTML tags and script content are removed from inputs
- Dangerous patterns (javascript:, on* events, etc.) are blocked

### ✅ URL Validation
- Strict URL validation with SSRF prevention
- Blocked internal IP addresses and localhost (unless explicitly allowed)
- Trusted domain whitelist for model loading
- Suspicious query parameters are rejected

### ✅ File Upload Security
- File type and extension validation
- Maximum file size limits
- Dangerous file extensions blocked (.js, .exe, .php, etc.)
- JSON content validation for imports
- Suspicious content patterns detected

### ✅ WebGPU Security
- COOP/COEP headers configured
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin

### ✅ Model Loading Security
- Model paths validated against trusted sources
- Only HuggingFace and local paths allowed
- Suspicious model configurations rejected

### ✅ Storage Security
- Secure localStorage operations with validation
- IndexedDB error handling
- Data sanitization before storage

---

## 🎯 Browser Compatibility

| Browser | WebGPU | Voice Input | Voice Output | Full Support |
|---------|--------|-------------|--------------|--------------|
| Chrome 126+ | ✅ | ✅ | ✅ | ✅ |
| Edge 126+ | ✅ | ✅ | ✅ | ✅ |
| Firefox | ⚠️ Experimental | ⚠️ | ✅ | ⚠️ Partial |
| Safari | ❌ | ❌ | ✅ | ❌ |

**Notes:**
- WebGPU requires Chrome/Edge 126+ for full support
- Voice recognition requires HTTPS or localhost
- Models >7B may require 8GB+ RAM

---

## ⚡ Performance

### Benchmarks (RTX 3080, Chrome 126)

| Model | Load Time | First Token | Full Response (50 tokens) |
|-------|-----------|-------------|---------------------------|
| TinyLLaMA 1.1B | ~2s | ~200ms | ~800ms |
| Phi-2 2.7B | ~5s | ~300ms | ~1.2s |
| Qwen1.5 0.5B | ~1.5s | ~150ms | ~600ms |
| Qwen1.5 1.8B | ~4s | ~250ms | ~1s |
| Neural Chat 7B | ~8s | ~600ms | ~3s |
| Mistral 7B | ~9s | ~700ms | ~3.5s |

**Without WebGPU:** Responses are ~5-10x slower (CPU fallback).

### Optimization Tips

1. **Use smaller models** for faster inference
2. **Close other applications** to free up memory
3. **Reduce `maxTokens`** for shorter responses
4. **Lower `temperature`** for more deterministic output
5. **Use quantized models** when available

---

## 🔍 Troubleshooting

### Common Issues

#### Model Loading Fails

```
❌ Error: "Failed to load model"
✅ Solution:
1. Check browser console for detailed error
2. Ensure you have enough storage (Settings tab)
3. Clear browser cache and retry
4. Try a smaller model
```

#### WebGPU Not Available

```
⚠️ Warning: "WebGPU not supported, falling back to CPU"
✅ Solution:
1. Update your browser to latest version
2. Enable WebGPU in browser flags:
   - Chrome: chrome://flags/#enable-experimental-web-platform-features
   - Edge: edge://flags/#enable-experimental-web-platform-features
3. Use Chrome/Edge 126+ for best support
```

#### Out of Memory

```
❌ Error: "Out of memory"
✅ Solution:
1. Unload unused models (Models tab)
2. Use a smaller model
3. Reduce `maxTokens` in profile
4. Close other browser tabs
5. Restart browser
```

#### Voice Recognition Not Working

```
❌ Error: "Speech recognition not available"
✅ Solution:
1. Ensure you're using HTTPS or localhost
2. Check browser permissions for microphone
3. Try refreshing the page
4. Use Chrome/Edge for best compatibility
```

#### Slow Inference

```
⚠️ Warning: "Inference is slow"
✅ Solution:
1. Check if WebGPU is enabled (console logs)
2. Use a smaller model
3. Reduce `maxTokens`
4. Close other applications
5. Check for browser extensions interfering
```

---

## 📝 Versioning

This project follows **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):

- **MAJOR**: Breaking changes, major feature additions
- **MINOR**: Backwards-compatible new features
- **PATCH**: Backwards-compatible bug fixes

### Release History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-02-22 | Initial production release. All 3 options implemented: WebGPU acceleration, model management, voice I/O. |

### Version Check

```bash
# Check current version
cat package.json | grep version

# Or in code
import packageJson from '../package.json';
console.log(packageJson.version);
```

---

## 🤝 Contributing

### How to Contribute

1. **Fork** the repository
2. **Clone** your fork
3. **Create** a feature branch (`git checkout -b feature/your-feature`)
4. **Commit** your changes (`git commit -m 'Add some feature'`)
5. **Push** to the branch (`git push origin feature/your-feature`)
6. **Open** a Pull Request

### Development Guidelines

- **Code Style:** Follow existing patterns (TypeScript, React hooks)
- **Testing:** Ensure TypeScript compilation passes (`npm run build`)
- **Commits:** Use clear, descriptive messages
- **Documentation:** Update README.md for new features

### Pull Request Template

```markdown
## Description

[Describe your changes]

## Related Issue

[Link to issue if applicable]

## Changes Made

- [ ] Feature addition
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring

## Testing

- [ ] TypeScript compilation passes
- [ ] App runs without errors
- [ ] New features tested manually

## Screenshots (if applicable)

[Add screenshots here]
```

---

## 📜 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Transformers.js** — [Xenova/transformers.js](https://github.com/xenova/transformers.js) — ONNX model inference in browser
- **MLC Web LLM** — [mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) — WebGPU-accelerated LLM inference
- **HuggingFace** — [huggingface.co](https://huggingface.co) — Model hosting and CDN
- **React** — [react.dev](https://react.dev) — UI framework
- **Tailwind CSS** — [tailwindcss.com](https://tailwindcss.com) — Styling
- **Vite** — [vitejs.dev](https://vitejs.dev) — Build tool

---

## 🆘 Support

For issues, questions, or suggestions:

1. **Check** the [Troubleshooting](#🔍-troubleshooting) section
2. **Search** existing issues on GitHub
3. **Open** a new issue with:
   - Browser version
   - Operating system
   - Steps to reproduce
   - Screenshots (if applicable)
   - Browser console logs

---

## 📊 Telemetry

**None.** This application collects **zero** telemetry, analytics, or user data. Everything runs 100% locally in your browser.

---

*Made with ❤️ for privacy and local AI*
