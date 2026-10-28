#!/usr/bin/env node

/**
 * Standalone API Tester for AI Nexus
 * Tests both image generation and chat APIs with comprehensive error handling
 * Usage: node api-tester.js [image|chat|all] [provider]
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

// Load environment variables
config({ path: '.env.local' });

// API Error Codes Database
const API_ERROR_CODES = {
    // AI Horde Error Codes
    'AI_HORDE': {
        '400': 'Bad Request - Invalid parameters',
        '401': 'Unauthorized - Invalid API key',
        '403': 'Forbidden - Anonymous user restrictions',
        '404': 'Not Found - Endpoint doesn\'t exist',
        '429': 'Too Many Requests - Rate limit exceeded',
        '500': 'Internal Server Error',
        '503': 'Service Unavailable - AI Horde is down',
        'IMPOSSIBLE': 'Generation impossible with current settings (anonymous user)',
        'QUEUE_FULL': 'AI Horde queue is full',
        'MAINTENANCE': 'AI Horde is in maintenance mode'
    },
    
    // Pollinations Error Codes
    'POLLINATIONS': {
        '400': 'Bad Request - Invalid prompt or parameters',
        '403': 'Forbidden - Content filter triggered',
        '429': 'Too Many Requests - Rate limit',
        '500': 'Internal Server Error',
        '503': 'Service Unavailable'
    },
    
    // Gemini Error Codes
    'GEMINI': {
        '400': 'Invalid request parameters',
        '401': 'Unauthorized - Invalid API key',
        '403': 'Forbidden - Quota exceeded',
        '404': 'Model not found',
        '429': 'Rate limit exceeded',
        '500': 'Internal server error',
        '503': 'Service unavailable'
    },
    
    // Common HTTP Error Codes
    'HTTP': {
        '400': 'Bad Request',
        '401': 'Unauthorized',
        '403': 'Forbidden',
        '404': 'Not Found',
        '429': 'Too Many Requests',
        '500': 'Internal Server Error',
        '502': 'Bad Gateway',
        '503': 'Service Unavailable',
        '504': 'Gateway Timeout'
    }
};

// API Configuration Database
const API_CONFIGS = {
    // Image Generation APIs
    'image': {
        'aihorde': {
            name: 'AI Horde',
            endpoint: process.env.AI_HORDE_ENDPOINT || 'https://stablehorde.net/api/v2',
            apiKey: process.env.AI_HORDE_API_KEY || '0000000000',
            requiresKey: true,
            testPrompt: process.env.TEST_IMAGE_PROMPT || 'a beautiful landscape',
            defaultParams: {
                model: 'stable_diffusion',
                steps: 15,
                width: 512,
                height: 512,
                cfg_scale: 7.0,
                sampler_name: 'k_euler'
            }
        },
        
        'pollinations': {
            name: 'Pollinations.ai',
            endpoint: process.env.POLLINATIONS_ENDPOINT || 'https://image.pollinations.ai',
            apiKey: process.env.POLLINATIONS_API_KEY || 'sk_jOK7wCJitPx6WBmwKTXznEBVREpxGd0o',
            requiresKey: true,
            testPrompt: process.env.TEST_IMAGE_PROMPT || 'a beautiful landscape',
            defaultParams: {
                model: 'flux',
                width: 512,
                height: 512
            }
        },
        
        'gemini': {
            name: 'Google Gemini',
            endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com',
            apiKey: process.env.GEMINI_API_KEY || 'AIzaSyBXZx9-ENnxY3fbqkXN_JyPTA64RLUWu0U
            ',
            requiresKey: true,
            testPrompt: process.env.TEST_IMAGE_PROMPT || 'a beautiful landscape',
            defaultParams: {
                model: 'gemini-1.5-flash'
            }
        }
    },
    
    // Chat APIs
    'chat': {
        'gemini': {
            name: 'Google Gemini Chat',
            endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com',
            apiKey: process.env.GEMINI_CHAT_API_KEY || process.env.GEMINI_API_KEY || '',
            requiresKey: true,
            testPrompt: process.env.TEST_CHAT_PROMPT || 'Hello, tell me a joke',
            defaultParams: {
                model: 'gemini-1.5-flash',
                temperature: 0.7,
                maxTokens: 1024
            }
        },
        
        'ollama': {
            name: 'Ollama (Local)',
            endpoint: process.env.OLLAMA_API_ENDPOINT || 'http://localhost:11434',
            apiKey: '',
            requiresKey: false,
            testPrompt: process.env.TEST_CHAT_PROMPT || 'Hello, tell me a joke',
            defaultParams: {
                model: 'llama3',
                temperature: 0.7,
                maxTokens: 1024
            }
        }
    }
};

// Utility Functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await delay(2000); // Wait 2 seconds before retry
        }
    }
};

const getErrorDescription = (provider, statusCode, errorMessage) => {
    const providerErrors = API_ERROR_CODES[provider] || API_ERROR_CODES.HTTP;
    const description = providerErrors[statusCode] || providerErrors[statusCode.toString()] || 'Unknown error';
    
    // Custom error detection
    if (errorMessage.includes('generation is impossible')) {
        return 'AI Horde: Generation impossible (usually anonymous user restrictions)';
    }
    
    if (errorMessage.includes('queue is full')) {
        return 'AI Horde: Queue is full, try again later';
    }
    
    if (errorMessage.includes('maintenance')) {
        return 'AI Horde: Service in maintenance mode';
    }
    
    return `${provider}: ${description} - ${errorMessage}`;
};

// API Test Functions
const testAIHordeImage = async (config) => {
    console.log(`\n🧪 Testing ${config.name} Image Generation...`);
    console.log(`🔑 API Key: ${config.apiKey === '0000000000' ? 'Anonymous' : '*****'}`);
    console.log(`📝 Prompt: "${config.testPrompt}"`);
    console.log(`🎨 Model: ${config.defaultParams.model}`);
    
    try {
        const response = await fetchWithRetry(`${config.endpoint}/generate/async`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.apiKey,
                'Client-Agent': 'AI_Nexus_Tester:1.0'
            },
            body: JSON.stringify({
                prompt: config.testPrompt,
                params: config.defaultParams,
                models: [config.defaultParams.model],
                nsfw: false,
                censor_nsfw: true
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || errorData.errors || 'Unknown error';
            throw new Error(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage);
        }
        
        const result = await response.json();
        
        if (!result.id) {
            throw new Error('No job ID returned from AI Horde');
        }
        
        console.log('✅ Request accepted by AI Horde');
        console.log(`📋 Job ID: ${result.id}`);
        console.log('⏳ Waiting for generation to complete...');
        
        // Check status
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            await delay(3000); // Wait 3 seconds between checks
            
            const statusResponse = await fetch(`${config.endpoint}/generate/status/${result.id}`);
            const statusData = await statusResponse.json();
            
            if (statusData.done) {
                if (statusData.generations && statusData.generations.length > 0) {
                    console.log('🎉 Image generation completed!');
                    console.log(`🖼️ Image URL: ${statusData.generations[0].img}`);
                    return true;
                } else {
                    throw new Error('Generation completed but no image returned');
                }
            }
            
            if (!statusData.is_possible) {
                throw new Error('AI Horde says generation is impossible with current settings');
            }
            
            attempts++;
            console.log(`⏳ Checking status... (${attempts}/${maxAttempts})`);
        }
        
        throw new Error('Generation timed out');
        
    } catch (error) {
        console.log('❌ Test failed:');
        console.log(getErrorDescription('AI_HORDE', error.message.includes('status code') ? error.message.match(/\d+/)[0] : 'UNKNOWN', error.message));
        console.log('📋 Error details:', error.message);
        
        // Suggest solutions
        if (config.apiKey === '0000000000') {
            console.log('\n💡 Suggestions:');
            console.log('1. Get a real API key from stablehorde.net');
            console.log('2. Try a different model (stable_diffusion, stable_diffusion_2.1)');
            console.log('3. Use simpler prompts');
            console.log('4. Try during off-peak hours');
        }
        
        return false;
    }
};

const testPollinationsImage = async (config) => {
    console.log(`\n🧪 Testing ${config.name} Image Generation...`);
    console.log(`📝 Prompt: "${config.testPrompt}"`);
    console.log(`🎨 Model: ${config.defaultParams.model}`);
    
    try {
        // Pollinations uses a simple GET request with prompt in URL
        const url = `${config.endpoint}/prompt/${encodeURIComponent(config.testPrompt)}`;
        
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: {
                'Accept': 'image/*'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Check if we got an image
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
            console.log('🎉 Image generation successful!');
            console.log('🖼️ Image received (binary data)');
            return true;
        } else {
            const text = await response.text();
            throw new Error(`Expected image but got: ${text.substring(0, 100)}...`);
        }
        
    } catch (error) {
        console.log('❌ Test failed:');
        console.log(getErrorDescription('POLLINATIONS', error.message.includes('HTTP') ? error.message.match(/\d+/)[0] : 'UNKNOWN', error.message));
        console.log('📋 Error details:', error.message);
        return false;
    }
};

const testGeminiImage = async (config) => {
    console.log(`\n🧪 Testing ${config.name} Image Generation...`);
    console.log(`🔑 API Key: ${config.apiKey ? '*****' : 'None'}`);
    console.log(`📝 Prompt: "${config.testPrompt}"`);
    
    if (!config.apiKey) {
        console.log('❌ Test failed: No API key provided');
        console.log('💡 Add your Gemini API key to .env.local');
        return false;
    }
    
    try {
        const response = await fetchWithRetry(
            `${config.endpoint}/v1beta/models/${config.defaultParams.model}:generateContent?key=${config.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: config.testPrompt
                        }]
                    }]
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0) {
            console.log('🎉 Image generation successful!');
            console.log('🖼️ Image data received');
            return true;
        } else {
            throw new Error('No image generated');
        }
        
    } catch (error) {
        console.log('❌ Test failed:');
        console.log(getErrorDescription('GEMINI', error.message.includes('HTTP') ? error.message.match(/\d+/)[0] : 'UNKNOWN', error.message));
        console.log('📋 Error details:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('\n💡 Check your Gemini API key:');
            console.log('1. Get a key from https://ai.google.dev');
            console.log('2. Add it to .env.local');
            console.log('3. Enable the Gemini API in Google Cloud Console');
        }
        
        return false;
    }
};

const testGeminiChat = async (config) => {
    console.log(`\n🧪 Testing ${config.name}...`);
    console.log(`🔑 API Key: ${config.apiKey ? '*****' : 'None'}`);
    console.log(`📝 Prompt: "${config.testPrompt}"`);
    console.log(`🤖 Model: ${config.defaultParams.model}`);
    
    if (!config.apiKey) {
        console.log('❌ Test failed: No API key provided');
        console.log('💡 Add your Gemini API key to .env.local');
        return false;
    }
    
    try {
        const response = await fetchWithRetry(
            `${config.endpoint}/v1beta/models/${config.defaultParams.model}:generateContent?key=${config.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: config.testPrompt
                        }]
                    }],
                    generationConfig: {
                        temperature: config.defaultParams.temperature,
                        maxOutputTokens: config.defaultParams.maxTokens
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
            const reply = result.candidates[0].content.parts[0].text;
            console.log('🎉 Chat test successful!');
            console.log(`💬 Response: "${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}"`);
            return true;
        } else {
            throw new Error('No valid response received');
        }
        
    } catch (error) {
        console.log('❌ Test failed:');
        console.log(getErrorDescription('GEMINI', error.message.includes('HTTP') ? error.message.match(/\d+/)[0] : 'UNKNOWN', error.message));
        console.log('📋 Error details:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('\n💡 Check your Gemini API key:');
            console.log('1. Get a key from https://ai.google.dev');
            console.log('2. Add it to .env.local');
            console.log('3. Enable the Gemini API in Google Cloud Console');
        }
        
        return false;
    }
};

const testOllamaChat = async (config) => {
    console.log(`\n🧪 Testing ${config.name}...`);
    console.log(`📝 Prompt: "${config.testPrompt}"`);
    console.log(`🤖 Model: ${config.defaultParams.model}`);
    console.log(`🌐 Endpoint: ${config.endpoint}`);
    
    try {
        const response = await fetchWithRetry(
            `${config.endpoint}/api/chat`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.defaultParams.model,
                    messages: [{
                        role: 'user',
                        content: config.testPrompt
                    }],
                    options: {
                        temperature: config.defaultParams.temperature
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.message && result.message.content) {
            const reply = result.message.content;
            console.log('🎉 Ollama test successful!');
            console.log(`💬 Response: "${reply.substring(0, 100)}${reply.length > 100 ? '...' : ''}"`);
            return true;
        } else {
            throw new Error('No valid response received');
        }
        
    } catch (error) {
        console.log('❌ Test failed:');
        console.log(getErrorDescription('HTTP', error.message.includes('HTTP') ? error.message.match(/\d+/)[0] : 'UNKNOWN', error.message));
        console.log('📋 Error details:', error.message);
        
        if (error.message.includes('connection refused') || error.message.includes('ENETUNREACH')) {
            console.log('\n💡 Ollama server not running:');
            console.log('1. Make sure Ollama is installed: https://ollama.ai');
            console.log('2. Start Ollama server');
            console.log('3. Pull the model: ollama pull llama3');
            console.log('4. Check endpoint in .env.local');
        }
        
        return false;
    }
};

// Main Testing Function
const runTests = async (testType, specificProvider) => {
    console.log('🚀 AI Nexus API Tester');
    console.log('======================');
    console.log(`Testing: ${testType || 'all'} ${specificProvider ? `(${specificProvider})` : ''}`);
    console.log('');
    
    const providersToTest = [];
    
    if (testType === 'image' || !testType) {
        if (specificProvider) {
            if (API_CONFIGS.image[specificProvider]) {
                providersToTest.push({ type: 'image', provider: specificProvider });
            }
        } else {
            // Test all image providers
            Object.keys(API_CONFIGS.image).forEach(provider => {
                providersToTest.push({ type: 'image', provider });
            });
        }
    }
    
    if (testType === 'chat' || !testType) {
        if (specificProvider) {
            if (API_CONFIGS.chat[specificProvider]) {
                providersToTest.push({ type: 'chat', provider: specificProvider });
            }
        } else {
            // Test all chat providers
            Object.keys(API_CONFIGS.chat).forEach(provider => {
                providersToTest.push({ type: 'chat', provider });
            });
        }
    }
    
    if (providersToTest.length === 0) {
        console.log('❌ No providers found to test');
        console.log('Available image providers:', Object.keys(API_CONFIGS.image).join(', '));
        console.log('Available chat providers:', Object.keys(API_CONFIGS.chat).join(', '));
        return;
    }
    
    let passed = 0;
    let failed = 0;
    
    for (const test of providersToTest) {
        const config = API_CONFIGS[test.type][test.provider];
        
        if (config.requiresKey && !config.apiKey) {
            console.log(`⚠️  Skipping ${config.name} - No API key configured`);
            console.log(`💡 Add ${test.provider.toUpperCase()}_API_KEY to .env.local`);
            console.log('');
            continue;
        }
        
        try {
            let result;
            
            if (test.type === 'image') {
                switch (test.provider) {
                    case 'aihorde':
                        result = await testAIHordeImage(config);
                        break;
                    case 'pollinations':
                        result = await testPollinationsImage(config);
                        break;
                    case 'gemini':
                        result = await testGeminiImage(config);
                        break;
                    default:
                        console.log(`⚠️  Image provider ${test.provider} not implemented`);
                        continue;
                }
            } else if (test.type === 'chat') {
                switch (test.provider) {
                    case 'gemini':
                        result = await testGeminiChat(config);
                        break;
                    case 'ollama':
                        result = await testOllamaChat(config);
                        break;
                    default:
                        console.log(`⚠️  Chat provider ${test.provider} not implemented`);
                        continue;
                }
            }
            
            if (result) {
                passed++;
            } else {
                failed++;
            }
            
        } catch (error) {
            console.log(`❌ Unexpected error testing ${config.name}:`, error.message);
            failed++;
        }
        
        console.log('');
    }
    
    // Summary
    console.log('📊 Test Summary');
    console.log('================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Skipped: ${providersToTest.length - passed - failed}`);
    console.log('');
    
    if (failed > 0) {
        console.log('💡 Troubleshooting Tips:');
        console.log('1. Check your API keys in .env.local');
        console.log('2. Verify internet connection');
        console.log('3. Check service status pages');
        console.log('4. Try again during off-peak hours');
        console.log('5. Review error messages for specific issues');
    }
};

// Command Line Interface
const args = process.argv.slice(2);
let testType = 'all';
let specificProvider = null;

if (args.length > 0) {
    if (args[0] === 'image' || args[0] === 'chat') {
        testType = args[0];
    }
    
    if (args.length > 1) {
        specificProvider = args[1];
    }
}

// Show help if no valid arguments
if (args.includes('--help') || args.includes('-h')) {
    console.log('AI Nexus API Tester - Usage:');
    console.log('');
    console.log('Test all APIs:');
    console.log('  node api-tester.js');
    console.log('');
    console.log('Test specific type:');
    console.log('  node api-tester.js image    # Test all image providers');
    console.log('  node api-tester.js chat     # Test all chat providers');
    console.log('');
    console.log('Test specific provider:');
    console.log('  node api-tester.js image aihorde    # Test AI Horde image generation');
    console.log('  node api-tester.js chat gemini     # Test Gemini chat');
    console.log('');
    console.log('Available image providers:', Object.keys(API_CONFIGS.image).join(', '));
    console.log('Available chat providers:', Object.keys(API_CONFIGS.chat).join(', '));
    console.log('');
    console.log('Configuration:');
    console.log('  Copy .env.example to .env.local and add your API keys');
    process.exit(0);
}

// Run the tests
runTests(testType, specificProvider).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
