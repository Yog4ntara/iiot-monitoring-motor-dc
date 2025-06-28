// Variabel untuk Chart
let motorSpeedChart;
let motorPowerChart;
const MAX_DATA_POINTS = 50; // Jumlah maksimal titik data di grafik
let currentSetpoint = 0; // Variabel untuk menyimpan nilai setpoint terakhir
let currentPower = 0; // Variabel untuk menyimpan nilai power terakhir

// Make charts globally accessible untuk dark mode
window.motorSpeedChart = motorSpeedChart;
window.motorPowerChart = motorPowerChart;

/**
 * Get chart options yang responsive terhadap dark mode
 * @returns {object} Chart options yang sesuai dengan current theme
 */
function getThemeAwareChartOptions() {
    const isDark = document.body.classList.contains('dark-mode');
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: isDark ? '#e2e8f0' : '#1e293b'
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    color: isDark ? '#e2e8f0' : '#1e293b'
                },
                ticks: {
                    color: isDark ? '#94a3b8' : '#64748b'
                },
                grid: {
                    color: isDark ? '#334155' : '#e2e8f0'
                }
            },
            x: {
                title: {
                    display: true,
                    color: isDark ? '#e2e8f0' : '#1e293b'
                },
                ticks: {
                    color: isDark ? '#94a3b8' : '#64748b'
                },
                grid: {
                    color: isDark ? '#334155' : '#e2e8f0'
                }
            }
        },
        animation: {
            duration: 200
        }
    };
}

/**
 * Update chart options berdasarkan theme saat ini
 */
function updateChartsForTheme() {
    const speedOptions = getThemeAwareChartOptions();
    const powerOptions = getThemeAwareChartOptions();
    
    // Customize options untuk setiap chart
    speedOptions.scales.y.title.text = 'RPM';
    speedOptions.scales.x.title.text = 'Waktu';
    
    powerOptions.scales.y.title.text = 'Daya (W)';
    powerOptions.scales.x.title.text = 'Waktu';
    
    // Update chart options jika chart sudah ada
    if (motorSpeedChart) {
        motorSpeedChart.options = speedOptions;
        motorSpeedChart.update('none'); // Update tanpa animasi
    }
    
    if (motorPowerChart) {
        motorPowerChart.options = powerOptions;
        motorPowerChart.update('none'); // Update tanpa animasi
    }
}

// Variabel untuk Notifikasi
const notificationBanner = document.getElementById('notification-banner');
const notificationMessageElement = document.getElementById('notification-message');
let notificationTimeout;

// --- FUNGSI INISIALISASI UI ---
function initializeUI() {    if (motorSpeedElement) motorSpeedElement.textContent = '0';
    if (motorFrequencyElement) motorFrequencyElement.textContent = '0 Hz';
    if (motorVoltageElement) motorVoltageElement.textContent = '0';
    if (motorStatusTextElement) motorStatusTextElement.textContent = 'MATI';
    if (motorStatusLightElement) {
        motorStatusLightElement.classList.remove('status-on');
        motorStatusLightElement.classList.add('status-off');
    }
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    updateSystemTime(); // Panggil sekali saat load
    setInterval(updateSystemTime, 1000); // Update setiap detik
    checkMotorStatusForAnalysis(); // Cek status awal untuk tombol Gemini

    // Listen untuk theme changes
    window.addEventListener('themeChanged', (e) => {
        updateChartsForTheme();
    });
}

// --- FUNGSI GRAFIK ---
function initializeMotorSpeedChart() {
    if (!motorSpeedChartCanvas) return;
    const ctx = motorSpeedChartCanvas.getContext('2d');
    
    const speedOptions = getThemeAwareChartOptions();
    speedOptions.scales.y.title.text = 'RPM';
    speedOptions.scales.x.title.text = 'Waktu';
    
    motorSpeedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Waktu
            datasets: [
            {
                label: 'Setpoint (RPM)',
                data: [], // Nilai setpoint
                borderColor: 'rgb(239, 68, 68, 0.6)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5], // Buat garis putus-putus agar mudah dibedakan
                tension: 0,
                pointRadius: 0,
            },
            // Dataset pertama untuk kecepatan motor
            {
                label: 'Kecepatan Motor (RPM)',
                data: [], // Nilai kecepatan
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2.5, // Sedikit lebih tebal agar jelas
                tension: 0,
                pointRadius: 2,
                pointBackgroundColor: 'rgb(59, 130, 246)',
            }]
        },
        options: speedOptions
    });
    
    // Make globally accessible
    window.motorSpeedChart = motorSpeedChart;
}

