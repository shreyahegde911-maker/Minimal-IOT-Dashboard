// =========================
// Temperature Chart
// =========================

const temperatureCtx = document
    .getElementById("temperature-chart")
    .getContext("2d");

const temperatureChart = new Chart(temperatureCtx, {
    type: "line",

    data: {
        labels: [],
        datasets: [{
            label: "Temperature (°C)",
            data: [],
            borderWidth: 2,
            tension: 0.3
        }]
    },

    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: false
            }
        }
    }
});


// =========================
// Humidity Chart
// =========================

const humidityCtx = document
    .getElementById("humidity-chart")
    .getContext("2d");

const humidityChart = new Chart(humidityCtx, {
    type: "line",

    data: {
        labels: [],
        datasets: [{
            label: "Humidity (%)",
            data: [],
            borderWidth: 2,
            tension: 0.3
        }]
    },

    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});


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


    // =========================
    // Update Device Name
    // =========================

    if (data.sensorId !== undefined) {
        deviceName.textContent = data.sensorId;
    }


    // =========================
    // Update Temperature
    // =========================

    if (data.temperature !== undefined) {
        temperatureValue.textContent = `${data.temperature} °C`;
    }


    // =========================
    // Update Humidity
    // =========================

    if (data.humidity !== undefined) {
        humidityValue.textContent = `${data.humidity} %`;
    }


    // =========================
    // Update Temperature Chart
    // =========================

    if (data.temperature !== undefined) {

        const time = new Date().toLocaleTimeString();

        temperatureChart.data.labels.push(time);
        temperatureChart.data.datasets[0].data.push(data.temperature);

        // Keep only the latest 60 points
        if (temperatureChart.data.labels.length > 60) {
            temperatureChart.data.labels.shift();
            temperatureChart.data.datasets[0].data.shift();
        }

        temperatureChart.update();
    }


    // =========================
    // Update Humidity Chart
    // =========================

    if (data.humidity !== undefined) {

        const time = new Date().toLocaleTimeString();

        humidityChart.data.labels.push(time);
        humidityChart.data.datasets[0].data.push(data.humidity);

        // Keep only the latest 60 points
        if (humidityChart.data.labels.length > 60) {
            humidityChart.data.labels.shift();
            humidityChart.data.datasets[0].data.shift();
        }

        humidityChart.update();
    }

});