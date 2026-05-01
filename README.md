# Local LLM Chat - WebGPU Browser Application

A privacy-first web application that allows you to download and run language models locally in your browser using WebGPU for GPU acceleration.

## Features

✨ **Privacy-First**: All processing happens locally in your browser. No data is sent to any server.

🚀 **GPU Acceleration**: Uses WebGPU for efficient inference on your graphics card.

📦 **Multiple Models**: Support for various models including:
- TinyLLaMA 1.1B (ultra-lightweight)
- Microsoft Phi-2 (2.7B, fast & quality)
- Neural Chat 7B (optimized for conversations)
- Mistral 7B Instruct
- LLaMA 2 7B Chat

👤 **Custom Profiles**: Create profiles to define how the AI behaves with system prompts and parameters.

💾 **Local Storage**: All chats are stored locally in IndexedDB, persisting across sessions.

📤 **Export/Import**: Backup and restore your conversations and profiles.

🔍 **Search**: Search through your chat history.

📱 **Responsive**: Works on desktop and mobile devices.

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Usage

1. **Download a Model**
   - Go to the "Models" tab
   - Click "Download" on any available model
   - Wait for the download to complete

2. **Create/Select a Profile**
   - Go to the "Profiles" tab
   - Select an existing profile or create a new one
   - Customize the system prompt and parameters

3. **Start Chatting**
   - Go to the "Chat" tab
   - Select a model from the dropdown
   - Click "New Chat" to start a conversation
   - Type your message and press Enter or click Send

4. **Manage Your Data**
   - Export profiles: Use the "Export" button in Profiles tab
   - Import profiles: Use the "Import" button to restore previously exported profiles
   - Delete conversations: Click the delete button next to any chat in the history

## Project Structure

```
src/
├── components/       # React components
│   ├── Chat/        # Chat interface
│   ├── Models/      # Model management
│   ├── Profiles/    # Profile management
│   └── Layout/      # Main layout
├── hooks/           # Custom React hooks
├── services/        # Business logic
│   ├── inference/   # LLM inference engine
│   ├── storage/     # Data storage (IndexedDB, localStorage)
│   └── models/      # Model registry
├── types/           # TypeScript type definitions
├── App.tsx          # Main app component
└── main.tsx         # Entry point
```

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Inference**: Transformers.js + WebGPU
- **Storage**: IndexedDB (chat history) + localStorage (settings)
- **Models**: Supported via HuggingFace Transformers.js

## System Requirements

- Modern browser with WebGPU support (Chrome, Edge)
- At least 4GB of free storage for models
- GPU recommended for better performance

## Browser Compatibility

- ✅ Chrome 126+
- ✅ Edge 126+
- ⚠️ Firefox (Experimental WebGPU support)
- ❌ Safari (Limited WebGPU support)

## Performance Tips

- Start with smaller models (TinyLLaMA, Phi-2) for faster inference
- Close other applications to free up memory
- Use quantized models for better memory efficiency
- Adjust context length based on your hardware

## Privacy

This application is designed with privacy as the top priority:
- ✅ No data sent to external servers
- ✅ All models run locally in your browser
- ✅ Chat history stored locally only
- ✅ No telemetry or analytics
- ✅ No account required

## Troubleshooting

### Model Loading Issues
- Ensure you have enough browser storage (check Settings tab)
- Clear browser cache and try again
- Check browser console for error messages

### Slow Inference
- Use a smaller model
- Reduce max tokens in your profile
- Close other applications
- Ensure WebGPU is enabled in your browser

### Out of Memory
- Unload unused models from Models tab
- Reduce batch size or max tokens
- Use a smaller model variant

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT

## Acknowledgments

- Built with [Transformers.js](https://xenova.github.io/transformers.js/)
- Models from [HuggingFace](https://huggingface.co/)
- UI Framework: [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
