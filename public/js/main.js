// public/js/main_app.js

// --- ELEMEN DOM GLOBAL ---
// Variabel-variabel ini akan dapat diakses oleh skrip lain karena urutan pemuatan
const motorSpeedElement = document.getElementById('current-motor-speed');
const motorFrequencyElement = document.getElementById('current-motor-frequency');
const motorVoltageElement = document.getElementById('current-motor-voltage');
const motorStatusLightElement = document.getElementById('motor-status-light');
const motorStatusTextElement = document.getElementById('motor-operational-status');
const targetRpmFromMotorElement = document.getElementById('current-target-rpm-from-motor');
const kpValueElement = document.getElementById('current-kp-value');
const kiValueElement = document.getElementById('current-ki-value');
const kdValueElement = document.getElementById('current-kd-value');
const analyzeMotorIconButton = document.getElementById('analyze-motor-status-icon-button');
const geminiModal = document.getElementById('gemini-analysis-modal');
const geminiModalCloseButton = document.getElementById('gemini-modal-close-button');
const geminiAnalysisContent = document.getElementById('gemini-analysis-content');
const systemTimeCardElement = document.getElementById('system-time-card');
const currentYearElement = document.getElementById('current-year');
const mqttStatusIndicatorElement = document.getElementById('mqtt-status-indicator');
const mqttStatusTextElement = document.getElementById('mqtt-status-text');
const targetSetpointInputElement = document.getElementById('target-setpoint-input');
const publishSetpointButtonElement = document.getElementById('publish-setpoint-button');
const motorSpeedChartCanvas = document.getElementById('motorSpeedChart');
const motorPowerChartCanvas = document.getElementById('motorPowerChart');

// --- INISIALISASI APLIKASI ---
document.addEventListener('DOMContentLoaded', function() {
    initializeUI(); // Dari uiHandler.js
    initializeMotorSpeedChart(); // Dari uiHandler.js
    initializeMotorPowerChart(); // Dari uiHandler.js - diganti dari voltage ke power
    connectToMqttBroker(); // Dari mqttHandler.js

    // Setup event listeners untuk interaksi pengguna
    if (publishSetpointButtonElement) {
        publishSetpointButtonElement.onclick = function() {
            // Validasi input sebelum mengirim
            const targetSetpoint = targetSetpointInputElement ? targetSetpointInputElement.value : '';
            if (targetSetpoint.trim() === "") {
                showUINotification("Masukkan nilai target setpoint terlebih dahulu.", "warning"); // Gunakan notifikasi UI
                return;
            }
            const setpointNumber = parseFloat(targetSetpoint);
            if (isNaN(setpointNumber)) {
                showUINotification("Target setpoint harus berupa angka.", "warning"); // Gunakan notifikasi UI
                return;
            }
            // Tambahan validasi rentang
            if (setpointNumber < 0 || setpointNumber > 5000) { 
                showUINotification("Target setpoint di luar rentang yang valid (0-5000 RPM).", "warning");
                return;
            }
            publishSetpoint(targetSetpoint); // Dari mqttHandler.js
        };
    }

    if (analyzeMotorIconButton) {
        analyzeMotorIconButton.onclick = handleGeminiAnalysis; // Dari geminiHandler.js
    }

    if (geminiModalCloseButton) {
        geminiModalCloseButton.onclick = closeGeminiModal; // Dari uiHandler.js
    }

    window.onclick = function(event) {
        if (event.target == geminiModal) {
            closeGeminiModal(); // Dari uiHandler.js
        }
    };

    console.log("Aplikasi Dashboard IIoT Motor siap.");
});
