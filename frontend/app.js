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
                },
                ticks: {
                    callback: (value) =>
                        new Date(value).toLocaleTimeString()
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

const socketUrl = window.location.protocol.startsWith("http")
    ? undefined
    : "http://localhost:3001";

const socket = io(socketUrl, {
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

const deviceCards =
    document.getElementById("device-cards");

const deviceReadings = new Map();

const telemetryTableBody =
    document.getElementById("telemetry-table-body");

const exportCsvButton =
    document.getElementById("export-csv");

const exportJsonButton =
    document.getElementById("export-json");

const logLimitSelect =
    document.getElementById("log-limit-select");

const toggleExpandButton =
    document.getElementById("toggle-expand-logs");

const logCountInfo =
    document.getElementById("log-count-info");

let visibleLogLimit = 6;
let isExpanded = false;

function formatOneDecimal(val) {
    if (val === null || val === undefined || val === "" || isNaN(Number(val))) {
        return "--";
    }
    return Number(val).toFixed(1);
}

// Table controls setup
if (logLimitSelect) {
    logLimitSelect.addEventListener("change", (e) => {
        visibleLogLimit = e.target.value === "all" ? "all" : Number(e.target.value);
        isExpanded = visibleLogLimit === "all";
        if (toggleExpandButton) {
            toggleExpandButton.textContent = isExpanded ? "Collapse" : "Expand All";
        }
        renderTelemetryTable();
    });
}

if (toggleExpandButton) {
    toggleExpandButton.addEventListener("click", () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            visibleLogLimit = "all";
            toggleExpandButton.textContent = "Collapse";
            if (logLimitSelect) logLimitSelect.value = "all";
        } else {
            visibleLogLimit = 6;
            toggleExpandButton.textContent = "Expand All";
            if (logLimitSelect) logLimitSelect.value = "6";
        }
        renderTelemetryTable();
    });
}

// =========================
// Render Device Cards
// =========================

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
            device.temperature === null
                ? "-- °C"
                : `${formatOneDecimal(device.temperature)} °C`;

        temperatureItem.append(
            temperatureLabel,
            temperatureValue
        );

        const humidityItem = document.createElement("div");
        humidityItem.className = "telemetry-item";

        const humidityLabel = document.createElement("span");
        humidityLabel.textContent = "Humidity";

        const humidityValue = document.createElement("strong");
        humidityValue.textContent =
            device.humidity === null
                ? "-- %"
                : `${formatOneDecimal(device.humidity)} %`;

        humidityItem.append(
            humidityLabel,
            humidityValue
        );

        values.append(temperatureItem, humidityItem);
        card.append(header, values);

        deviceCards.appendChild(card);
    });
}

// =========================
// Historical Log Table
// =========================

function createTelemetryRowElement(telemetry) {
    const row = document.createElement("tr");

    const values = [
        new Date(telemetry.timestamp).toLocaleString(),
        telemetry.sensorId,
        `${formatOneDecimal(telemetry.temperature)} °C`,
        `${formatOneDecimal(telemetry.humidity)} %`
    ];

    values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
    });

    return row;
}

let filteredHistory = null;

function renderTelemetryTable(records) {
    const dataList = records || (filteredHistory !== null ? filteredHistory : telemetryHistory);

    if (logCountInfo) {
        const currentCount = (visibleLogLimit === "all" || isExpanded)
            ? dataList.length
            : Math.min(Number(visibleLogLimit), dataList.length);
        logCountInfo.textContent = `Showing latest ${currentCount} of ${dataList.length} logs`;
    }

    if (!telemetryTableBody) return;
    telemetryTableBody.innerHTML = "";

    const limit = (visibleLogLimit === "all" || isExpanded)
        ? dataList.length
        : Number(visibleLogLimit);

    const visibleRecords = dataList.slice(0, limit);

    visibleRecords.forEach((telemetry) => {
        telemetryTableBody.appendChild(createTelemetryRowElement(telemetry));
    });
}

function addTelemetryRow(telemetry) {
    if (filteredHistory === null) {
        renderTelemetryTable();
    }
}

// =========================
// Date Filter
// =========================

