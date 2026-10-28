# 🚀 AI CHARACTER GENERATOR - PRODUCTION DEPLOYMENT GUIDE

## Quick Start (TL;DR)

```bash
# Build the app
npm run build

# Start production HTTPS server
npm run prod

# Access at: https://localhost:8443
```

---

## 📋 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [SSL Certificate Setup](#ssl-certificate-setup)
3. [Building for Production](#building-for-production)
4. [Running the Production Server](#running-the-production-server)
5. [Systemd Service (Auto-Start)](#systemd-service-auto-start)
6. [Nginx Reverse Proxy (Optional)](#nginx-reverse-proxy-optional)
7. [Security Checklist](#security-checklist)
8. [Troubleshooting](#troubleshooting)

---

## ✅ PREREQUISITES

- **Node.js 18+** installed
- **npm** package manager
- **OpenSSL** (for generating certificates)
- **Linux/Unix system** (or WSL on Windows)
- **Port 8443** available (or 443 with sudo)

---

## 🔐 SSL CERTIFICATE SETUP

### Option 1: Use Existing Certificates

If you already have `cert.pem` and `key.pem` in the project root, you're good to go!

### Option 2: Generate Self-Signed Certificate (Development/Testing)

```bash
# Use the included script
npm run generate-cert

# Or manually:
openssl req -nodes -new -x509 \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

**Note:** Browsers will show a warning for self-signed certs. Click "Advanced" → "Proceed to localhost (unsafe)" to continue.

### Option 3: Use Let's Encrypt (Production)

For a real domain with trusted certificates:

```bash
# Install certbot
sudo apt install certbot  # Debian/Ubuntu
sudo yum install certbot  # RHEL/CentOS

# Get certificate for your domain
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./key.pem
sudo chown $USER:$USER cert.pem key.pem
```

---

## 🔨 BUILDING FOR PRODUCTION

```bash
# Install dependencies (if not already done)
npm install

# Build the production bundle
npm run build

# Output will be in ./dist/
ls -la dist/
```

**What happens:**
- TypeScript compiled to JavaScript
- React components bundled
- CSS minified and optimized
- Assets hashed for caching
- Source maps generated

---

## 🚀 RUNNING THE PRODUCTION SERVER

### Standard Port (8443)

```bash
npm run prod
```

Server starts on `https://localhost:8443`

### Standard HTTPS Port (443) - Requires sudo

```bash
npm run prod:443

# Or manually:
sudo node server-production.js --port 443
```

Server starts on `https://localhost` (no port needed!)

### Custom Port

```bash
node server-production.js --port 9000
```

### What You'll See:

```
╔══════════════════════════════════════════════════════════════╗
║     🔐 AI CHARACTER GENERATOR - PRODUCTION SERVER          ║
╚══════════════════════════════════════════════════════════════╝

✅ HTTPS Server running on port 8443
🌐 Access at: https://localhost:8443
📁 Serving from: /path/to/dist

🔒 Security Features:
   • TLS/SSL encryption enabled
   • Security headers configured
   • Content Security Policy active
   • Directory traversal protection

🔄 HTTP Redirect server running on port 8080
   (Automatically redirects to HTTPS)
```

---

## 🔄 SYSTEMD SERVICE (Auto-Start)

Create a systemd service to auto-start the server on boot:

### 1. Create Service File

```bash
sudo nano /etc/systemd/system/ai-character-gen.service
```

### 2. Service Configuration

```ini
[Unit]
Description=AI Character Generator - Production HTTPS Server
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/home/yourusername/Projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access
ExecStart=/usr/bin/node /home/yourusername/Projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access/server-production.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-char-gen

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/yourusername/Projects/adv-ai-nexus/advanced-ai-character-generator-terminal-access

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable ai-character-gen

# Start the service
sudo systemctl start ai-character-gen

# Check status
sudo systemctl status ai-character-gen

# View logs
sudo journalctl -u ai-character-gen -f
```

### 4. Manage Service

```bash
# Stop service
sudo systemctl stop ai-character-gen

# Restart service
sudo systemctl restart ai-character-gen

# Disable auto-start
sudo systemctl disable ai-character-gen
```

---

## 🔀 NGINX REVERSE PROXY (Optional)

Use Nginx as a reverse proxy for additional features like load balancing, caching, and easier SSL management.

### 1. Install Nginx

```bash
sudo apt install nginx  # Debian/Ubuntu
sudo yum install nginx  # RHEL/CentOS
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/ai-character-gen
```

### 3. Configuration File

```nginx
upstream ai_backend {
    server localhost:8443;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/ai-char-gen.access.log;
    error_log /var/log/nginx/ai-char-gen.error.log;

    # Proxy to Node.js server
    location / {
        proxy_pass https://ai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass https://ai_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Enable and Restart Nginx

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ai-character-gen /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable auto-start
sudo systemctl enable nginx
```

---

## 🔒 SECURITY CHECKLIST

Before deploying to production:

### SSL/TLS
- ✅ Use Let's Encrypt or valid SSL certificate (not self-signed)
- ✅ Enforce HTTPS (redirect HTTP → HTTPS)
- ✅ Use TLS 1.2 or higher only
- ✅ Configure strong cipher suites

### Server Security
- ✅ Run server as non-root user
- ✅ Use systemd security features (NoNewPrivileges, PrivateTmp, etc.)
- ✅ Keep Node.js and dependencies updated
- ✅ Enable firewall (UFW, iptables)
- ✅ Configure fail2ban for brute-force protection

### Application Security
- ✅ Security headers configured (already included in server)
- ✅ Content Security Policy active
- ✅ Directory traversal protection enabled
- ✅ Input validation on all forms
- ✅ Rate limiting for API endpoints

### Firewall Rules

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8443/tcp  # Node.js HTTPS (if not using Nginx)
sudo ufw enable
sudo ufw status

# iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT   # SSH
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT   # HTTP
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # HTTPS
sudo iptables -A INPUT -p tcp --dport 8443 -j ACCEPT # Node.js
```

---

## 🐛 TROUBLESHOOTING

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using the port
sudo lsof -i :8443

# Kill the process
sudo kill -9 <PID>

# Or use a different port
node server-production.js --port 9000
```

### Permission Denied

**Error:** `EACCES: permission denied`

**Solution:**
```bash
# For ports < 1024, use sudo
sudo node server-production.js --port 443

# Or use a higher port
node server-production.js --port 8443
```

### SSL Certificate Not Found

**Error:** `Failed to load SSL certificates`

**Solution:**
```bash
# Check if certificates exist
ls -la cert.pem key.pem

# Generate new certificates
npm run generate-cert

# Check permissions
chmod 600 key.pem
chmod 644 cert.pem
```

### Browser Shows "Not Secure"

**For self-signed certificates:**
1. Click "Advanced" or "Details"
2. Click "Proceed to localhost (unsafe)"
3. Accept the security exception

**For production:**
- Use Let's Encrypt or valid SSL certificate
- Ensure certificate matches domain name
- Check certificate expiration date

### Dist Folder Not Found

**Error:** `Build directory not found`

**Solution:**
```bash
# Build the application first
npm run build

# Verify dist folder exists
ls -la dist/
```

### Server Won't Start

**Check logs:**
```bash
# If using systemd
sudo journalctl -u ai-character-gen -n 50

# If running manually
node server-production.js 2>&1 | tee server.log
```

---

## 📊 PERFORMANCE OPTIMIZATION

### Enable HTTP/2

Already enabled in `server-production.js` and Nginx config!

### Enable Gzip Compression

Add to Nginx:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### CDN Integration (Optional)

Consider using Cloudflare or similar CDN for:
- DDoS protection
- Global caching
- Automatic SSL
- Performance optimization

---

## 📈 MONITORING

### Server Logs

```bash
# Systemd journal
sudo journalctl -u ai-character-gen -f

# Nginx access logs
sudo tail -f /var/log/nginx/ai-char-gen.access.log

# Nginx error logs
sudo tail -f /var/log/nginx/ai-char-gen.error.log
```

### Health Checks

Add a health check endpoint (optional):

```javascript
// In server-production.js, add before handleRequest:
if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
}
```

Test with:
```bash
curl -k https://localhost:8443/health
```

---

## 🎯 PRODUCTION CHECKLIST

Before going live:

- [ ] SSL certificate installed (Let's Encrypt or valid cert)
- [ ] `npm run build` completed successfully
- [ ] Server tested locally on port 8443
- [ ] Firewall configured to allow 80, 443
- [ ] Systemd service created and enabled
- [ ] Nginx reverse proxy configured (optional)
- [ ] Security headers verified
- [ ] Domain DNS configured correctly
- [ ] Backups scheduled (vault + database)
- [ ] Monitoring/logging configured
- [ ] Rate limiting enabled (if needed)
- [ ] Documentation updated

---

## 🚀 DEPLOYMENT SUMMARY

### Quick Commands

```bash
# 1. Build
npm run build

# 2. Start (development)
npm run prod

# 3. Start (production with systemd)
sudo systemctl start ai-character-gen

# 4. Access
# https://localhost:8443 (development)
# https://yourdomain.com (production)
```

---

## 📞 SUPPORT

For issues or questions:
- Check `action_report.md` for recent changes
- Review `USER_MANUAL.md` for usage guide
- Check server logs for errors
- Verify SSL certificates are valid

---

**Production Server Ready!** 🔐✨

*Sane • Simple • Secure NeXuS*
*Built with ❤️ for secure AI character interactions*
