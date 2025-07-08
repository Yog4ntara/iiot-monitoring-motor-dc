const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Anda bisa menggunakan model lain jika perlu

// Fungsi untuk mendapatkan API key dari server endpoint (menggunakan .env)
async function getGeminiApiKey() {
    try {
        // Opsi 1: Ambil dari server endpoint (menggunakan environment variable)
        const response = await fetch('/api/gemini/key');
        if (response.ok) {
            const data = await response.json();
            console.log('API key berhasil diambil dari server');
            return data.apiKey;
        } else {
            console.warn('Gagal mengambil API key dari server:', response.status);
        }
    } catch (error) {
        console.warn('Error saat mengambil API key dari server:', error);
    }
    
    // Opsi 2: Fallback ke localStorage 
    let apiKey = localStorage.getItem('GEMINI_API_KEY');
    
    // Opsi 3: Jika tidak ada di localStorage, prompt user (untuk testing)
    if (!apiKey) {
        apiKey = prompt('Masukkan Gemini API Key Anda:');
        if (apiKey) {
            localStorage.setItem('GEMINI_API_KEY', apiKey);
        }
    }
    return apiKey;
}

// Fungsi helper untuk mendapatkan nilai voltage terbaru
function getLatestVoltageValue() {
    // Coba ambil dari chart voltage jika tersedia
    if (typeof motorVoltageChart !== 'undefined' && 
        motorVoltageChart.data && 
        motorVoltageChart.data.datasets && 
        motorVoltageChart.data.datasets[0] && 
        motorVoltageChart.data.datasets[0].data && 
        motorVoltageChart.data.datasets[0].data.length > 0) {
        const voltageData = motorVoltageChart.data.datasets[0].data;
        const latestVoltage = voltageData[voltageData.length - 1];
        return latestVoltage ? latestVoltage.toFixed(2) : 'N/A';
    }
    
    // Jika chart tidak tersedia, coba akses currentVoltage global jika ada
    if (typeof window.currentVoltage !== 'undefined') {
        return window.currentVoltage.toFixed(2);
    }
    
    return 'N/A';
}

