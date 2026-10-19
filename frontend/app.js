
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
    reconnectionDelayMax: 30000
});


// =========================
// DOM Elements
// =========================

const connectionStatus =
    document.getElementById("connection-status");

const deviceCards = document.getElementById("device-cards");

// Store the latest readings for each device
const deviceReadings = new Map();

const telemetryTableBody =
    document.getElementById("telemetry-table-body");

const exportCsvButton =
    document.getElementById("export-csv");

const exportJsonButton =
    document.getElementById("export-json");


function renderDeviceCards() {
    deviceCards.innerHTML = "";

    deviceReadings.forEach((device, sensorId) => {
        const card = document.createElement("div");
        card.className = "device-card";

        const header = document.createElement("div");
        header.className = "device-card-header";

        const name = document.createElement("h3");
        name.textContent = sensorId;

        const status = document.createElement("span");
        status.className = "online-status";
        status.textContent = device.online ? "Online" : "Offline";

        header.append(name, status);

        const values = document.createElement("div");
        values.className = "telemetry-values";

        const temperatureItem = document.createElement("div");
        temperatureItem.className = "telemetry-item";

        const temperatureLabel = document.createElement("span");
        temperatureLabel.textContent = "Temperature";

        const temperatureValue = document.createElement("strong");
        temperatureValue.textContent =
            device.temperature === null ? "-- °C" : `${device.temperature} °C`;

        temperatureItem.append(temperatureLabel, temperatureValue);

        const humidityItem = document.createElement("div");
        humidityItem.className = "telemetry-item";

        const humidityLabel = document.createElement("span");
        humidityLabel.textContent = "Humidity";

        const humidityValue = document.createElement("strong");
        humidityValue.textContent =
            device.humidity === null ? "-- %" : `${device.humidity} %`;

        humidityItem.append(humidityLabel, humidityValue);
        values.append(temperatureItem, humidityItem);
        card.append(header, values);
        deviceCards.appendChild(card);
    });
}


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
}let filteredHistory = null;

function renderTelemetryTable(records) {
    telemetryTableBody.innerHTML = "";

    records.forEach((telemetry) => {
        addTelemetryRow(telemetry);
    });
}

function applyDateFilter() {
    const startValue = document.getElementById("start-date").value;
    const endValue = document.getElementById("end-date").value;
    const message = document.getElementById("filter-message");

    if (startValue && endValue && startValue > endValue) {
        message.textContent = "Start date cannot be after end date.";
        return;
    }

    const start = startValue
        ? new Date(`${startValue}T00:00:00`).getTime()
        : -Infinity;

    const end = endValue
        ? new Date(`${endValue}T00:00:00`).getTime() + 86400000
        : Infinity;

    filteredHistory = telemetryHistory.filter((record) => {
        const timestamp = new Date(record.timestamp).getTime();
        return timestamp >= start && timestamp < end;
    });

    renderTelemetryTable(filteredHistory);
    message.textContent = `${filteredHistory.length} reading(s) found.`;
}

function clearDateFilter() {
    document.getElementById("start-date").value = "";
    document.getElementById("end-date").value = "";
    document.getElementById("filter-message").textContent = "";

    filteredHistory = null;
    renderTelemetryTable(telemetryHistory);
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
});

// =========================
// WebSocket Disconnected
// =========================

socket.on("disconnect", () => {
    console.log("Disconnected from backend");

    connectionStatus.textContent = "● Disconnected";
    connectionStatus.classList.remove("connected");
    connectionStatus.classList.add("disconnected");
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
    const sensorId = String(data.sensorId ?? "Unknown");

    const device = deviceReadings.get(sensorId) ?? {
        temperature: null,
        humidity: null,
        online: true
    };

    if (data.temperature !== undefined) {
        device.temperature = data.temperature;
    }

    if (data.humidity !== undefined) {
        device.humidity = data.humidity;
    }

    device.online = true;
    device.lastSeen = Date.now();

    if (device.offlineTimer) {
        clearTimeout(device.offlineTimer);
    }

    device.offlineTimer = setTimeout(() => {
        device.online = false;
        renderDeviceCards();
    }, 10000);
    deviceReadings.set(sensorId, device);

    renderDeviceCards();

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

    if (filteredHistory === null) {
    addTelemetryRow(record);
    } 
    else {
        applyDateFilter();
    }
});
document
    .getElementById("apply-date-filter")
    .addEventListener("click", applyDateFilter);

document
    .getElementById("clear-date-filter")
    .addEventListener("click", clearDateFilter);