function initializeMotorPowerChart() {
    if (!motorPowerChartCanvas) return;
    const ctx = motorPowerChartCanvas.getContext('2d');
    
    const powerOptions = getThemeAwareChartOptions();
    powerOptions.scales.y.title.text = 'Daya (W)';
    powerOptions.scales.x.title.text = 'Waktu';
    
    motorPowerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Waktu
            datasets: [
            {
                label: 'Daya Motor (W)',
                data: [], // Nilai daya
                borderColor: 'rgb(251, 146, 60)',
                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                borderWidth: 2.5,
                tension: 0,
                pointRadius: 2,
                pointBackgroundColor: 'rgb(251, 146, 60)',
            }]
        },
        options: powerOptions
    });
    
    // Make globally accessible
    window.motorPowerChart = motorPowerChart;
}

function addDataToChart(speed) {
    if (!motorSpeedChart) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    motorSpeedChart.data.labels.push(timeLabel);

    motorSpeedChart.data.datasets[0].data.push(currentSetpoint);
    motorSpeedChart.data.datasets[1].data.push(speed);

    // Batasi jumlah titik data
    if (motorSpeedChart.data.labels.length > MAX_DATA_POINTS) {
        motorSpeedChart.data.labels.shift();
        motorSpeedChart.data.datasets[0].data.shift();
        motorSpeedChart.data.datasets[1].data.shift();
    }
    motorSpeedChart.update('none'); // Update tanpa animasi agar lebih smooth    // Update chart power bersamaan dengan timeline yang sama
    addDataToPowerChartSync(timeLabel, currentPower);
}

function addDataToPowerChartSync(timeLabel, power) {
    if (!motorPowerChart) return;

    motorPowerChart.data.labels.push(timeLabel);
    motorPowerChart.data.datasets[0].data.push(power);

    // Batasi jumlah titik data (sama dengan chart speed)
    if (motorPowerChart.data.labels.length > MAX_DATA_POINTS) {
        motorPowerChart.data.labels.shift();
        motorPowerChart.data.datasets[0].data.shift();
    }
    motorPowerChart.update('none'); // Update tanpa animasi agar lebih smooth
}

function addDataToPowerChart(power) {
    // Fungsi ini sekarang hanya menyimpan nilai power, tidak langsung update chart
    // Chart akan diupdate bersamaan dengan speed chart untuk sinkronisasi timeline
    currentPower = power;
}

// --- FUNGSI PEMBARUAN WAKTU ---
function updateSystemTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (systemTimeCardElement) {
        systemTimeCardElement.innerHTML = `${timeString} <br> <span class="text-xs font-normal">${dateString}</span>`;
    }
}

// --- FUNGSI PEMBARUAN STATUS MQTT DI UI ---
function updateMqttStatusIndicatorUI(status, message) {
    if (!mqttStatusIndicatorElement || !mqttStatusTextElement) return;

    mqttStatusIndicatorElement.classList.remove('status-on', 'status-off', 'status-connecting', 'status-error');
    let defaultMessage = '';

    switch (status) {
        case 'connected':
            mqttStatusIndicatorElement.classList.add('status-on');
            defaultMessage = 'Terhubung';
            break;
        case 'disconnected':
            mqttStatusIndicatorElement.classList.add('status-off');
            defaultMessage = 'Terputus';
            break;
        case 'error':
            mqttStatusIndicatorElement.classList.add('status-error');
            defaultMessage = 'Error Koneksi';
            break;
        case 'connecting':
        default:
            mqttStatusIndicatorElement.classList.add('status-connecting');
            defaultMessage = 'Menghubungkan...';
            break;
    }
    mqttStatusTextElement.textContent = message || defaultMessage;
}

// --- FUNGSI PEMBARUAN DATA MOTOR DI UI ---
function updateMotorSpeedUI(speed) {
    const numericSpeed = parseFloat(speed) || 0;
    if (motorSpeedElement) motorSpeedElement.textContent = numericSpeed.toFixed(2);
    addDataToChart(numericSpeed);
    checkMotorStatusForAnalysis();
}

function updateMotorVoltageUI(voltage) {
    const numericVoltage = parseFloat(voltage) || 0;
    const validatedVoltage = Math.max(0, Math.min(numericVoltage, 5000000));
    if (motorVoltageElement) motorVoltageElement.textContent = validatedVoltage.toFixed(2);
}

function updateMotorFrequencyUI(frequency) {
    const numericFrequency = parseFloat(frequency) || 0;
    // Validasi range frequency (0-100 Hz adalah range umum untuk motor)
    const validatedFrequency = Math.max(0, Math.min(numericFrequency, 100000));
    if (motorFrequencyElement) motorFrequencyElement.textContent = `${validatedFrequency.toFixed(2)} Hz`;
}

function updateMotorPowerUI(power) {
    addDataToPowerChart(parseFloat(power) || 0);
}

