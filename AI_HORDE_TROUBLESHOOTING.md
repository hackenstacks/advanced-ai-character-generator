# AI Horde Image Generation Troubleshooting

## 🚨 Common Error: "AI Horde says generation is impossible with current settings"

This error occurs when the AI Horde service cannot fulfill your image generation request. Here's how to fix it:

## 🔧 Step-by-Step Solutions

### 1. **Get a Proper API Key (Most Important!)**

The default API key `0000000000` is for anonymous access with **very limited capabilities**:

```bash
# Anonymous users get:
- Lowest priority in the queue
- Limited access to models
- Higher chance of rejection
- Slower processing times
```

**How to get a free API key:**
1. Go to [stablehorde.net](https://stablehorde.net)
2. Register for a free account
3. Get your API key from account settings
4. Enter it in the Image Generation plugin settings in AI Nexus

### 2. **Try Different Models**

Some models work better than others. Recommended models in order of reliability:

```
✅ Most Reliable:
- stable_diffusion
- stable_diffusion_2.1
- Dreamshaper
- Realistic Vision

⚠️ May Work:
- Anything Diffusion
- Midjourney Diffusion
- OpenJourney
- ChilloutMix
- Deliberate
```

### 3. **Adjust Your Image Parameters**

**Recommended settings for better success:**

```json
{
  "width": 512,
  "height": 512,
  "steps": 15-25,  // Lower for anonymous users
  "cfg_scale": 7-10,
  "sampler": "k_euler" or "k_dpmpp_2m"  // Use valid samplers!
}
```

**Valid AI Horde Samplers (as of latest API):**
```
✅ Working samplers:
- k_dpmpp_2s_a
- k_euler
- k_dpm_adaptive
- k_dpmpp_2m
- k_dpmpp_sde
- k_dpm_2
- k_dpm_2_a
- k_heun
- k_euler_a
- k_lms
- lcm
- k_dpm_fast
- dpmsolver
- DDIM

❌ Invalid samplers (will cause errors):
- k_euler_ancestral (common mistake!)
- Any sampler not in the list above
```

### 4. **Simplify Your Prompts**

Complex prompts are more likely to be rejected. Try simpler prompts:

```bash
# ❌ Too complex (likely to fail):
"A hyper-detailed, ultra-realistic, cinematic portrait of a cyberpunk samurai warrior with neon tattoos glowing under holographic rain, intricate mechanical armor with Japanese calligraphy engravings, standing on a floating platform above Tokyo cityscape at night with flying cars and giant holographic billboards, photorealistic 8K resolution, Unreal Engine 5, hyper-detailed textures, volumetric lighting, depth of field, cinematic composition"

# ✅ Simpler (more likely to work):
"cyberpunk samurai warrior with neon tattoos, Tokyo cityscape at night, detailed armor, cinematic lighting"
```

### 5. **Check AI Horde Status**

The service can be busy or temporarily unavailable:
- Check status: [stablehorde.net/status](https://stablehorde.net/status)
- Try again during off-peak hours
- Wait 5-10 minutes and retry

### 6. **Try Alternative Providers**

If AI Horde consistently fails, switch to other free providers:

```
🎨 Pollinations.ai (Recommended Alternative)
- No API key required
- Good quality
- Fast processing
- Multiple styles available

🤗 Hugging Face
- Free tier available
- Requires API key
- Good for experimental models

🔮 Gemini (Google)
- If you have a Google API key
- Good quality
- Reliable service
```

## 🛠️ How to Change Providers in AI Nexus

1. **Open Plugin Manager**
2. **Edit the Image Generation plugin**
3. **Change the Service dropdown** from "AI Horde" to another provider
4. **Configure the new provider's settings** (API key if needed)
5. **Save and try generating again**

## 💡 Pro Tips

- **Anonymous users**: Try during off-peak hours (early morning/late night UTC)
- **Registered users**: You get priority access and better success rates
- **Kudos system**: AI Horde uses a kudos system - you earn kudos by contributing or through time
- **Queue times**: Can vary from seconds to minutes depending on demand

## 🔄 Still Not Working?

Try this sequence:
1. Switch to Pollinations.ai (no API key needed)
2. Use a simple prompt
3. Try 512x512 resolution
4. If that works, you can experiment with other providers

**Remember**: AI Horde is a free, community-driven service. Success rates vary based on demand and your account status.