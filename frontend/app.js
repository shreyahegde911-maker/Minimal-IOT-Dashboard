
// =========================
// Store Historical Telemetry
// =========================

const telemetryHistory = [];
const MAX_HISTORY = 1000;


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
        datasets: []
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
        datasets: []
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

const socket = io("http://localhost:3000", {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0
});


// =========================
// DOM Elements
// =========================

const connectionStatus =
    document.getElementById("connection-status");

const deviceStatus =
    document.getElementById("device-status");

const deviceName =
    document.getElementById("device-name");

const temperatureValue =
    document.getElementById("temperature-value");

const humidityValue =
    document.getElementById("humidity-value");

const telemetryTableBody =
    document.getElementById("telemetry-table-body");

const exportCsvButton =
    document.getElementById("export-csv");

const exportJsonButton =
    document.getElementById("export-json");


// =========================
// Historical Log Table
// =========================

function addTelemetryRow(telemetry) {
    const row = document.createElement("tr");

    const values = [
        new Date(telemetry.timestamp).toLocaleString(),
        telemetry.sensorId,
        `${telemetry.temperature} °C`,
        `${telemetry.humidity} %`
    ];

    values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
    });

    // Newest reading appears first
    telemetryTableBody.prepend(row);
}


// =========================
// CSV Export
// =========================

function escapeCsv(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
    if (telemetryHistory.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    const headers = [
        "Timestamp",
        "Device",
        "Temperature",
        "Humidity"
    ];

    const rows = telemetryHistory.map((item) => [
        item.timestamp,
        item.sensorId,
        item.temperature,
        item.humidity
    ]);

    const csvContent = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\r\n");

    downloadFile(
        csvContent,
        "telemetry-history.csv",
        "text/csv;charset=utf-8;"
    );
}


// =========================
// JSON Export
// =========================

function exportJson() {
    if (telemetryHistory.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    const jsonContent = JSON.stringify(telemetryHistory, null, 2);

    downloadFile(
        jsonContent,
        "telemetry-history.json",
        "application/json"
    );
}


// =========================
// Download Helper
// =========================

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


// Connect Export Buttons
exportCsvButton.addEventListener("click", exportCsv);
exportJsonButton.addEventListener("click", exportJson);


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
// Update Charts Per Device
// =========================

const deviceChartColors = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#9333ea",
    "#ea580c",
    "#0891b2",
    "#db2777"
];

function updateDeviceChart(chart, sensorId, value, timestamp) {
    const time = new Date(timestamp).toLocaleTimeString();

    // Add a separate line when a new device appears
    let dataset = chart.data.datasets.find(
        item => item.label === sensorId
    );

    if (!dataset) {
        const color =
            deviceChartColors[
                chart.data.datasets.length % deviceChartColors.length
            ];

        dataset = {
            label: sensorId,
            data: Array(chart.data.labels.length).fill(null),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            tension: 0.3,
            spanGaps: false
        };

        chart.data.datasets.push(dataset);
    }

    // Keep each device's readings aligned to the same time labels
    chart.data.labels.push(time);

    chart.data.datasets.forEach(item => {
        item.data.push(item === dataset ? value : null);
    });

    // Keep the latest 60 readings
    if (chart.data.labels.length > 60) {
        chart.data.labels.shift();

        chart.data.datasets.forEach(item => {
            item.data.shift();
        });
    }

    chart.update();
}

// =========================
// Receive Telemetry
// =========================

socket.on("telemetry", (data) => {
    console.log("Telemetry received:", data);

    // Use the backend's current field name
    const sensorId = data.sensorId;

    if (sensorId !== undefined) {
        deviceName.textContent = sensorId;
    }

    if (data.temperature !== undefined) {
        temperatureValue.textContent = `${data.temperature} °C`;
    }

    if (data.humidity !== undefined) {
        humidityValue.textContent = `${data.humidity} %`;
    }

    const time = data.timestamp || new Date().toISOString();

    // =========================
// Update Charts Per Device
// =========================

const chartSensorId = String(data.sensorId ?? "Unknown");
const timestamp = data.timestamp || new Date().toISOString();

if (data.temperature !== undefined) {
    updateDeviceChart(
        temperatureChart,
        sensorId,
        data.temperature,
        timestamp
    );
}

if (data.humidity !== undefined) {
    updateDeviceChart(
        humidityChart,
        chartSensorId,
        data.humidity,
        timestamp
    );
}

    // Save and display the historical reading
    const record = {
        timestamp: time,
        sensorId: sensorId ?? "Unknown",
        temperature: data.temperature ?? "",
        humidity: data.humidity ?? ""
    };

    telemetryHistory.push(record);

    if (telemetryHistory.length > MAX_HISTORY) {
        telemetryHistory.shift();
    }

    addTelemetryRow(record);
});