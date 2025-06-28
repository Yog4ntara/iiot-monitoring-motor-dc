// Alamat base URL dari backend server Anda
const API_BASE_URL = 'http://localhost:3000';

/**
 * Mengambil semua log motor dari backend server.
 */
async function loadLogsFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logs`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const logs = await response.json();
        
        // Panggil fungsi UI untuk menampilkan data
        displayMotorLogs(logs); // Dari ui_handler.js

    } catch (error) {
        console.error("Failed to fetch logs:", error);
        showUINotification("Gagal memuat log dari server.", "error");
        // Tampilkan pesan error di container log
        if(dataLogContainer) {
            dataLogContainer.innerHTML = '<p class="text-red-500 text-center py-4">Gagal memuat log dari server.</p>';
        }
    }
}

/**
 * Mengirim snapshot data motor saat ini ke backend server untuk disimpan.
 */
async function saveMotorSnapshot() {
     // Kumpulkan data dari UI
    const currentData = {
        speed: parseFloat(motorSpeedElement.textContent) || 0,
        status: motorStatusTextElement.textContent.trim(),
        targetRpm: parseFloat(targetRpmFromMotorElement.textContent) || 0,
        pid: {
            kp: parseFloat(kpValueElement.textContent) || 0,
            ki: parseFloat(kiValueElement.textContent) || 0,
            kd: parseFloat(kdValueElement.textContent) || 0
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const newLog = await response.json();
        console.log("Data saved successfully:", newLog);
        showUINotification("Data berhasil disimpan ke database.", "success");
        loadLogsFromServer();

    } catch (error) {
        console.error("Failed to save snapshot:", error);
        showUINotification(`Gagal menyimpan data: ${error.message}`, "error");
    }
}
