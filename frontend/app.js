
"use strict";

// ==========================================
// CONFIGURATION AND DATA STORAGE
// ==========================================

const MAX_HISTORY = 1000;
const MAX_STATISTICS_HISTORY = 1000;
const MAX_CHART_POINTS = 60;

const telemetryHistory = [];
const deviceStatistics = {};
const deviceReadings = new Map();

// Convert valid telemetry values to numbers.
// Missing or invalid values remain null, never zero.
function parseTelemetryValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

let filteredHistory = null;

const deviceChartColors = [
    "#805ce5",
    "#dc657d",
    "#20a77b",
    "#e49a35",
    "#159fbd",
    "#b35cce",
    "#5475d8"
];

// ==========================================
// DOM ELEMENTS
// ==========================================

const connectionStatus =
    document.getElementById("connection-status");

const deviceCards =
    document.getElementById("device-cards");

const deviceStatisticsContainer =
    document.getElementById("device-statistics");

const telemetryTableBody =
    document.getElementById("telemetry-table-body");

const exportCsvButton =
    document.getElementById("export-csv");

const exportJsonButton =
    document.getElementById("export-json");

const startDateInput =
    document.getElementById("start-date");

const endDateInput =
    document.getElementById("end-date");

const filterMessage =
    document.getElementById("filter-message");

const recordCount =
    document.getElementById("record-count");

// ==========================================
// CHART DEFAULTS
// ==========================================

Chart.defaults.font.family = "Inter, Arial, sans-serif";
Chart.defaults.color = "#78849a";

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: "index",
        intersect: false
    },
    plugins: {
        legend: {
            position: "bottom",
            labels: {
                usePointStyle: true,
                boxWidth: 8,
                padding: 18,
                font: {
                    size: 10,
                    weight: "600"
                }
            }
        },
        tooltip: {
            backgroundColor: "#263247",
            titleColor: "#ffffff",
            bodyColor: "#ffffff",
            padding: 12,
            cornerRadius: 9
        }
    },
    elements: {
        point: {
            radius: 2,
            hoverRadius: 6
        },
        line: {
            borderWidth: 2.5,
            tension: 0.35
        }
    }
};

// ==========================================
// LIVE TEMPERATURE CHART
// ==========================================

const temperatureChart = new Chart(
    document.getElementById("temperature-chart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 8,
                        font: { size: 9 }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Temperature (°C)"
                    },
                    beginAtZero: false,
                    grid: {
                        color: "#f0eff7"
                    }
                }
            }
        }
    }
);

// ==========================================
// LIVE HUMIDITY CHART
// ==========================================

const humidityChart = new Chart(
    document.getElementById("humidity-chart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxTicksLimit: 8,
                        font: { size: 9 }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Humidity (%)"
                    },
                    min: 0,
                    max: 100,
                    grid: {
                        color: "#f0eff7"
                    }
                }
            }
        }
    }
);

// ==========================================
// HISTORICAL COMBINED GRAPH
// ==========================================

const historicalChart = new Chart(
    document.getElementById("historical-chart"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Temperature (°C)",
                    data: [],
                    yAxisID: "temperatureAxis",
                    borderColor: "#805ce5",
                    backgroundColor: "rgba(128,92,229,0.10)",
                    borderWidth: 2.8,
                    tension: 0.35,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    fill: true,
                    spanGaps: true
                },
                {
                    label: "Humidity (%)",
                    data: [],
                    yAxisID: "humidityAxis",
                    borderColor: "#22a9d2",
                    backgroundColor: "rgba(34,169,210,0.08)",
                    borderWidth: 2.8,
                    tension: 0.35,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    fill: false,
                    spanGaps: true
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: "Reading Time"
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 9 }
                    }
                },
                temperatureAxis: {
                    type: "linear",
                    position: "left",
                    title: {
                        display: true,
                        text: "Temperature (°C)",
                        color: "#805ce5"
                    },
                    grid: {
                        color: "#f0eff7"
                    },
                    ticks: {
                        color: "#805ce5"
                    }
                },
                humidityAxis: {
                    type: "linear",
                    position: "right",
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Humidity (%)",
                        color: "#22a9d2"
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: "#22a9d2"
                    }
                }
            }
        }
    }
);

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

