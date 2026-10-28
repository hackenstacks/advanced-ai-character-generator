# AI Horde & Pollinations.ai Image Generation Fixes

## Summary of Issues Fixed

### 1. **AI Horde Sampler Name Validation Error**
**Problem**: The error showed `'k_euler_ancestral' is not one of ['k_dpmpp_2s_a', 'k_euler', ...]`

**Root Cause**: While the current code uses the valid `'k_euler'` sampler, there might have been cases where invalid sampler names were passed through settings or from older configurations.

**Fix Applied**:
- Added validation for sampler names against the official AI Horde list
- Created a whitelist of valid samplers: `k_dpmpp_2s_a`, `k_euler`, `k_dpm_adaptive`, `k_dpmpp_2m`, `k_dpmpp_sde`, `k_dpm_2`, `k_dpm_2_a`, `k_heun`, `k_euler_a`, `k_lms`, `lcm`, `k_dpm_fast`, `dpmsolver`, `DDIM`
- Default to `'k_euler'` if no valid sampler is specified
- Added better error messages that list valid samplers when validation fails

### 2. **AI Horde Seed Type Error**
**Problem**: `"params.seed":"658274862 is not of type 'string'"`

**Root Cause**: The AI Horde API expects the seed parameter to be a string, but the code was generating it as a number.

**Fix Applied**:
- Changed `seed: Math.floor(Math.random() * 2147483647)` to `seed: Math.floor(Math.random() * 2147483647).toString()`
- Added specific error handling for seed type validation errors

### 3. **Pollinations.ai Error Handling**
**Problem**: Pollinations.ai errors were not providing detailed information

**Fix Applied**:
- Enhanced error handling to include response text in error messages
- Changed from generic error to specific: `Pollinations API Error (${response.status}): ${errorText}`

### 4. **General Error Handling Improvements**
- Added specific guidance for common AI Horde validation errors
- Improved fallback mechanism from AI Horde to Pollinations.ai
- Better logging for debugging image generation issues

## Files Modified

### `services/geminiService.ts`
- **`generateAIHordeImage()`**: Added sampler validation, fixed seed type, improved error handling
- **`generatePollinationsImage()`**: Enhanced error reporting
- **`generateImageFromPrompt()`**: Improved fallback logic

## Testing Recommendations

### Test 1: AI Horde with Anonymous Access
```javascript
// Should work with default settings
await generateImageFromPrompt("a beautiful landscape", {
    service: "aihorde",
    apiKey: "0000000000"
});
```

### Test 2: AI Horde with Valid API Key
```javascript
// Should work with better quality settings
await generateImageFromPrompt("a cyberpunk city", {
    service: "aihorde", 
    apiKey: "your_real_api_key_here"
});
```

### Test 3: Pollinations.ai Fallback
```javascript
// Should automatically fall back to Pollinations if AI Horde fails
await generateImageFromPrompt("a fantasy castle", {
    service: "aihorde",
    apiKey: "0000000000"
});
```

### Test 4: Custom Sampler Validation
```javascript
// Should automatically correct invalid sampler to 'k_euler'
await generateImageFromPrompt("a portrait", {
    service: "aihorde",
    apiKey: "0000000000",
    sampler_name: "invalid_sampler" // Will be corrected to 'k_euler'
});
```

## Expected Results

1. **AI Horde should now work** with both anonymous and registered users
2. **No more validation errors** for sampler names or seed types
3. **Better error messages** that guide users to solutions
4. **Automatic fallback** to Pollinations.ai when AI Horde fails
5. **Improved success rate** for image generation requests

## Additional Recommendations

1. **Get a real AI Horde API key** for better results and priority
2. **Use simpler prompts** for higher success rates with anonymous access
3. **Try different models** if one fails - `stable_diffusion` is most reliable
4. **Check AI Horde status** at https://stablehorde.net/status if issues persist
5. **Consider Pollinations.ai** as a reliable alternative that doesn't require API keys

## Rollback Instructions

If these changes cause issues, you can revert by:

```bash
# Check git status
git status

# Revert specific changes
git checkout -- services/geminiService.ts

# Or reset to previous commit
git reset --hard HEAD~1
```