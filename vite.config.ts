import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Cache HTTPS config to avoid repeated file system checks
    let httpsConfig;
    if (mode === 'development') {
        try {
            if (fs.existsSync('key.pem') && fs.existsSync('cert.pem')) {
                httpsConfig = {
                    key: fs.readFileSync('key.pem'),
                    cert: fs.readFileSync('cert.pem')
                };
                console.log('🔒 HTTPS enabled with self-signed certificate');
            }
        } catch (error) {
            console.log('🔓 HTTPS disabled - certificate files not found or inaccessible');
        }
    }
    
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        https: httpsConfig,
        watch: {
          usePolling: process.env.CI || false // Only use polling in CI environments
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        exclude: ['shadowvault (1).json', 'a_i_m_e (3).json', 'zombie-apocalypse.json'] // Exclude specific large character files
      }
    };
});
