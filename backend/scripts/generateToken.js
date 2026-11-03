#!/usr/bin/env node

/**
 * Token generation script for authorized development and testing purposes.
 * Reads JWT_SECRET from the environment or .env file.
 *
 * NOTE: In production, token issuance must be handled by a trusted identity
 * provider / authentication service (e.g. OAuth2/OIDC, Auth0, Keycloak).
 *
 * Usage:
 *   node scripts/generateToken.js [options]
 *
 * Options:
 *   --sub <subject>     Subject / user ID (default: "developer-local")
 *   --role <role>       User role (default: "admin")
 *   --expiresIn <time>  Expiration time (default: "24h")
 */

const path = require("path");
const fs = require("fs");

// Load .env from root or local backend
const rootEnvPath = path.resolve(__dirname, "../../.env");
const localEnvPath = path.resolve(__dirname, "../.env");
const envPath = fs.existsSync(rootEnvPath) ? rootEnvPath : localEnvPath;

require("dotenv").config({
    path: envPath,
    quiet: true
});

const jwt = require("jsonwebtoken");

const secret = process.env.JWT_SECRET;

if (!secret) {
    console.error("Error: JWT_SECRET environment variable is not defined.");
    console.error("Please configure JWT_SECRET in your .env file or environment before generating a token.");
    process.exit(1);
}

// Parse simple CLI arguments
const args = process.argv.slice(2);
let sub = "developer-local";
let role = "admin";
let expiresIn = "24h";

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sub" && args[i + 1]) {
        sub = args[++i];
    } else if (args[i] === "--role" && args[i + 1]) {
        role = args[++i];
    } else if (args[i] === "--expiresIn" && args[i + 1]) {
        expiresIn = args[++i];
    }
}

const payload = {
    sub,
    role,
    iss: "miniot-dev-script"
};

const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn
});

console.log("=== Minimal IoT Dashboard Development Token ===");
console.log(`Subject:    ${sub}`);
console.log(`Role:       ${role}`);
console.log(`Expires in: ${expiresIn}`);
console.log(`Algorithm:  HS256`);
console.log("\nGenerated JWT:");
console.log(token);
console.log("\nExample Authorization header:");
console.log(`Authorization: Bearer ${token}`);
console.log("\nExample cURL command:");
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/telemetry`);
console.log("===============================================");
