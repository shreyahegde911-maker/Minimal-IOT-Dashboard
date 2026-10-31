
// =========================
// Store Historical Telemetry
// =========================

const telemetryHistory = [];
const MAX_HISTORY = 1000;

// =========================
// Per-Device Statistics
// =========================

const deviceStatistics = {};
const MAX_STATISTICS_HISTORY = 1000;


// =========================
// Temperature Chart
// =========================

const temperatureCtx = document
    .getElementById("temperature-chart")
    .getContext("2d");

const temperatureChart = new Chart(temperatureCtx, {
    type: "line",
    data: {
        datasets: []
    },
    options: {
        responsive: true,
        parsing: false,
        scales: {
            x: {
                type: "linear",
                title: {
                    display: true,
                    text: "Time"
                },
                ticks: {
                    callback: (value) =>
                        new Date(value).toLocaleTimeString()
                }
            },
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
        datasets: []
    },

    options: {
        responsive: true,
        parsing: false,

        scales: {
            x: {
                type: "linear",
                title: {
                    display: true,
                    text: "Time"
                }
            },
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: "Humidity (%)"
                }
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

const deviceStatistics = new Map();

const statisticsContainer = document.getElementById("device-statistics");

function updateDeviceStatistics(sensorId, data) {
    const stats = deviceStatistics.get(sensorId) ?? {
        temperatures: [],
        humidities: []
    };

    if (data.temperature !== undefined &&
        data.temperature !== null &&
        Number.isFinite(Number(data.temperature))) {
        stats.temperatures.push(Number(data.temperature));
    }

    if (data.humidity !== undefined &&
        data.humidity !== null &&
        Number.isFinite(Number(data.humidity))) {
        stats.humidities.push(Number(data.humidity));
    }

    deviceStatistics.set(sensorId, stats);
}

function calculateStats(values) {
    if (values.length === 0) {
        return { min: "--", max: "--", avg: "--" };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0)
        / values.length;

    return {
        min: min.toFixed(1),
        max: max.toFixed(1),
        avg: avg.toFixed(1)
    };
}

function renderDeviceStatistics() {
    statisticsContainer.innerHTML = "";

    deviceStatistics.forEach((stats, sensorId) => {
        const temperature = calculateStats(stats.temperatures);
        const humidity = calculateStats(stats.humidities);

        const card = document.createElement("div");
        card.className = "statistics-card";

        const title = document.createElement("h3");
        title.textContent = sensorId;
        card.appendChild(title);

        const table = document.createElement("table");

        const header = document.createElement("tr");
        ["Metric", "Minimum", "Maximum", "Average"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            header.appendChild(th);
        });
        table.appendChild(header);

        function addRow(label, values, unit) {
            const row = document.createElement("tr");
            const cells = [
                label,
                values.min === "--" ? "--" : `${values.min}${unit}`,
                values.max === "--" ? "--" : `${values.max}${unit}`,
                values.avg === "--" ? "--" : `${values.avg}${unit}`
            ];

            cells.forEach(text => {
                const cell = document.createElement("td");
                cell.textContent = text;
                row.appendChild(cell);
            });

            table.appendChild(row);
        }

        addRow("Temperature", temperature, " °C");
        addRow("Humidity", humidity, " %");

        card.appendChild(table);
        statisticsContainer.appendChild(card);
    });
}


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
}

let filteredHistory = null;

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

    if (!startValue && !endValue) {
        message.textContent = "Please select at least a start or end date.";
        return;
    }

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
    const dataToExport = filteredHistory !== null ? filteredHistory : telemetryHistory;

    if (dataToExport.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    const headers = [
        "Timestamp",
        "Device",
        "Temperature",
        "Humidity"
    ];

    const rows = dataToExport.map((item) => [
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
    const dataToExport = filteredHistory !== null ? filteredHistory : telemetryHistory;

    if (dataToExport.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    const jsonContent = JSON.stringify(dataToExport, null, 2);

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
    const time = new Date(timestamp).getTime();

    let dataset = chart.data.datasets.find(
        item => item.label === sensorId
    );

    if (!dataset) {
        const color = deviceChartColors[
            chart.data.datasets.length % deviceChartColors.length
        ];

        dataset = {
            label: sensorId,
            data: [],
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            showLine: true
        };

        chart.data.datasets.push(dataset);
    }

    dataset.data.push({
        x: time,
        y: Number(value)
    });

    // Keep only the latest 60 readings per device.
    if (dataset.data.length > 60) {
        dataset.data.shift();
    }

    // Keep points in chronological order.
    dataset.data.sort((a, b) => a.x - b.x);

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
        updateDeviceStatistics(sensorId, data);
        renderDeviceStatistics();
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
    updateDeviceStatistics(record);
});
// =========================
// Device Statistics
// =========================

function updateDeviceStatistics(telemetry) {
    const sensorId = String(telemetry.sensorId ?? "Unknown");

    if (!deviceStatistics[sensorId]) {
        deviceStatistics[sensorId] = {
            temperature: [],
            humidity: []
        };
    }

    const stats = deviceStatistics[sensorId];

    if (telemetry.temperature !== undefined &&
        telemetry.temperature !== null &&
        telemetry.temperature !== "") {
        stats.temperature.push(Number(telemetry.temperature));
    }

    if (telemetry.humidity !== undefined &&
        telemetry.humidity !== null &&
        telemetry.humidity !== "") {
        stats.humidity.push(Number(telemetry.humidity));
    }

    // Keep statistics based on the latest 1000 readings per device
    stats.temperature = stats.temperature.slice(-MAX_STATISTICS_HISTORY);
    stats.humidity = stats.humidity.slice(-MAX_STATISTICS_HISTORY);

    renderDeviceStatistics();
}

function calculateStatistics(values) {
    if (values.length === 0) {
        return {
            min: "--",
            max: "--",
            avg: "--"
        };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0)
        / values.length;

    return {
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2)
    };
}

function renderDeviceStatistics() {
    const container = document.getElementById("device-statistics");

    if (!container) return;

    container.replaceChildren();

    Object.entries(deviceStatistics).forEach(([sensorId, stats]) => {
        const temperature = calculateStatistics(stats.temperature);
        const humidity = calculateStatistics(stats.humidity);

        const card = document.createElement("div");
        card.className = "statistics-card";

        const title = document.createElement("h3");
        title.textContent = sensorId;
        card.appendChild(title);

        const details = [
            ["Temperature Min", `${temperature.min} °C`],
            ["Temperature Max", `${temperature.max} °C`],
            ["Temperature Avg", `${temperature.avg} °C`],
            ["Humidity Min", `${humidity.min} %`],
            ["Humidity Max", `${humidity.max} %`],
            ["Humidity Avg", `${humidity.avg} %`]
        ];

        details.forEach(([label, value]) => {
            const item = document.createElement("p");
            item.textContent = `${label}: ${value}`;
            card.appendChild(item);
        });

        container.appendChild(card);
    });
}
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
