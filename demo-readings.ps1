
# ==========================================
# Minimal IoT Dashboard - Sprint 1 Demo
# Sends manual readings for two IoT devices
# ==========================================

$apiUrl = "http://localhost:3000/api/telemetry"

$devices = @(
    @{
        sensorId = "sensor-01"
        temperature = 24.5
        humidity = 55
    },
    @{
        sensorId = "sensor-02"
        temperature = 28
        humidity = 62
    }
)

Write-Host "`nStarting manual telemetry demonstration..." -ForegroundColor Cyan

foreach ($device in $devices) {
    Write-Host "`nSending readings for $($device.sensorId)..." -ForegroundColor Yellow

    try {
        $body = $device | ConvertTo-Json

        $response = Invoke-RestMethod `
            -Uri $apiUrl `
            -Method POST `
            -ContentType "application/json" `
            -Body $body

        Write-Host "Successfully sent!" -ForegroundColor Green
        Write-Host "Device: $($device.sensorId)"
        Write-Host "Temperature: $($device.temperature) C"
        Write-Host "Humidity: $($device.humidity) %"
        Write-Host "Server response: $($response.message)"
    }
    catch {
        Write-Host "Failed to send readings!" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}

Write-Host "`nDemo readings completed!" -ForegroundColor Cyan