// Uses the current hostname instead of hardcoded localhost.
// Set window.BACKEND_URL before loading app.js if needed.
const backendBaseUrl = window.BACKEND_URL ||
    `${window.location.protocol}//${window.location.hostname}:3000`;

const socket = io(backendBaseUrl, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000
});

socket.on("connect", () => {
    console.log("Connected to backend");

    connectionStatus.textContent = "● Connected";
    connectionStatus.classList.remove("disconnected");
    connectionStatus.classList.add("connected");
});

socket.on("disconnect", () => {
    console.log("Disconnected from backend");

    connectionStatus.textContent = "● Disconnected";
    connectionStatus.classList.remove("connected");
    connectionStatus.classList.add("disconnected");
});

socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
});

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

    const deviceThemes = [
        {
            color: "#8061d9",
            background: "#f1eaff",
            border: "#d9caff"
        },
        {
            color: "#16a5d9",
            background: "#e5f6ff",
            border: "#bceaff"
        },
        {
            color: "#f2a32e",
            background: "#fff4e2",
            border: "#ffdda6"
        }
    ];

    deviceReadings.forEach((device, sensorId, map) => {
        const deviceIndex = Array.from(map.keys()).indexOf(sensorId);
        const theme = deviceThemes[deviceIndex % deviceThemes.length];

        const card = document.createElement("div");
        card.className = "device-card";

        // Left illustration panel
        const illustration = document.createElement("div");
        illustration.className = "device-illustration";
        illustration.style.setProperty("--device-color", theme.color);
        illustration.style.setProperty("--device-bg", theme.background);
        illustration.style.setProperty("--device-border", theme.border);

        illustration.innerHTML = `
            <div class="wifi-symbol">⌁</div>

            <div class="device-board">
                <svg viewBox="0 0 120 90" width="105" height="85"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 28 L83 10 L108 29 L42 49 Z"
                          fill="#26364d"/>
                    <path d="M18 28 L42 49 L42 75 L18 54 Z"
                          fill="#17263a"/>
                    <path d="M42 49 L108 29 L108 55 L42 75 Z"
                          fill="#34465e"/>
                    <path d="M43 22 L79 12 L96 24 L60 35 Z"
                          fill="#b9c7d4"/>
                    <path d="M48 22 L78 14 L89 23 L59 32 Z"
                          fill="#dce5ed"/>
                    <rect x="61" y="20" width="12" height="8"
                          rx="2" fill="#657b8d"/>
                    <path d="M27 38 L39 46 L39 59 L27 51 Z"
                          fill="#91a6b8"/>
                    <path d="M45 55 L96 40" stroke="#8ba0b5"
                          stroke-width="2"/>
                    <path d="M46 62 L95 48" stroke="#8ba0b5"
                          stroke-width="2"/>
                    <g fill="#e5b65d">
                        <circle cx="29" cy="32" r="2"/>
                        <circle cx="35" cy="36" r="2"/>
                        <circle cx="43" cy="42" r="2"/>
                        <circle cx="99" cy="33" r="2"/>
                    </g>
                    <g stroke="#d5a84d" stroke-width="2">
                        <path d="M49 72 V82"/>
                        <path d="M58 69 V80"/>
                        <path d="M68 66 V77"/>
                        <path d="M78 63 V74"/>
                        <path d="M88 60 V71"/>
                    </g>
                </svg>
            </div>

            <span class="device-number">Device ${deviceIndex + 1}</span>
        `;

        // Right content panel
        const content = document.createElement("div");
        content.className = "device-content";

        const header = document.createElement("div");
        header.className = "device-card-header";

        const name = document.createElement("h3");
        name.textContent = sensorId;

        const status = document.createElement("span");
        status.className = `online-status ${device.online ? "online" : "offline"}`;
        status.textContent = device.online ? "Online" : "Offline";

        header.append(name, status);

        const values = document.createElement("div");
        values.className = "telemetry-values";

        // Temperature
        const temperatureItem = document.createElement("div");
        temperatureItem.className = "telemetry-item";

        const temperatureValue = parseTelemetryValue(device.temperature);

        temperatureItem.innerHTML = `
            <span>Temperature</span>
            <div class="reading-row">
                <strong>${temperatureValue === null ? "-- °C" : `${temperatureValue} °C`}</strong>
                <span class="reading-icon temperature-icon">♨</span>
            </div>
        `;

        // Humidity
        const humidityItem = document.createElement("div");
        humidityItem.className = "telemetry-item";

        const humidityValue = parseTelemetryValue(device.humidity);

        humidityItem.innerHTML = `
            <span>Humidity</span>
            <div class="reading-row">
                <strong>${humidityValue === null ? "-- %" : `${humidityValue} %`}</strong>
                <span class="reading-icon humidity-icon">💧</span>
            </div>
        `;

        values.append(temperatureItem, humidityItem);
        content.append(header, values);

        card.append(illustration, content);
        deviceCards.appendChild(card);
    });
}

