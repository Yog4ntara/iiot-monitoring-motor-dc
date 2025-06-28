const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Anda bisa menggunakan model lain jika perlu
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Pastikan Anda sudah mengatur kunci API ini di environment variables

// --- FUNGSI ANALISIS DENGAN GEMINI ---
async function handleGeminiAnalysis() {
    openGeminiModal(); // Dari uiHandler.js

    // Dapatkan waktu saat ini untuk analisis
    const analysisTime = new Date();
    const analysisTimeString = analysisTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " - " + analysisTime.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    
    if (geminiAnalysisContent) {
        geminiAnalysisContent.innerHTML = `<p class="text-xs text-slate-500 mb-2">Analisis dilakukan pada: ${analysisTimeString}</p><div class="loader"></div><p class="text-center mt-2">Sedang menganalisis dengan AI...</p>`;
    }

    // Dapatkan elemen-elemen yang diperlukan dari UI
    const motorData = {
        kecepatanAktual: motorSpeedElement ? motorSpeedElement.textContent.trim() : 'N/A',
        statusOperasional: motorStatusTextElement ? motorStatusTextElement.textContent.trim() : 'N/A',
        targetRpm: targetRpmFromMotorElement ? targetRpmFromMotorElement.textContent.trim() : 'N/A',
        kp: kpValueElement ? kpValueElement.textContent.trim() : 'N/A',
        ki: kiValueElement ? kiValueElement.textContent.trim() : 'N/A',
        kd: kdValueElement ? kdValueElement.textContent.trim() : 'N/A'
    };

    // Ambil data dari chart
    let chartDataString = "Data historis kecepatan tidak tersedia atau grafik kosong.";
    if (typeof motorSpeedChart !== 'undefined' && motorSpeedChart.data.labels.length > 0) {
        const labels = motorSpeedChart.data.labels;
        const speeds = motorSpeedChart.data.datasets[0].data;
        const lastN = 20;
        const startIndex = Math.max(0, labels.length - lastN);
        
        let historicalDataPoints = [];
        for (let i = startIndex; i < labels.length; i++) {
            historicalDataPoints.push(`- Pukul ${labels[i]}: ${speeds[i]} RPM`);
        }
        if (historicalDataPoints.length > 0) {
            chartDataString = "Berikut adalah beberapa data kecepatan historis terakhir (RPM):\n" + historicalDataPoints.join("\n");
        }
    }

    const prompt = `Anda adalah seorang System Instrumentation and Control Engineering yang sedang menjaga suatu Motor DC industri. 
Data motor saat ini (pada waktu analisis: ${analysisTimeString}):
- Kecepatan Aktual: ${motorData.kecepatanAktual}
- Status Operasional: ${motorData.statusOperasional}
- Target RPM (dari Motor): ${motorData.targetRpm}
- Kp: ${motorData.kp}, Ki: ${motorData.ki}, Kd: ${motorData.kd}

${chartDataString}

Motor ini dilaporkan dalam kondisi "${motorData.statusOperasional}" dan kecepatan "${motorData.kecepatanAktual}".
Berdasarkan semua data di atas (data aktual dan historis), berikan analisis singkat dalam poin-poin (gunakan format markdown untuk poin):

Membahas Problem dan analisis:
1.  Kemungkinan penyebab umum masalah ini (jika ada masalah terdeteksi dari tren historis atau data aktual).
2.  Langkah-langkah pemeriksaan awal yang disarankan untuk operator berdasarkan analisis data.
3.  Rekomendasi umum untuk tindakan selanjutnya.
4.  Jika tidak ada masalah signifikan yang terdeteksi, berikan konfirmasi bahwa motor beroperasi dalam batas normal atau sesuai ekspektasi berdasarkan data dan tren historis, dan jelaskan secara singkat apa yang sedang terjadi (misal: motor stabil pada setpoint, sedang dalam transisi, baru dinyalakan, dll.).

Jawaban harus dalam Bahasa Indonesia yang jelas dan mudah dimengerti. Format output harus berupa poin-poin markdown.`;

    try {
        const apiKey = GEMINI_API_KEY;
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
        const timePrefix = `<p class="text-xs text-slate-500 mb-2">Analisis dilakukan pada: ${analysisTimeString}</p>`;

        if (geminiAnalysisContent) {
            if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            let text = result.candidates[0].content.parts[0].text;

            // Konversi **text** menjadi bold <strong>text</strong>
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Konversi "*" pada paragraf menjadi list numbered
            text = text.replace(/^\d+\.\s/gm, '<br><strong>$&</strong> '); // Menambahkan <br> sebelum setiap nomor list
            text = text.replace(/^\*\s/gm, '<br><strong>•</strong> '); // Mengganti bullet point dengan <strong>•</strong>
            
            
            // Ganti newline dengan <br> untuk pemformatan paragraf
            let htmlText = text.trim().replace(/\n/g, '<br>');

            geminiAnalysisContent.innerHTML = timePrefix + htmlText; // Gabungkan waktu dengan hasil analisis

            } else {
            console.error("Unexpected Gemini API response structure:", result);
            geminiAnalysisContent.innerHTML = timePrefix + "Gagal mendapatkan analisis dari AI. Struktur respons tidak sesuai.";
            if (result.promptFeedback && result.promptFeedback.blockReason) {
                // Menggunakan textContent untuk bagian ini agar tidak merusak HTML yang sudah ada (timePrefix)
                geminiAnalysisContent.innerHTML += `<br>Alasan pemblokiran prompt: ${result.promptFeedback.blockReason}`;
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
