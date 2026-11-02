#!/bin/bash
# ==============================================================================
# Development Certificate Generation Script (IOT-NFR-020)
#
# Generates self-signed TLS certificates strictly for local development and
# reverse-proxy testing.
#
# WARNING: Self-signed certificates must NEVER be used in production.
# Production certificates must be provisioned via Let's Encrypt / Certbot
# or an enterprise Certificate Authority (CA).
# ==============================================================================

set -e

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
mkdir -p "$CERTS_DIR"

KEY_FILE="$CERTS_DIR/localhost.key"
CRT_FILE="$CERTS_DIR/localhost.crt"

echo "Generating local development self-signed certificate in $CERTS_DIR..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -subj "/C=US/ST=Development/L=Local/O=Minimal-IoT-Dashboard/OU=Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY_FILE"
chmod 644 "$CRT_FILE"

echo "Certificate generation complete:"
echo "  Private key: $KEY_FILE"
echo "  Certificate: $CRT_FILE"
echo "Note: These files are automatically ignored by .gitignore."