// ==========================================
// LIVE CHART UPDATES
// ==========================================

function updateDeviceChart(chart, sensorId, value, timestamp) {
    const time = new Date(timestamp).toLocaleTimeString();

    let dataset = chart.data.datasets.find(
        item => item.label === sensorId
    );

    if (!dataset) {
        const color = deviceChartColors[
            chart.data.datasets.length % deviceChartColors.length
        ];

        dataset = {
            label: sensorId,
            data: Array(chart.data.labels.length).fill(null),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 6,
            spanGaps: true,
            fill: false
        };

        chart.data.datasets.push(dataset);
    }

    chart.data.labels.push(time);

    chart.data.datasets.forEach(item => {
        item.data.push(
            item === dataset ? parseTelemetryValue(value) : null
        );
    });

    if (chart.data.labels.length > MAX_CHART_POINTS) {
        chart.data.labels.shift();

        chart.data.datasets.forEach(item => {
            item.data.shift();
        });
    }

    chart.update("none");
}

// ==========================================
// STATISTICS CALCULATION
// ==========================================

function calculateStatistics(values) {
    const validValues = values
        .map(parseTelemetryValue)
        .filter(value => value !== null);

    if (validValues.length === 0) {
        return {
            min: "--",
            max: "--",
            avg: "--"
        };
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    const avg = validValues.reduce(
        (sum, value) => sum + value,
        0
    ) / validValues.length;

    return {
        min: min.toFixed(2),
        max: max.toFixed(2),
        avg: avg.toFixed(2)
    };
}

// ==========================================
// PER-DEVICE STATISTICS
// ==========================================

function updateDeviceStatistics(telemetry) {
    const sensorId = String(telemetry.sensorId ?? "Unknown");

    if (!deviceStatistics[sensorId]) {
        deviceStatistics[sensorId] = {
            temperature: [],
            humidity: []
        };
    }

    const stats = deviceStatistics[sensorId];

    const temperature = parseTelemetryValue(telemetry.temperature);
    const humidity = parseTelemetryValue(telemetry.humidity);

    if (temperature !== null) {
        stats.temperature.push(temperature);
    }

    if (humidity !== null) {
        stats.humidity.push(humidity);
    }

    stats.temperature =
        stats.temperature.slice(-MAX_STATISTICS_HISTORY);

    stats.humidity =
        stats.humidity.slice(-MAX_STATISTICS_HISTORY);

    renderDeviceStatistics();
}

function renderDeviceStatistics() {
    deviceStatisticsContainer.replaceChildren();

    if (Object.keys(deviceStatistics).length === 0) {
        deviceStatisticsContainer.innerHTML =
            '<div class="empty-state">Statistics will appear after readings arrive.</div>';
        return;
    }

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

        deviceStatisticsContainer.appendChild(card);
    });
}

// ==========================================
// HISTORICAL SUMMARY CARDS
// ==========================================

