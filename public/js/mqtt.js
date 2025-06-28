// --- KONFIGURASI MQTT ---
const MQTT_BROKER_URL = 'ws://localhost:9002'; // Pastikan port ini sesuai
const MQTT_CLIENT_ID = 'dashboard_client_' + Math.random().toString(16  ).substr(2, 8);

const TOPIC_SPEED_FEEDBACK = 'fb/speed';
const TOPIC_VOLTAGE_FEEDBACK = 'fb/vol';
const TOPIC_FREQUENCY_FEEDBACK = 'fb/freq';
const TOPIC_POWER_FEEDBACK = 'fb/power';
const TOPIC_KP_FEEDBACK = 'fb/kp';
const TOPIC_KI_FEEDBACK = 'fb/ki';
const TOPIC_KD_FEEDBACK = 'fb/kd';
const TOPIC_SETPOINT_FEEDBACK = 'fb/sp';
const TOPIC_STATUS_FEEDBACK = 'fb/status';
const TOPIC_SETPOINT_COMMAND = 'cmd/sp';

let mqttClient = null;

// Variabel untuk menyimpan nilai PID terpisah
let pidValues = {
    kp: null,
    ki: null,
    kd: null
};

// --- FUNGSI KONEKSI MQTT ---
function connectToMqttBroker() {
    updateMqttStatusIndicatorUI('connecting', `Menghubungkan ke ${MQTT_BROKER_URL}...`); // Dari uiHandler.js
    console.log(`Mencoba terhubung ke MQTT Broker: ${MQTT_BROKER_URL}`);

    if (typeof mqtt === 'undefined') {
        console.error("MQTT.js library tidak ditemukan. Pastikan sudah dimuat di HTML.");
        updateMqttStatusIndicatorUI('error', 'MQTT Library Gagal Dimuat'); // Dari uiHandler.js
        return;
    }

        const options = {
        clientId: MQTT_CLIENT_ID,
        keepalive: 60,
    };

    mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

    mqttClient.on('connect', () => {        console.log('Terhubung ke MQTT Broker!');
        updateMqttStatusIndicatorUI('connected'); // Dari uiHandler.js
        checkMotorStatusForAnalysis(); // Panggil dari uiHandler.js untuk status awal        
        const topicsToSubscribe = [
            TOPIC_SPEED_FEEDBACK,
            TOPIC_VOLTAGE_FEEDBACK,
            TOPIC_FREQUENCY_FEEDBACK,
            TOPIC_POWER_FEEDBACK,
            TOPIC_KP_FEEDBACK,
            TOPIC_KI_FEEDBACK,
            TOPIC_KD_FEEDBACK,
            TOPIC_SETPOINT_FEEDBACK,
            TOPIC_STATUS_FEEDBACK
        ];

        topicsToSubscribe.forEach(topic => {
            mqttClient.subscribe(topic, (err) => {
                if (err) {
                    console.error(`Gagal subscribe ke ${topic}:`, err);
                } else {
                    console.log(`Berhasil subscribe ke ${topic}`);
                }
            });
        });
    });

    mqttClient.on('error', (err) => {
        console.error('Koneksi MQTT Error:', err);
        updateMqttStatusIndicatorUI('error', 'Koneksi Gagal'); // Dari uiHandler.js
    });

    mqttClient.on('reconnect', () => {
        console.log('Mencoba menghubungkan ulang ke MQTT Broker...');
        updateMqttStatusIndicatorUI('connecting', 'Menghubungkan ulang...'); // Dari uiHandler.js
    });

    mqttClient.on('close', () => {
        console.log('Koneksi MQTT ditutup.');
        if (mqttStatusIndicatorElement && (mqttStatusIndicatorElement.classList.contains('status-on') || mqttStatusIndicatorElement.classList.contains('status-connecting'))) {
            updateMqttStatusIndicatorUI('disconnected', 'Koneksi Terputus'); // Dari uiHandler.js
        }
    });    mqttClient.on('message', (topic, message) => {
        const messageString = message.toString();
        console.log(`Pesan diterima dari topik ${topic}: ${messageString}`);

        try {            switch (topic) {
                case TOPIC_SPEED_FEEDBACK:
                    const speedValue = parseMessageValue(messageString, 'speed');
                    updateMotorSpeedUI(speedValue); // Dari uiHandler.js
                    break;                case TOPIC_VOLTAGE_FEEDBACK:
                    const voltageValue = parseMessageValue(messageString, 'vol');
                    console.log(`[MQTT] Voltage received: ${voltageValue} V`);
                    updateMotorVoltageUI(voltageValue); // Dari uiHandler.js
                    break;

                case TOPIC_FREQUENCY_FEEDBACK:
                    const frequencyValue = parseMessageValue(messageString, 'freq');
                    console.log(`[MQTT] Frequency received: ${frequencyValue} Hz`);
                    updateMotorFrequencyUI(frequencyValue); // Dari uiHandler.js
                    break;

                case TOPIC_POWER_FEEDBACK:
                    const powerValue = parseMessageValue(messageString, 'power');
                    console.log(`[MQTT] Power received: ${powerValue} W`);
                    updateMotorPowerUI(powerValue); // Dari uiHandler.js
                    break;
                case TOPIC_KP_FEEDBACK:
                    const kpValue = parseMessageValue(messageString, 'kp');
                    pidValues.kp = parseFloat(kpValue);
                    updatePidUIFromSeparateTopics(); // Fungsi baru untuk update PID UI
                    break;
                case TOPIC_KI_FEEDBACK:
                    const kiValue = parseMessageValue(messageString, 'ki');
                    pidValues.ki = parseFloat(kiValue);
                    updatePidUIFromSeparateTopics(); // Fungsi baru untuk update PID UI
                    break;
                case TOPIC_KD_FEEDBACK:
                    const kdValue = parseMessageValue(messageString, 'kd');
                    pidValues.kd = parseFloat(kdValue);
                    updatePidUIFromSeparateTopics(); // Fungsi baru untuk update PID UI
                    break;                case TOPIC_SETPOINT_FEEDBACK:
                    const setpointValue = parseMessageValue(messageString, 'sp');
                    updateSetpointFeedbackUI(setpointValue); // Dari uiHandler.js
                    break;
                case TOPIC_STATUS_FEEDBACK:
                    const statusValue = parseMessageValue(messageString, 'status');
                    updateMotorStatusUI(statusValue); // Dari uiHandler.js
                    break;
                default:
                    console.warn(`Pesan dari topik tidak dikenal: ${topic}`);
            }
        } catch (e) {
            console.error("Gagal memproses pesan MQTT:", e, "Topik:", topic, "Pesan:", messageString);
        }
    });
}