function updatePidUI(pidData) {
    if (kpValueElement) kpValueElement.textContent = pidData.kp !== undefined ? pidData.kp.toFixed(2) : '-';
    if (kiValueElement) kiValueElement.textContent = pidData.ki !== undefined ? pidData.ki.toFixed(2) : '-';
    if (kdValueElement) kdValueElement.textContent = pidData.kd !== undefined ? pidData.kd.toFixed(2) : '-';
}

// [MODIFIKASI] Fungsi ini sekarang juga akan memperbarui variabel global `currentSetpoint`
function updateSetpointFeedbackUI(setpoint) {
    const numericSetpoint = parseFloat(setpoint) || 0;
    currentSetpoint = numericSetpoint; // Simpan nilai setpoint terbaru

    if (targetRpmFromMotorElement) {
        targetRpmFromMotorElement.textContent = `${numericSetpoint} RPM`;
    }
}

function updateMotorStatusUI(statusString) {
    const receivedStatus = statusString.trim().toLowerCase();
    let uiMotorStatusText = 'MATI';
    let isLightOn = false;

    if (receivedStatus === 'on' || receivedStatus === '1' || receivedStatus === 'true') {
        uiMotorStatusText = 'NYALA';
        isLightOn = true;
    }

    if (motorStatusTextElement) motorStatusTextElement.textContent = uiMotorStatusText;
    if (motorStatusLightElement) {
        motorStatusLightElement.classList.remove('status-on', 'status-off');
        motorStatusLightElement.classList.add(isLightOn ? 'status-on' : 'status-off');
    }
    checkMotorStatusForAnalysis();
}


// --- FUNGSI UNTUK MENAMPILKAN/MENYEMBUNYIKAN TOMBOL ANALISIS GEMINI ---
function checkMotorStatusForAnalysis() {
    if (!motorSpeedElement || !motorStatusTextElement || !analyzeMotorIconButton) return;
    analyzeMotorIconButton.style.display = 'inline-block';
}

// --- FUNGSI MODAL GEMINI ---
function openGeminiModal() {
    if (geminiModal) {
        geminiModal.style.display = 'flex';
        document.body.classList.add('modal-open'); // Add class untuk FAB styling
    }
    if (geminiAnalysisContent) {
        geminiAnalysisContent.innerHTML = '<div class="loader"></div><p class="text-center mt-2">Sedang menganalisis dengan AI...</p>';
    }
}

function closeGeminiModal() {
    if (geminiModal) {
        geminiModal.style.display = 'none';
        document.body.classList.remove('modal-open'); // Remove class
    }
    if (geminiAnalysisContent) {
        geminiAnalysisContent.innerHTML = '<div class="loader"></div>';
    }
}

// --- FUNGSI NOTIFIKASI UI ---
function showUINotification(message, type = 'info', duration = 3500) {
    if (!notificationBanner || !notificationMessageElement) {
        console.warn("Elemen notifikasi tidak ditemukan.");
        return;
    }

    clearTimeout(notificationTimeout);

    notificationMessageElement.textContent = message;

    notificationBanner.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-400', 'bg-blue-400', 'text-white', 'text-slate-800');

    switch (type) {
        case 'success':
            notificationBanner.classList.add('bg-green-500', 'text-white');
            break;
        case 'error':
            notificationBanner.classList.add('bg-red-500', 'text-white');
            break;
        case 'warning':
            notificationBanner.classList.add('bg-yellow-400', 'text-slate-800');
            break;
        case 'info':
        default:
            notificationBanner.classList.add('bg-blue-400', 'text-white');
            break;
    }

    notificationBanner.classList.remove('hidden');
    notificationBanner.classList.remove('-translate-y-full', 'opacity-0', 'scale-95', 'scale-100', 'translate-y-0');
    notificationBanner.classList.remove('transition-all', 'duration-500', 'ease-in-out');

    notificationBanner.style.opacity = '0';
    notificationBanner.style.transform = 'translateX(-50%) translateY(-30px) scale(0.9)';
    notificationBanner.style.transition = 'opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    requestAnimationFrame(() => {
        notificationBanner.style.opacity = '1';
        notificationBanner.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    });

    notificationTimeout = setTimeout(() => {
        notificationBanner.style.opacity = '0';
        notificationBanner.style.transform = 'translateX(-50%) translateY(-30px) scale(0.9)';

        setTimeout(() => {
            if (notificationBanner.style.opacity === '0') {
                notificationBanner.classList.add('hidden');
                notificationBanner.style.transform = '';
                notificationBanner.style.opacity = '';
                notificationBanner.style.transition = '';
                notificationBanner.classList.add('opacity-0', '-translate-y-full');
            }
        }, 400);
    }, duration);
}