function applyDateFilter() {
    const startValue =
        document.getElementById("start-date").value;

    const endValue =
        document.getElementById("end-date").value;

    const message =
        document.getElementById("filter-message");

    if (!startValue && !endValue) {
        message.textContent = "Please select at least a start or end date.";
        return;
    }

    if (startValue && endValue && startValue > endValue) {
        message.textContent =
            "Start date cannot be after end date.";
        return;
    }

    const start = startValue
        ? new Date(`${startValue}T00:00:00`).getTime()
        : -Infinity;

    const end = endValue
        ? new Date(`${endValue}T00:00:00`).getTime() + 86400000
        : Infinity;

    filteredHistory = telemetryHistory.filter((record) => {
        const timestamp =
            new Date(record.timestamp).getTime();

        return timestamp >= start && timestamp < end;
    });

    renderTelemetryTable(filteredHistory);

    message.textContent =
        `${filteredHistory.length} reading(s) found.`;
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
        ...rows.map((row) =>
            row.map(escapeCsv).join(",")
        )
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
    const blob = new Blob(
        [content],
        { type: mimeType }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// =========================
// Connect Export Buttons
// =========================

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
// Device Chart Colors
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

// =========================
// Update Charts Per Device
// =========================

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
            pointRadius: 2.5,
            tension: 0.4,
            showLine: true
        };

        chart.data.datasets.push(dataset);
    }

    dataset.data.push({
        x: time,
        y: Number(Number(value).toFixed(1))
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

socket.on("init_history", (records) => {
    if (!Array.isArray(records) || records.length === 0) return;

    // Sort chronological for chart lines
    const chronological = [...records].reverse();
    chronological.forEach((r) => {
        const sId = r.sensorId || r.device_id;
        const time = r.timestamp || r.time || new Date().toISOString();
        if (sId && r.temperature !== undefined) {
            updateDeviceChart(temperatureChart, sId, r.temperature, time);
        }
        if (sId && r.humidity !== undefined) {
            updateDeviceChart(humidityChart, sId, r.humidity, time);
        }
    });

    // Store in history (newest first)
    telemetryHistory = records.map((r) => ({
        timestamp: r.timestamp || r.time,
        sensorId: r.sensorId || r.device_id,
        temperature: r.temperature,
        humidity: r.humidity
    }));

    // Update latest card values
    const seen = new Set();
    records.forEach((r) => {
        const sId = r.sensorId || r.device_id;
        if (!seen.has(sId)) {
            seen.add(sId);
            deviceReadings.set(sId, {
                temperature: r.temperature,
                humidity: r.humidity,
                online: true,
                lastSeen: Date.now()
            });
            updateDeviceStatistics({
                sensorId: sId,
                temperature: r.temperature,
                humidity: r.humidity
            });
        }
    });

    renderDeviceCards();
    renderDeviceStatistics();
    renderTelemetryTable();
});

socket.on("telemetry", (data) => {
    console.log("Telemetry received:", data);

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

    // Clear the previous offline timer.
    if (device.offlineTimer) {
        clearTimeout(device.offlineTimer);
    }

    // Mark device offline after 10 seconds without telemetry.
    device.offlineTimer = setTimeout(() => {
        device.online = false;
        renderDeviceCards();
    }, 10000);

    deviceReadings.set(sensorId, device);

    renderDeviceCards();

    const time =
        data.timestamp || new Date().toISOString();

    // Update temperature chart.
    if (data.temperature !== undefined &&
        Number.isFinite(Number(data.temperature))) {

        updateDeviceChart(
            temperatureChart,
            sensorId,
            data.temperature,
            time
        );
    }

    // Update humidity chart.
    if (data.humidity !== undefined &&
        Number.isFinite(Number(data.humidity))) {

        updateDeviceChart(
            humidityChart,
            sensorId,
            data.humidity,
            time
        );
    }

    // Save historical reading (newest first).
    const record = {
        timestamp: time,
        sensorId: sensorId,
        temperature: data.temperature ?? "",
        humidity: data.humidity ?? ""
    };

    telemetryHistory.unshift(record);

    if (telemetryHistory.length > MAX_HISTORY) {
        telemetryHistory.pop();
    }

    // Update the historical table.
    if (filteredHistory === null) {
        renderTelemetryTable();
    } else {
        applyDateFilter();
    }

    // Update statistics once for every new reading.
    updateDeviceStatistics(record);
});

// =========================
// Device Statistics
// =========================

function updateDeviceStatistics(telemetry) {
    const sensorId =
        String(telemetry.sensorId ?? "Unknown");

    if (!deviceStatistics[sensorId]) {
        deviceStatistics[sensorId] = {
            temperature: [],
            humidity: []
        };
    }

    const stats = deviceStatistics[sensorId];

    if (
        telemetry.temperature !== undefined &&
        telemetry.temperature !== null &&
        telemetry.temperature !== ""
    ) {
        const temperature = Number(telemetry.temperature);

        if (Number.isFinite(temperature)) {
            stats.temperature.push(temperature);
        }
    }

    if (
        telemetry.humidity !== undefined &&
        telemetry.humidity !== null &&
        telemetry.humidity !== ""
    ) {
        const humidity = Number(telemetry.humidity);

        if (Number.isFinite(humidity)) {
            stats.humidity.push(humidity);
        }
    }

    // Keep the latest 1000 readings per device.
    stats.temperature =
        stats.temperature.slice(-MAX_STATISTICS_HISTORY);

    stats.humidity =
        stats.humidity.slice(-MAX_STATISTICS_HISTORY);

    renderDeviceStatistics();
}

// =========================
// Calculate Statistics
// =========================

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

    const avg = values.reduce(
        (sum, value) => sum + value,
        0
    ) / values.length;

    return {
        min: min.toFixed(1),
        max: max.toFixed(1),
        avg: avg.toFixed(1)
    };
}

// =========================
// Render Device Statistics
// =========================

function renderDeviceStatistics() {
    const container =
        document.getElementById("device-statistics");

    if (!container) return;

    container.replaceChildren();

    Object.entries(deviceStatistics).forEach(
        ([sensorId, stats]) => {

            const temperature =
                calculateStatistics(stats.temperature);

            const humidity =
                calculateStatistics(stats.humidity);

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
        }
    );
}

// =========================
// Date Filter Event Listeners
// =========================

document
    .getElementById("apply-date-filter")
    .addEventListener("click", applyDateFilter);

document
    .getElementById("clear-date-filter")
    .addEventListener("click", clearDateFilter);