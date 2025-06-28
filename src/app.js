// Import package yang dibutuhkan
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const mqtt = require('mqtt'); // Import library MQTT

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
// Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Konfigurasi koneksi ke database PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: "",
    port: process.env.DB_PORT,
});

// Variabel untuk menyimpan status terakhir dari motor
let currentMotorState = {
    speed: 0,
    voltage: 0,
    frequency: 0,
    power: 0,
    status: 'UNKNOWN',
    targetRpm: 0,
    pid: {
        kp: 0,
        ki: 0,
        kd: 0
    }
};

/**
 Fungsi untuk menyimpan status motor saat ini ke database PostgreSQL.
 */
async function saveCurrentStateToDb() {
    const { speed, voltage, frequency, power, status, targetRpm, pid } = currentMotorState;
    const { kp, ki, kd } = pid;
    console.log('[Database] Preparing to save motor state:', currentMotorState);

    const queryText = 'INSERT INTO motor_logs(speed, voltage, frequency, power, status, target_rpm, kp, ki, kd) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)';
    const values = [speed, voltage, frequency, power, status, targetRpm, kp, ki, kd];
    
    console.log('[Database] Query values:', values);

    try {
        const result = await pool.query(queryText, values);
        console.log('[Database] Log saved successfully. Affected rows:', result.rowCount);
    } catch (err) {
        console.error('[Database] Error saving state:', err);
        console.error('[Database] Failed query values:', values);
    }
}

/**
 * Fungsi untuk memastikan data voltage tersimpan secara periodik
 * jika tidak ada update speed dalam waktu tertentu
 */
let lastDataSaveTime = Date.now();
let dataSaveInterval = null;

function startPeriodicDataSave() {
    // Clear interval yang sudah ada
    if (dataSaveInterval) {
        clearInterval(dataSaveInterval);
    }
    
    // Set interval untuk save data setiap 30 detik jika tidak ada update speed
    dataSaveInterval = setInterval(() => {
        const timeSinceLastSave = Date.now() - lastDataSaveTime;
        
        // Jika sudah lebih dari 30 detik tidak ada update, save data terakhir
        if (timeSinceLastSave > 30000) {
            console.log('[Database] Periodic save - ensuring latest data is saved');
            saveCurrentStateToDb();
            lastDataSaveTime = Date.now();
        }
    }, 35000); // Check setiap 35 detik
    
    console.log('[Database] Periodic data save started - will save every 30 seconds if no updates');
}

/**
 * Fungsi helper untuk parsing pesan JSON atau nilai langsung
 * @param {string} messageString - Pesan yang diterima dari MQTT
 * @param {string} key - Key yang dicari dalam JSON
 * @returns {string} - Nilai yang sudah diparsing
 */
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

/**
 * Fungsi untuk terhubung ke MQTT broker dan mendengarkan topik.
 */