// --- FUNGSI HELPER UNTUK PARSING PESAN ---
function parseMessageValue(messageString, key) {
    try {
        // Coba parsing sebagai JSON terlebih dahulu
        const parsedJson = JSON.parse(messageString);
        
        // Jika berhasil di-parse sebagai JSON, ambil nilai berdasarkan key
        if (parsedJson && typeof parsedJson === 'object' && parsedJson.hasOwnProperty(key)) {
            return parsedJson[key].toString();
        }
        
        // Jika JSON tidak memiliki key yang diharapkan, return pesan asli
        return messageString;
    } catch (e) {
        // Jika gagal parsing JSON (format lama), return pesan asli
        return messageString;
    }
}

// --- FUNGSI HELPER UNTUK UPDATE PID UI DARI TOPIK TERPISAH ---
function updatePidUIFromSeparateTopics() {
    // Hanya update UI jika semua nilai PID sudah tersedia
    if (pidValues.kp !== null && pidValues.ki !== null && pidValues.kd !== null) {
        const pidData = {
            kp: pidValues.kp,
            ki: pidValues.ki,
            kd: pidValues.kd
        };
        updatePidUI(pidData); // Panggil fungsi yang sudah ada dari uiHandler.js
    }
}

// --- FUNGSI PUBLISH SETPOINT ---
function publishSetpoint(targetSetpointValue) {
    if (!mqttClient || !mqttClient.connected) {
        console.warn("Tidak terhubung ke MQTT Broker. Tidak dapat mengirim setpoint.");
        showUINotification("Tidak terhubung ke MQTT Broker. Gagal mengirim setpoint.", "error"); // Panggil notifikasi dari uiHandler.js
        return;
    }

    // Format data sebagai JSON dengan key "cmd_sp"
    const setpointData = {
        cmd_sp: parseFloat(targetSetpointValue) || 0
    };
    const jsonMessage = JSON.stringify(setpointData);

    mqttClient.publish(TOPIC_SETPOINT_COMMAND, jsonMessage, { qos: 0, retain: false }, (error) => {
        if (error) {
            console.error('Gagal mengirim setpoint:', error);
            showUINotification(`Gagal mengirim setpoint: ${error.message}`, "error"); // Panggil notifikasi
        } else {
            console.log(`Setpoint ${targetSetpointValue} RPM berhasil dikirim ke topik ${TOPIC_SETPOINT_COMMAND} dengan format JSON: ${jsonMessage}`);
            showUINotification(`Setpoint ${targetSetpointValue} RPM telah dikirim.`, "success"); // Panggil notifikasi
        }
    });
}
