# 🤖 AI Nexus - Advanced AI Character Generator

**The most powerful AI character platform with secure vault, RAG, and advanced multimedia capabilities.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Overview

AI Nexus is a **cutting-edge AI character platform** that combines:
- ✨ Advanced character generation and management
- 🔒 Secure vault system with end-to-end encryption
- 📚 RAG (Retrieval-Augmented Generation) for enhanced knowledge
- 🎨 Multimedia integration (images, videos, documents)
- 🤝 Multi-character chat scenarios
- 🔐 Zero-knowledge security architecture

## 🚀 Features

### 🔒 Nexus Secure Vault
- **End-to-End Encryption**: AES-GCM encryption with your master password
- **Magic Wormhole Sharing**: Password-protected file sharing (.nexusvault)
- **Folder Organization**: Create nested folders for file management
- **Secure Storage**: All files encrypted before saving to IndexedDB

### 🤖 Advanced AI Capabilities
- **Multi-Character Chats**: Complex interactions between multiple AIs
- **Deep Thinking Mode**: Advanced reasoning with compatible models (Gemini 3.0+)
- **Google Search Integration**: Real-time web knowledge for AIs
- **RAG System**: Document-based knowledge enhancement
- **Memory System**: Long-term character memory across sessions

### 📁 Document Library
- **Instant File Availability**: Uploaded files immediately accessible to all AIs
- **Contextual Knowledge**: AIs reference files when relevant to conversations
- **Persistent Storage**: Files remain available across all chat sessions
- **Multi-Format Support**: PDFs, text files, images, and more

### 🎨 User Experience
- **Slash Commands**: Quick actions with `/image`, `/narrate`, `/memorize`, etc.
- **Action Buttons**: One-click access to memory, narration, image generation
- **Text-to-Speech**: Voice output for all messages
- **Responsive Design**: Works on desktop and tablet devices
- **Dark/Light Theme**: Customizable appearance

## 📋 Installation

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn
- Modern browser (Chrome, Firefox, Edge, Safari)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ai-nexus.git
cd ai-nexus

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Gemini API (optional for image generation)
GEMINI_API_KEY=your_api_key_here

# Google Search API (optional)
GOOGLE_API_KEY=your_api_key_here
GOOGLE_CSE_ID=your_cse_id_here
```

## 🔐 Security Architecture

### Zero-Knowledge System
- **Master Password**: Encrypts all data before storage
- **Client-Side Encryption**: All encryption happens in the browser
- **No Server Storage**: Your data never leaves your device
- **IndexedDB Storage**: Encrypted data stored in browser database

### Encryption Details
- **Algorithm**: AES-GCM (256-bit)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Data Integrity**: HMAC for tamper detection
- **Password Hashing**: Secure password verification

## 📚 Usage Guide

### Getting Started
1. **Set Master Password**: Create a strong password (remember it!)
2. **Create Characters**: Design AI personalities with detailed traits
3. **Start Chats**: Engage in conversations with your AI characters
4. **Use Vault**: Securely store and share files
5. **Upload Documents**: Enhance AI knowledge with your files

### Advanced Features

#### Secure File Sharing
```
1. Open Vault → Select File → "Secure Share"
2. Set a strong password
3. Share the .nexusvault file
4. Recipient: Import → Enter password → Access file
```

#### RAG Document Integration
```
1. Upload PDFs/text files to Document Library
2. Files are automatically indexed
3. AIs reference documents contextually
4. Knowledge persists across all chats
```

#### Multi-Character Chats
```
1. Create multiple characters
2. Start a group chat
3. Use /character [name] to address specific AIs
4. Use /converse for AI-to-AI conversations
```

## 🔧 Configuration

### Image Generation
Configure in Plugin Manager:
- **Service**: Pollinations (free), AI Horde (free), Gemini, Stability.ai
- **Model**: FLUX, Stable Diffusion, DALL-E
- **Style Presets**: Anime, Realistic, Cyberpunk, etc.
- **Negative Prompts**: Exclude unwanted elements

### AI Models
Supported providers:
- Gemini (Google)
- OpenAI (GPT-4, GPT-3.5)
- Mistral
- Groq
- OpenRouter (multiple models)
- Custom OpenAI-compatible endpoints

## 🎯 Roadmap

### Upcoming Features
- [ ] **WebTorrent Integration**: Secure peer-to-peer file sharing
- [ ] **Mobile App**: iOS/Android versions
- [ ] **Cloud Sync**: Encrypted cross-device synchronization
- [ ] **Voice Input**: Speech-to-text for conversations
- [ ] **Video Generation**: AI-powered video creation
- [ ] **Plugin Marketplace**: Community-shared plugins

### Long-Term Vision
- **Decentralized AI Network**: Community-driven AI models
- **Interoperability**: Integration with other AI platforms
- **Advanced Security**: Hardware security module support
- **Offline Mode**: Full functionality without internet

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### How to Contribute
1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Commit changes**: `git commit -m 'Add some feature'`
4. **Push to branch**: `git push origin feature/your-feature`
5. **Open a Pull Request**

### Development Standards
- **TypeScript**: Strict typing throughout
- **React Hooks**: Functional components only
- **ESLint**: Code quality enforcement
- **Prettier**: Consistent code formatting
- **JSDoc**: Comprehensive documentation

## 📜 License

**MIT License** - Free to use, modify, and distribute.

## 🌟 Acknowledgments

- **React Team**: For the amazing framework
- **TypeScript Team**: For type safety
- **Vite Team**: For blazing fast builds
- **IndexedDB**: For client-side storage
- **Web Crypto API**: For secure encryption

## 📬 Contact

For questions, suggestions, or support:
- **GitHub Issues**: Report bugs and request features
- **Community**: Join our discussion forums
- **Email**: support@ai-nexus.com

---

**AI Nexus** - Building the future of AI interaction, one character at a time. 🚀

[![Star on GitHub](https://img.shields.io/github/stars/yourusername/ai-nexus.svg?style=social)](https://github.com/yourusername/ai-nexus)
[![Fork on GitHub](https://img.shields.io/github/forks/yourusername/ai-nexus.svg?style=social)](https://github.com/yourusername/ai-nexus/fork)