function initializeMqttListener() {
    const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost';
    const MQTT_CLIENT_ID = 'backend_logger_' + Math.random().toString(16).substr(2, 8);    const topics = [
        'fb/speed',
        'fb/vol',
        'fb/freq',
        'fb/power',
        'fb/kp',
        'fb/ki', 
        'fb/kd',
        'fb/sp',
        'fb/status'
    ];

    console.log(`[MQTT] Connecting to broker at ${MQTT_BROKER_URL}...`);
    const mqttClient = mqtt.connect(MQTT_BROKER_URL, { clientId: MQTT_CLIENT_ID });    mqttClient.on('connect', () => {
        console.log('[MQTT] Backend successfully connected to MQTT Broker.');
        mqttClient.subscribe(topics, (err) => {
            if (err) {
                console.error('[MQTT] Subscription error:', err);
            } else {
                console.log('[MQTT] Subscribed to motor topics:', topics);
                // Mulai periodic data save setelah terhubung MQTT
                startPeriodicDataSave();
            }
        });
    });

    mqttClient.on('message', (topic, message) => {
        const messageString = message.toString();
        console.log(`[MQTT] Message received on topic ${topic}: ${messageString}`);        try {            
            switch (topic) {                
                case 'fb/speed':
                    const speedValue = parseMessageValue(messageString, 'speed');
                    const newSpeed = parseFloat(speedValue) || 0;
                    if (currentMotorState.speed !== newSpeed) {
                        currentMotorState.speed = newSpeed;
                        setTimeout(() => {
                            saveCurrentStateToDb();
                            lastDataSaveTime = Date.now(); // Update timestamp terakhir save
                        }, 100); // Delay 100ms
                    }
                    break;                case 'fb/vol':
                    const voltageValue = parseMessageValue(messageString, 'vol');
                    const newVoltage = parseFloat(voltageValue) || 0;
                    if (currentMotorState.voltage !== newVoltage) {
                        currentMotorState.voltage = newVoltage;
                        console.log(`[MQTT] Updated voltage to: ${currentMotorState.voltage}V`);
                        // Trigger save jika ada perubahan voltage yang signifikan
                        setTimeout(() => {
                            saveCurrentStateToDb();
                            lastDataSaveTime = Date.now();
                        }, 150);
                    }
                    break;

                case 'fb/freq':
                    const frequencyValue = parseMessageValue(messageString, 'freq');
                    const newFrequency = parseFloat(frequencyValue) || 0;
                    if (currentMotorState.frequency !== newFrequency) {
                        currentMotorState.frequency = newFrequency;
                        console.log(`[MQTT] Updated frequency to: ${currentMotorState.frequency}Hz`);
                        // Trigger save jika ada perubahan frequency
                        setTimeout(() => {
                            saveCurrentStateToDb();
                            lastDataSaveTime = Date.now();
                        }, 200);
                    }
                    break;

                case 'fb/power':
                    const powerValue = parseMessageValue(messageString, 'power');
                    const newPower = parseFloat(powerValue) || 0;
                    if (currentMotorState.power !== newPower) {
                        currentMotorState.power = newPower;
                        console.log(`[MQTT] Updated power to: ${currentMotorState.power}W`);
                        // Trigger save jika ada perubahan power
                        setTimeout(() => {
                            saveCurrentStateToDb();
                            lastDataSaveTime = Date.now();
                        }, 250);
                    }
                    break;
                    
                case 'fb/kp':
                    const kpValue = parseMessageValue(messageString, 'kp');
                    currentMotorState.pid.kp = parseFloat(kpValue) || 0;
                    console.log(`[MQTT] Updated KP to: ${currentMotorState.pid.kp}`);
                    break;
                    
                case 'fb/ki':
                    const kiValue = parseMessageValue(messageString, 'ki');
                    currentMotorState.pid.ki = parseFloat(kiValue) || 0;
                    console.log(`[MQTT] Updated KI to: ${currentMotorState.pid.ki}`);
                    break;
                    
                case 'fb/kd':
                    const kdValue = parseMessageValue(messageString, 'kd');
                    currentMotorState.pid.kd = parseFloat(kdValue) || 0;
                    console.log(`[MQTT] Updated KD to: ${currentMotorState.pid.kd}`);
                    break;                case 'fb/sp':
                    const setpointValue = parseMessageValue(messageString, 'sp');
                    currentMotorState.targetRpm = parseFloat(setpointValue) || 0;
                    console.log(`[MQTT] Updated target RPM to: ${currentMotorState.targetRpm}`);
                    break;
                    
                case 'fb/status':
                    const statusValue = parseMessageValue(messageString, 'status');
                    const status = statusValue.trim().toLowerCase();
                    // Mengubah status untuk mendukung format boolean dan string
                    const newStatus = (status === 'on' || status === '1' || status === 'true') ? 'ON' : 'OFF';
                    if (currentMotorState.status !== newStatus) {
                        currentMotorState.status = newStatus;
                        console.log(`[MQTT] Updated status to: ${currentMotorState.status}`);
                        // Trigger save untuk perubahan status
                        setTimeout(() => {
                            saveCurrentStateToDb();
                            lastDataSaveTime = Date.now();
                        }, 300);
                    }
                    break;
            }
        } catch (e) {
            console.error(`[MQTT] Error processing message on topic ${topic}:`, e);
        }
    });

    mqttClient.on('error', (err) => console.error('[MQTT] Connection error:', err));
    mqttClient.on('close', () => console.warn('[MQTT] Connection to broker closed.'));
}

// API ENDPOINTS
// Endpoint untuk mendapatkan status motor saat ini
app.get('/api/motor/current', (req, res) => {
    res.json(currentMotorState);
});

// Endpoint untuk testing - manually trigger database save
app.post('/api/motor/save', async (req, res) => {
    try {
        await saveCurrentStateToDb();
        res.json({ 
            success: true, 
            message: 'Data saved successfully', 
            currentState: currentMotorState 
        });
    } catch (err) {
        console.error('Error manually saving data:', err);
        res.status(500).json({ error: 'Failed to save data', details: err.message });
    }
});

// Endpoint untuk debugging - get latest database entry
app.get('/api/logs/latest', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM motor_logs ORDER BY timestamp DESC LIMIT 1');
        res.json(result.rows[0] || null);
    } catch (err) {
        console.error('Error fetching latest log:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM motor_logs ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { speed, voltage, frequency, power, status, targetRpm, pid } = req.body;
        if (typeof speed === 'undefined' || typeof voltage === 'undefined' || typeof frequency === 'undefined' || typeof power === 'undefined' || !status || typeof targetRpm === 'undefined' || !pid) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const { kp, ki, kd } = pid;
        const queryText = 'INSERT INTO motor_logs(speed, voltage, frequency, power, status, target_rpm, kp, ki, kd) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';
        const values = [speed, voltage, frequency, power, status, targetRpm, kp, ki, kd];
        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error saving manual log:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Rute utama untuk menyajikan frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// MENJALANKAN SERVER
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    initializeMqttListener();
    startPeriodicDataSave();
});