function updateHistoricalSummary(records) {
    const temperatures = records
        .map(record => parseTelemetryValue(record.temperature))
        .filter(value => value !== null);

    const humidities = records
        .map(record => parseTelemetryValue(record.humidity))
        .filter(value => value !== null);

    const temperatureStats = calculateStatistics(temperatures);
    const humidityStats = calculateStatistics(humidities);

    document.getElementById("history-temp-min").textContent =
        temperatureStats.min === "--"
            ? "-- °C"
            : `${temperatureStats.min} °C`;

    document.getElementById("history-temp-max").textContent =
        temperatureStats.max === "--"
            ? "-- °C"
            : `${temperatureStats.max} °C`;

    document.getElementById("history-temp-avg").textContent =
        temperatureStats.avg === "--"
            ? "-- °C"
            : `${temperatureStats.avg} °C`;

    document.getElementById("history-humidity-min").textContent =
        humidityStats.min === "--"
            ? "-- %"
            : `${humidityStats.min} %`;

    document.getElementById("history-humidity-max").textContent =
        humidityStats.max === "--"
            ? "-- %"
            : `${humidityStats.max} %`;

    document.getElementById("history-humidity-avg").textContent =
        humidityStats.avg === "--"
            ? "-- %"
            : `${humidityStats.avg} %`;
}

// ==========================================
// HISTORICAL GRAPH
// ==========================================

