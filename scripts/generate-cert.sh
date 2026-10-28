#!/bin/bash

# Script to generate self-signed SSL certificate for HTTPS development

echo "🔒 Generating self-signed SSL certificate for HTTPS development..."

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed. Please install OpenSSL first."
    exit 1
fi

# Generate certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"

if [ $? -eq 0 ]; then
    echo "✅ Certificate generated successfully!"
    echo "📁 Files created: key.pem, cert.pem"
    echo "🚀 You can now run the development server with HTTPS:"
    echo "   npm run dev"
else
    echo "❌ Failed to generate certificate"
    exit 1
fi