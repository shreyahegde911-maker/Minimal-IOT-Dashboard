// =========================
// WebSocket Connection
// =========================

const socket = io("http://localhost:3000");

const connectionStatus = document.getElementById("connection-status");
const deviceStatus = document.getElementById("device-status");


// When connected
socket.on("connect", () => {

    console.log("Connected to backend");

    connectionStatus.textContent = "● Connected";
    connectionStatus.classList.remove("disconnected");
    connectionStatus.classList.add("connected");

    deviceStatus.textContent = "Online";
});


// When disconnected
socket.on("disconnect", () => {

    console.log("Disconnected from backend");

    connectionStatus.textContent = "● Disconnected";
    connectionStatus.classList.remove("connected");
    connectionStatus.classList.add("disconnected");

    deviceStatus.textContent = "Offline";
});