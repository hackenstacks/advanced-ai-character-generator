# AI Nexus API Tester

A **standalone**, comprehensive testing framework for debugging AI Nexus image generation and chat APIs.

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd api-testing
npm install

# 2. Copy and configure your API keys
cp .env.local.example .env.local
# Edit .env.local and add your API keys

# 3. Run tests
npm test              # Test all APIs
npm run test:images  # Test all image providers
npm run test:chat    # Test all chat providers
npm run test:aihorde # Test just AI Horde
```

## 🧪 Features

### ✅ Comprehensive API Testing
- **Image Generation**: AI Horde, Pollinations, Gemini
- **Chat APIs**: Gemini, Ollama (local)
- **Automatic Retries**: 3 attempts with 2-second delays
- **Detailed Error Analysis**: Decodes API error codes

### ✅ Smart Error Handling
- **AI Horde Specific Errors**: Detects queue issues, maintenance mode, anonymous restrictions
- **HTTP Error Codes**: Comprehensive mapping of all common HTTP errors
- **Provider-Specific Guidance**: Tailored troubleshooting for each service

### ✅ Configuration Management
- **Environment Variables**: Easy API key management
- **Test Prompts**: Customizable default prompts
- **Timeout Settings**: Adjustable for different network conditions

## 📋 Available Tests

### Image Generation Providers

| Provider | Key Required | Test Command |
|----------|-------------|--------------|
| AI Horde | ✅ Yes | `npm run test:aihorde` |
| Pollinations | ❌ No | `npm run test:images` |
| Gemini | ✅ Yes | `npm run test:gemini` |

### Chat Providers

| Provider | Key Required | Test Command |
|----------|-------------|--------------|
| Gemini | ✅ Yes | `npm run test:chat` |
| Ollama | ❌ No | `npm run test:ollama` |

## 🔧 Configuration

### Environment Variables

Copy `.env.local.example` to `.env.local` and add your API keys:

```env
# AI Horde
AI_HORDE_API_KEY="your_key_here"

# Google Gemini
GEMINI_API_KEY="your_gemini_key"

# Customize test prompts
TEST_IMAGE_PROMPT="your custom image prompt"
TEST_CHAT_PROMPT="your custom chat prompt"
```

### Customizing Tests

Edit `api-tester.js` to:
- Add new API providers
- Modify test parameters
- Change retry logic
- Add custom error handling

## 📊 Test Output Examples

### Successful Test
```
🧪 Testing AI Horde Image Generation...
🔑 API Key: *****
📝 Prompt: "a beautiful landscape"
🎨 Model: stable_diffusion
✅ Request accepted by AI Horde
📋 Job ID: abc123-def456
⏳ Waiting for generation to complete...
⏳ Checking status... (1/10)
🎉 Image generation completed!
🖼️ Image URL: https://.../generated_image.png
```

### Failed Test with Guidance
```
🧪 Testing AI Horde Image Generation...
🔑 API Key: Anonymous
📝 Prompt: "a beautiful landscape"
🎨 Model: stable_diffusion
❌ Test failed:
AI Horde: Generation impossible (usually anonymous user restrictions)
📋 Error details: AI Horde says generation is impossible with current settings

💡 Suggestions:
1. Get a real API key from stablehorde.net
2. Try a different model (stable_diffusion, stable_diffusion_2.1)
3. Use simpler prompts
4. Try during off-peak hours
```

## 🛠️ Troubleshooting

### Common Issues & Solutions

**AI Horde Failures**
- **Anonymous access**: Get a free API key from stablehorde.net
- **Queue full**: Try during off-peak hours
- **Model unavailable**: Try `stable_diffusion` or `stable_diffusion_2.1`

**Gemini Failures**
- **API key issues**: Verify key in Google Cloud Console
- **Quota exceeded**: Check your Google AI Studio quota
- **Model not found**: Use `gemini-1.5-flash` or `gemini-1.5-pro`

**Ollama Failures**
- **Connection refused**: Make sure Ollama server is running
- **Model not found**: Pull the model with `ollama pull llama3`

## 📚 API Error Code Reference

### AI Horde Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Validate API key |
| 403 | Forbidden | Anonymous restrictions |
| 429 | Rate Limited | Wait and retry |
| IMPOSSIBLE | Anonymous limits | Get API key |

### HTTP Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Fix parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Permission issue |
| 404 | Not Found | Wrong endpoint |
| 429 | Too Many Requests | Rate limited |
| 500 | Server Error | Try later |
| 503 | Service Unavailable | Maintenance |

## 🎯 Usage Patterns

### Test Specific Provider
```bash
# Test AI Horde only
npm run test:aihorde

# Test Gemini chat only
node api-tester.js chat gemini
```

### Test All Providers
```bash
# Test all image providers
npm run test:images

# Test all chat providers
npm run test:chat
```

### Custom Test Prompts
```bash
# Temporarily override test prompt
TEST_IMAGE_PROMPT="a cyberpunk city" npm run test:aihorde
```

## 🔄 Adding New Providers

To add a new API provider:

1. **Add to API_CONFIGS** in `api-tester.js`
2. **Create test function** following the existing pattern
3. **Add error codes** to `API_ERROR_CODES`
4. **Update README** with usage instructions

## 📋 Changelog

### v1.0.0
- Initial release
- AI Horde, Pollinations, Gemini image testing
- Gemini, Ollama chat testing
- Comprehensive error handling
- Environment configuration

## 🤝 Contributing

Contributions welcome! Please:
- Add new API providers
- Improve error handling
- Enhance documentation
- Add more test cases

## 📄 License

MIT License - Free to use and modify!