// --- FUNGSI ANALISIS DENGAN GEMINI ---
async function handleGeminiAnalysis() {
    openGeminiModal(); // Dari uiHandler.js

    // Dapatkan waktu saat ini untuk analisis
    const analysisTime = new Date();
    const analysisTimeString = analysisTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " - " + analysisTime.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    
    if (geminiAnalysisContent) {
        geminiAnalysisContent.innerHTML = `
            <p class="text-xs text-slate-500 mb-3">Analisis dilakukan pada: ${analysisTimeString}</p>
            <div class="flex flex-col items-center justify-center py-6">
                <div class="loader mb-3"></div>
                <p class="text-center text-sm text-slate-600 dark:text-slate-400">Sedang menganalisis dengan AI...</p>
                <p class="text-center text-xs text-slate-500 mt-1">Mohon tunggu beberapa saat</p>
            </div>
        `;
    }

    // Dapatkan elemen-elemen yang diperlukan dari UI
    const motorData = {
        kecepatanAktual: motorSpeedElement ? motorSpeedElement.textContent.trim() : 'N/A',
        statusOperasional: motorStatusTextElement ? motorStatusTextElement.textContent.trim() : 'N/A',
        targetRpm: targetRpmFromMotorElement ? targetRpmFromMotorElement.textContent.trim() : 'N/A',
        kp: kpValueElement ? kpValueElement.textContent.trim() : 'N/A',
        ki: kiValueElement ? kiValueElement.textContent.trim() : 'N/A',
        kd: kdValueElement ? kdValueElement.textContent.trim() : 'N/A',
        tegangan: getLatestVoltageValue(),
        statusMqtt: mqttStatusTextElement ? mqttStatusTextElement.textContent.trim() : 'N/A'
    };

    // Ambil data dari chart
    let chartDataString = "Data historis tidak tersedia atau grafik kosong.";
    if (typeof motorSpeedChart !== 'undefined' && motorSpeedChart.data.labels.length > 0) {
        const labels = motorSpeedChart.data.labels;
        const speedData = motorSpeedChart.data.datasets[1].data; // Dataset kecepatan aktual
        const setpointData = motorSpeedChart.data.datasets[0].data; // Dataset setpoint
        const lastN = 15;
        const startIndex = Math.max(0, labels.length - lastN);
        
        let historicalDataPoints = [];
        for (let i = startIndex; i < labels.length; i++) {
            historicalDataPoints.push(`- Pukul ${labels[i]}: Aktual ${speedData[i]} RPM, Target ${setpointData[i]} RPM`);
        }
        if (historicalDataPoints.length > 0) {
            chartDataString = "Berikut adalah data historis kecepatan terakhir:\n" + historicalDataPoints.join("\n");
        }
    }

    // Ambil data tegangan historis jika tersedia
    let voltageDataString = "";
    if (typeof motorVoltageChart !== 'undefined' && motorVoltageChart.data.labels.length > 0) {
        const voltageData = motorVoltageChart.data.datasets[0].data;
        const labels = motorVoltageChart.data.labels;
        const lastN = 10;
        const startIndex = Math.max(0, labels.length - lastN);
        
        let voltageDataPoints = [];
        for (let i = startIndex; i < labels.length; i++) {
            voltageDataPoints.push(`- Pukul ${labels[i]}: ${voltageData[i]} V`);
        }
        if (voltageDataPoints.length > 0) {
            voltageDataString = "\n\nData historis tegangan terakhir:\n" + voltageDataPoints.join("\n");
        }
    }

    const prompt = `Anda adalah seorang System Instrumentation and Control Engineering yang berpengalaman dalam monitoring dan troubleshooting Motor DC industri dengan sistem kontrol PID. 

INFORMASI SISTEM SAAT INI (Waktu analisis: ${analysisTimeString}):
═════════════════════════════════════════════════════════════════════════════════
📊 DATA REAL-TIME MOTOR:
- Kecepatan Aktual: ${motorData.kecepatanAktual} RPM
- Target RPM (Setpoint): ${motorData.targetRpm}
- Tegangan Motor: ${motorData.tegangan} V
- Status Operasional: ${motorData.statusOperasional}
- Status Komunikasi MQTT: ${motorData.statusMqtt}

🎛️ PARAMETER PID CONTROLLER:
- Proportional (Kp): ${motorData.kp}
- Integral (Ki): ${motorData.ki}
- Derivative (Kd): ${motorData.kd}

📈 DATA HISTORIS:
${chartDataString}${voltageDataString}

TUGAS ANALISIS:
═════════════════════════════════════════════════════════════════════════════════
Berdasarkan semua data di atas, berikan analisis komprehensif dalam format markdown dengan poin-poin berikut:

## 🔍 **Status Sistem Saat Ini**
- Evaluasi kondisi operasional motor berdasarkan data real-time
- Analisis performa PID controller (response time, overshoot, steady-state error)
- Penilaian kualitas tracking setpoint

## ⚠️ **Identifikasi Masalah (Jika Ada)**
- Deteksi anomali dari tren data historis
- Identifikasi masalah pada sistem kontrol atau hardware
- Analisis penyimpangan dari parameter normal

## 🔧 **Diagnosis dan Rekomendasi**
- Langkah pemeriksaan yang perlu dilakukan operator
- Rekomendasi penyesuaian parameter PID (jika diperlukan)
- Tindakan korektif atau preventif yang disarankan

## 📊 **Kesimpulan Teknis**
- Ringkasan kondisi sistem secara keseluruhan
- Prediksi performa jangka pendek
- Rekomendasi monitoring lanjutan

CATATAN: Jika sistem beroperasi normal, berikan konfirmasi dan jelaskan karakteristik operasi yang sedang berlangsung. Gunakan Bahasa Indonesia yang jelas dan teknis yang mudah dipahami operator.`;

    try {
        const apiKey = await getGeminiApiKey();
        
        if (!apiKey) {
            throw new Error('API Key Gemini tidak ditemukan. Silakan set API key terlebih dahulu.');
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME}:generateContent?key=${apiKey}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error Response:", errorData);
            let errorMessage = `API Error: ${response.status} ${response.statusText}.`;
            if (errorData.error && errorData.error.message) {
                errorMessage += ` Detail: ${errorData.error.message}`;
            }
            if (errorData.error && errorData.error.details) {
                 errorData.error.details.forEach(detail => {
                    if (detail['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo') {
                        errorMessage += ` Reason: ${detail.reason}. Domain: ${detail.domain}. Metadata: ${JSON.stringify(detail.metadata)}.`;
                    }
                });
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // Tampilkan waktu analisis lagi bersama dengan hasil
        const timePrefix = `<p class="text-xs text-slate-500 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Analisis dilakukan pada: ${analysisTimeString}</p>`;

        if (geminiAnalysisContent) {
            if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            let text = result.candidates[0].content.parts[0].text;

            // Konversi **text** menjadi bold <strong>text</strong>
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Konversi markdown headers ## menjadi HTML headers
            text = text.replace(/^## (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-blue-600 dark:text-blue-400">$1</h3>');
            
            // Konversi "*" pada paragraf menjadi list numbered
            text = text.replace(/^\d+\.\s/gm, '<br><strong>$&</strong> '); // Menambahkan <br> sebelum setiap nomor list
            text = text.replace(/^\*\s/gm, '<br><strong>•</strong> '); // Mengganti bullet point dengan <strong>•</strong>
            text = text.replace(/^- /gm, '<br><strong>•</strong> '); // Handle dash bullets juga
            
            // Ganti newline dengan <br> untuk pemformatan paragraf
            let htmlText = text.trim().replace(/\n/g, '<br>');

            geminiAnalysisContent.innerHTML = timePrefix + `<div class="analysis-content">${htmlText}</div>`; // Gabungkan waktu dengan hasil analisis

            } else {
            console.error("Unexpected Gemini API response structure:", result);
            geminiAnalysisContent.innerHTML = timePrefix + "<div class='text-red-500'>Gagal mendapatkan analisis dari AI. Struktur respons tidak sesuai.</div>";
            if (result.promptFeedback && result.promptFeedback.blockReason) {
                geminiAnalysisContent.innerHTML += `<br><span class="text-red-600">Alasan pemblokiran prompt: ${result.promptFeedback.blockReason}</span>`;
            }
            }
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const timePrefixOnError = `<p class="text-xs text-slate-500 mb-2">Analisis pada: ${analysisTimeString}</p>`;
        if (geminiAnalysisContent) {
            geminiAnalysisContent.innerHTML = timePrefixOnError + `<p class="text-red-500 font-semibold">Terjadi kesalahan saat menghubungi AI:</p><p class="text-red-700 text-sm mt-1">${error.message}</p><p class="mt-2 text-xs">Pastikan kunci API valid, koneksi internet stabil, dan tidak ada masalah dengan kuota API Anda.</p>`;
        }
    }
}
