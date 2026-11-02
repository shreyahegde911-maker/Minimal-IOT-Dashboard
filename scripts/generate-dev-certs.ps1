# ==============================================================================
# Development Certificate Generation Script (IOT-NFR-020) - Windows PowerShell
#
# Generates self-signed TLS certificates strictly for local development and
# reverse-proxy testing.
#
# WARNING: Self-signed certificates must NEVER be used in production.
# Production certificates must be provisioned via Let's Encrypt / Certbot
# or an enterprise Certificate Authority (CA).
# ==============================================================================

$certsDir = Join-Path $PSScriptRoot "..\certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

$keyFile = Join-Path $certsDir "localhost.key"
$crtFile = Join-Path $certsDir "localhost.crt"

Write-Host "Checking OpenSSL availability..."
$openssl = Get-Command openssl -ErrorAction SilentlyContinue

if ($openssl) {
    Write-Host "Generating local development self-signed certificate using OpenSSL in $certsDir..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
      -keyout $keyFile `
      -out $crtFile `
      -subj "/C=US/ST=Development/L=Local/O=Minimal-IoT-Dashboard/OU=Dev/CN=localhost" `
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

    Write-Host "Certificate generation complete:"
    Write-Host "  Private key: $keyFile"
    Write-Host "  Certificate: $crtFile"
} else {
    Write-Host "OpenSSL not found in PATH. Using PowerShell New-SelfSignedCertificate..."
    $cert = New-SelfSignedCertificate -DnsName "localhost", "127.0.0.1" -CertStoreLocation "cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)
    Write-Host "Created self-signed certificate thumbprint: $($cert.Thumbprint)"
    Write-Host "To export to PEM format for Nginx, install OpenSSL or export via certmgr.msc."
}

Write-Host "Note: Certificate files (*.key, *.crt) are automatically excluded by .gitignore."

