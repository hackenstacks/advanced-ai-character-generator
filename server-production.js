#!/usr/bin/env node

/**
 * AI Character Generator - Production HTTPS Server
 * Serves the built application over HTTPS with security headers
 *
 * Usage:
 *   npm run prod              # Start on default port 8443
 *   npm run prod -- --port 443 # Start on custom port
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const HTTPS_PORT = portIndex !== -1 ? parseInt(args[portIndex + 1]) : 8443;
const HTTP_PORT = 8080; // For redirect
const DIST_DIR = path.join(__dirname, 'dist');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain',
    '.xml': 'text/xml'
};

// Security headers
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    // CSP allows inline styles/scripts for React and local resources
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://emkc.org https://api.duckduckgo.com http://localhost:* https://*; font-src 'self' data:;"
};

// Load SSL certificates
let sslOptions;
try {
    sslOptions = {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };
    console.log('✅ SSL certificates loaded successfully');
} catch (error) {
    console.error('❌ Failed to load SSL certificates!');
    console.error('   Make sure cert.pem and key.pem exist in the project root.');
    console.error('   Generate them with: npm run generate-cert');
    process.exit(1);
}

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Build directory not found!');
    console.error('   Run "npm run build" first to create the dist/ folder.');
    process.exit(1);
}

// ── Sovereign key store (Sane·Simple·Secure·Sustainable) ──────────────────────
// Secrets live server-side ONLY in ~/.config/nexus/secrets/. The browser never sees
// an sk_ key; this server injects it. Rotate a key by editing one file — no rebuild.
const SECRETS_DIR = path.join(process.env.HOME || '', '.config/nexus/secrets');

function loadServerSecret(name) {
    // 1) canonical nexus.env (KEY=value, one file for all keys)
    try {
        const txt = fs.readFileSync(path.join(SECRETS_DIR, 'nexus.env'), 'utf-8');
        for (const line of txt.split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '').trim();
        }
    } catch { /* fall through */ }
    // 2) legacy single-key file fallback (POLLINATIONS_API_KEY only)
    if (name === 'POLLINATIONS_API_KEY') {
        try { return fs.readFileSync(path.join(SECRETS_DIR, 'pollinations.key'), 'utf-8').trim(); }
        catch { /* none */ }
    }
    return null;
}

// Same-origin image proxy — keeps the sk_ key off the client.
// GET /api/pollinations/image?prompt=&model=&width=&height=
function handlePollinationsImage(req, res) {
    const key = loadServerSecret('POLLINATIONS_API_KEY');
    if (!key || !key.startsWith('sk_')) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: 'No valid POLLINATIONS_API_KEY (sk_...) in ~/.config/nexus/secrets/nexus.env' }));
        return;
    }
    const q = new URL(req.url, `https://localhost:${HTTPS_PORT}`).searchParams;
    const prompt = q.get('prompt') || '';
    if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: 'Missing prompt' }));
        return;
    }
    const model = q.get('model') || 'flux';
    const width = q.get('width') || '1024';
    const height = q.get('height') || '1024';
    const upstream = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}` +
        `?model=${encodeURIComponent(model)}&width=${encodeURIComponent(width)}&height=${encodeURIComponent(height)}` +
        `&nologo=true&key=${encodeURIComponent(key)}&referrer=nexus-char-gen`;
    console.log(`[PROXY] pollinations image (model=${model} ${width}x${height}) key=sk_***`);
    https.get(upstream, (up) => {
        if (up.statusCode !== 200) {
            let body = '';
            up.on('data', c => (body += c));
            up.on('end', () => {
                res.writeHead(up.statusCode || 502, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
                res.end(JSON.stringify({ error: `Pollinations ${up.statusCode}`, detail: body.slice(0, 300) }));
            });
            return;
        }
        res.writeHead(200, {
            'Content-Type': up.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'no-store',
            ...SECURITY_HEADERS
        });
        up.pipe(res);
    }).on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
        res.end(JSON.stringify({ error: 'Upstream request failed', detail: e.message }));
    });
}

// Request handler
function handleRequest(req, res) {
    // API routes (server-side key injection) — handle before static file serving.
    if (req.url.startsWith('/api/pollinations/image')) {
        return handlePollinationsImage(req, res);
    }

    // Parse URL
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

    // Security: prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(DIST_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Try to serve the file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found - serve index.html for SPA routing
                fs.readFile(path.join(DIST_DIR, 'index.html'), (err, indexContent) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('500 Internal Server Error');
                    } else {
                        res.writeHead(200, {
                            'Content-Type': 'text/html',
                            ...SECURITY_HEADERS
                        });
                        res.end(indexContent, 'utf-8');
                    }
                });
            } else {
                // Server error
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`500 Internal Server Error: ${error.code}`);
            }
        } else {
            // Success - serve the file
            res.writeHead(200, {
                'Content-Type': contentType,
                ...SECURITY_HEADERS
            });
            res.end(content, 'utf-8');
        }
    });

    // Log request
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${contentType}`);
}

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, handleRequest);

// Create HTTP redirect server (optional - redirects HTTP to HTTPS)
const httpRedirectServer = http.createServer((req, res) => {
    const host = req.headers.host?.split(':')[0] || 'localhost';
    const redirectUrl = `https://${host}:${HTTPS_PORT}${req.url}`;

    res.writeHead(301, {
        'Location': redirectUrl,
        'Content-Type': 'text/plain'
    });
    res.end(`Redirecting to ${redirectUrl}`);

    console.log(`[REDIRECT] HTTP → HTTPS: ${req.url}`);
});

// Start servers
httpsServer.listen(HTTPS_PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     🔐 AI CHARACTER GENERATOR - PRODUCTION SERVER          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`✅ HTTPS Server running on port ${HTTPS_PORT}`);
    console.log(`🌐 Access at: https://localhost:${HTTPS_PORT}`);
    console.log(`📁 Serving from: ${DIST_DIR}\n`);
    console.log('🔒 Security Features:');
    console.log('   • TLS/SSL encryption enabled');
    console.log('   • Security headers configured');
    console.log('   • Content Security Policy active');
    console.log('   • Directory traversal protection\n');
    console.log('💡 Tips:');
    console.log('   • Add SSL exception in browser for self-signed cert');
    console.log('   • For production, use Let\'s Encrypt certificates');
    console.log('   • Press Ctrl+C to stop the server\n');
    console.log('─────────────────────────────────────────────────────────────\n');
});

// Start HTTP redirect server on non-privileged port
httpRedirectServer.listen(HTTP_PORT, () => {
    console.log(`🔄 HTTP Redirect server running on port ${HTTP_PORT}`);
    console.log(`   (Automatically redirects to HTTPS)\n`);
});

// Error handling
httpsServer.on('error', (error) => {
    if (error.code === 'EACCES') {
        console.error(`❌ Permission denied for port ${HTTPS_PORT}`);
        console.error('   For ports < 1024, run with sudo or use a higher port');
    } else if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${HTTPS_PORT} is already in use`);
        console.error('   Stop the other process or use a different port with --port');
    } else {
        console.error('❌ Server error:', error.message);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down servers...');
    httpsServer.close(() => {
        httpRedirectServer.close(() => {
            console.log('✅ Servers stopped gracefully');
            process.exit(0);
        });
    });
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down...');
    httpsServer.close(() => {
        httpRedirectServer.close(() => {
            process.exit(0);
        });
    });
});