function updateHistoricalChart(records) {
    const sortedRecords = [...records].sort(
        (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
    );

    historicalChart.data.labels = sortedRecords.map(record =>
        new Date(record.timestamp).toLocaleString()
    );

    historicalChart.data.datasets[0].data =
        sortedRecords.map(record =>
            parseTelemetryValue(record.temperature)
        );

    historicalChart.data.datasets[1].data =
        sortedRecords.map(record =>
            parseTelemetryValue(record.humidity)
        );

    historicalChart.update("none");
}

// ==========================================
// HISTORICAL TABLE
// ==========================================

function renderTelemetryTable(records = filteredHistory !== null ? filteredHistory : telemetryHistory) {
    telemetryTableBody.replaceChildren();

    if (records.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.className = "table-empty";
        cell.textContent = "No telemetry records found.";

        row.appendChild(cell);
        telemetryTableBody.appendChild(row);

        recordCount.textContent = "0 readings";
        return;
    }

    // Display newest records first.
    const newestFirst = [...records].reverse();

    newestFirst.forEach((telemetry, index) => {
        const row = document.createElement("tr");

        const temperature = parseTelemetryValue(telemetry.temperature);
        const humidity = parseTelemetryValue(telemetry.humidity);

        const values = [
            index + 1,
            new Date(telemetry.timestamp).toLocaleString(),
            telemetry.sensorId,
            temperature === null
                ? "--"
                : `${temperature.toFixed(2)} °C`,
            humidity === null
                ? "--"
                : `${humidity.toFixed(2)} %`
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        telemetryTableBody.appendChild(row);
    });

    recordCount.textContent =
        `${records.length} available reading(s)`;
}

// ==========================================
// REFRESH HISTORICAL SECTION
// ==========================================

function refreshHistoricalSection() {
    const records = filteredHistory !== null
        ? filteredHistory
        : telemetryHistory;

    updateHistoricalSummary(records);
    updateHistoricalChart(records);
    renderTelemetryTable(records);
}

// ==========================================
// DATE FILTER
// ==========================================

function applyDateFilter() {
    const startValue = startDateInput.value;
    const endValue = endDateInput.value;

    if (!startValue && !endValue) {
        filterMessage.textContent =
            "Please select at least a start date or an end date.";
        return;
    }

    if (startValue && endValue && startValue > endValue) {
        filterMessage.textContent =
            "Start date cannot be after end date.";
        return;
    }

    const start = startValue
        ? new Date(`${startValue}T00:00:00`).getTime()
        : -Infinity;

    const end = endValue
        ? new Date(`${endValue}T00:00:00`).getTime() + 86400000
        : Infinity;

    filteredHistory = telemetryHistory.filter(record => {
        const timestamp = new Date(record.timestamp).getTime();

        return timestamp >= start && timestamp < end;
    });

    filterMessage.textContent =
        `${filteredHistory.length} reading(s) found for the selected date range.`;

    refreshHistoricalSection();
}

function clearDateFilter() {
    startDateInput.value = "";
    endDateInput.value = "";

    filteredHistory = null;
    filterMessage.textContent = "";

    refreshHistoricalSection();
}

// ==========================================
// RECEIVE TELEMETRY
// ==========================================

// Receive historical telemetry when connected.
socket.on("init_history", (records) => {
    if (!Array.isArray(records) || records.length === 0) return;

    // Sort chronologically for chart lines.
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

    // Store historical records.
    telemetryHistory.splice(
        0,
        telemetryHistory.length,
        ...records.map((r) => ({
            timestamp: r.timestamp || r.time,
            sensorId: r.sensorId || r.device_id,
            temperature: r.temperature,
            humidity: r.humidity
        }))
    );

    // Update latest device readings.
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
    refreshHistoricalSection();
});

// Receive new live telemetry.
socket.on("telemetry", (data) => {
    console.log("Telemetry received:", data);

    const sensorId = String(data.sensorId ?? "Unknown");

    const timestamp = data.timestamp || new Date().toISOString();

    const device = deviceReadings.get(sensorId) ?? {
        temperature: null,
        humidity: null,
        online: true,
        offlineTimer: null
    };

    device.temperature = parseTelemetryValue(data.temperature);
    device.humidity = parseTelemetryValue(data.humidity);

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

    // Missing readings are added as gaps, not zero values.
    updateDeviceChart(
        temperatureChart,
        sensorId,
        device.temperature,
        timestamp
    );

    updateDeviceChart(
        humidityChart,
        sensorId,
        device.humidity,
        timestamp
    );

    // Store missing readings as null.
    const record = {
        timestamp,
        sensorId,
        temperature: device.temperature,
        humidity: device.humidity
    };

    telemetryHistory.unshift(record);

    if (telemetryHistory.length > MAX_HISTORY) {
        telemetryHistory.pop();
    }

    // Update per-device statistics once for every new reading.
    updateDeviceStatistics(record);

    // Update historical data and selected date filter.
    if (filteredHistory !== null) {
        const startValue = startDateInput.value;
        const endValue = endDateInput.value;

        const readingDate = new Date(record.timestamp);
        const readingDay = [
            readingDate.getFullYear(),
            String(readingDate.getMonth() + 1).padStart(2, "0"),
            String(readingDate.getDate()).padStart(2, "0")
        ].join("-");

        const afterStart = !startValue || readingDay >= startValue;
        const beforeEnd = !endValue || readingDay <= endValue;

        if (afterStart && beforeEnd) {
            filteredHistory.push(record);
        }

        refreshHistoricalSection();
    } else {
        refreshHistoricalSection();
    }
});

// ==========================================
// CSV EXPORT
// ==========================================

function escapeCsv(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function getExportRecords() {
    return filteredHistory !== null
        ? filteredHistory
        : telemetryHistory;
}

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

function exportCsv() {
    const records = getExportRecords();

    if (records.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    const headers = [
        "Timestamp",
        "Device",
        "Temperature",
        "Humidity"
    ];

    const rows = records.map(item => [
        item.timestamp,
        item.sensorId,
        item.temperature,
        item.humidity
    ]);

    const csvContent = [
        headers.map(escapeCsv).join(","),
        ...rows.map(row => row.map(escapeCsv).join(","))
    ].join("\r\n");

    downloadFile(
        csvContent,
        "telemetry-history.csv",
        "text/csv;charset=utf-8;"
    );
}

// ==========================================
// JSON EXPORT
// ==========================================

function exportJson() {
    const records = getExportRecords();

    if (records.length === 0) {
        alert("No telemetry data available to export.");
        return;
    }

    downloadFile(
        JSON.stringify(records, null, 2),
        "telemetry-history.json",
        "application/json"
    );
}

// ==========================================
// EVENT LISTENERS
// ==========================================

document
    .getElementById("apply-date-filter")
    .addEventListener("click", applyDateFilter);

document
    .getElementById("clear-date-filter")
    .addEventListener("click", clearDateFilter);

exportCsvButton.addEventListener("click", exportCsv);
exportJsonButton.addEventListener("click", exportJson);

// ==========================================
// INITIAL EMPTY STATE
// ==========================================

renderDeviceCards();
renderDeviceStatistics();
refreshHistoricalSection();

console.log("Minimal IoT Dashboard initialized.");
