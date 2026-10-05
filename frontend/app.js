// =========================
// WebSocket Connection
// =========================

const socket = io("http://localhost:3000");


// =========================
// DOM Elements
// =========================

const connectionStatus = document.getElementById("connection-status");
const deviceStatus = document.getElementById("device-status");
const deviceName = document.getElementById("device-name");
const temperatureValue = document.getElementById("temperature-value");
const humidityValue = document.getElementById("humidity-value");


// =========================
// WebSocket Connected
// =========================

socket.on("connect", () => {

    console.log("Connected to backend");

    connectionStatus.textContent = "● Connected";
    connectionStatus.classList.remove("disconnected");
    connectionStatus.classList.add("connected");

    deviceStatus.textContent = "Online";
});


// =========================
// WebSocket Disconnected
// =========================

socket.on("disconnect", () => {

    console.log("Disconnected from backend");

    connectionStatus.textContent = "● Disconnected";
    connectionStatus.classList.remove("connected");
    connectionStatus.classList.add("disconnected");

    deviceStatus.textContent = "Offline";
});


// =========================
// Receive Telemetry
// =========================

socket.on("telemetry", (data) => {

    console.log("Telemetry received:", data);

    if (data.sensorId !== undefined) {
    deviceName.textContent = data.sensorId;
    }

    // Update temperature
    if (data.temperature !== undefined) {
        temperatureValue.textContent = `${data.temperature} °C`;
    }

    // Update humidity
    if (data.humidity !== undefined) {
        humidityValue.textContent = `${data.humidity} %`;
    }

});