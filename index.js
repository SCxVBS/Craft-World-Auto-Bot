const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const { web3Login } = require('./auth'); 

const colors = {
    reset: "\x1b[0m", cyan: "\x1b[36m", green: "\x1b[32m",
    yellow: "\x1b[33m", red: "\x1b[31m", white: "\x1b[37m", bold: "\x1b[1m"
};

process.removeAllListeners('warning');

const logger = {
    info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.white}${colors.bold}[➤] ${msg}${colors.reset}`),
    banner: () => {
        const bannerText = `
███████╗ ██████╗██╗  ██╗██╗   ██╗██████╗ ███████╗
██╔════╝██╔════╝╚██╗██╔╝██║   ██║██╔══██╗██╔════╝
███████╗██║      ╚███╔╝ ╚██╗ ██╔╝██████╔╝███████╗
╚════██║██║      ██╔██╗  ╚████╔╝ ██╔══██╗╚════██║
███████║╚██████╗██╔╝ ██╗  ╚██╔╝  ██████╔╝███████║
╚══════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝
`;
        console.log(`${colors.cyan}${colors.bold}${bannerText}${colors.reset}`);
        console.log(`\n${colors.white}=======================================================${colors.reset}`);
        console.log(`${colors.white}          Bot by SCxVBS | Telegram: t.me/scxvbs`);
        console.log(`${colors.white}=======================================================${colors.reset}\n`);
    }
};

async function readConfig() {
    try {
        const data = await fs.readFile('config.json', 'utf8');
        const config = JSON.parse(data);
        // Menambahkan status awal untuk setiap aset
        if (config.assets && Array.isArray(config.assets)) {
            config.assets = config.assets.map(asset => ({
                ...asset,
                status: 'idle', // 'idle', 'running'
                nextActionTime: Date.now(), // Waktu kapan aksi berikutnya bisa dilakukan
            }));
        }
        return config;
    } catch (error) {
        logger.error('Error membaca config.json: ' + error.message);
        return null;
    }
}

class CraftWorldBot {
    constructor(config) {
        this.accountName = config.name || "My Account";
        this.assets = config.assets || [];

        this.baseURL = 'https://preview.craft-world.gg/api/1/user-actions/ingest';
        this.authToken = null;
        this.isRunning = false;
        this.headers = {
            "accept": "*/*", "accept-language": "en-US,en;q=0.7", "content-type": "application/json", 
            "priority": "u=1, i", "sec-ch-ua-mobile": "?0", "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin", "sec-gpc": "1", 
            "x-app-version": "0.33.7", "Referer": "https://preview.craft-world.gg/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        };
    }

    setAuthToken(token) {
        this.authToken = token.startsWith('Bearer jwt_') ? token : `Bearer jwt_${token}`;
        this.headers.authorization = this.authToken;
        logger.success(`Auth token set successfully for ${this.accountName}`);
    }
    
    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async #performAction(actionType, payloadData, entityId) {
        try {
            const actionId = uuidv4();
            const payload = { data: [{ id: actionId, actionType, payload: payloadData, time: Date.now() }] };
            const userAgent = '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"';
            this.headers['sec-ch-ua'] = userAgent;
            this.headers['sec-ch-ua-platform'] = '"Windows"';

            const response = await axios.post(this.baseURL, payload, { headers: this.headers });
            if (response.data?.data?.processed?.includes(actionId)) {
                logger.success(`${actionType} berhasil untuk ID: ${entityId}`);
                return response.data.data;
            }
            logger.warn(`${actionType} untuk ID ${entityId} tidak terproses oleh server.`);
            return null;
        } catch (error) {
            const errMsg = error.response ? `Status ${error.response.status}` : error.message;
            logger.error(`Gagal ${actionType} untuk ID ${entityId}: ${errMsg}`);
            if (error.response?.status === 400) {
                // Jika error 400, mungkin karena cooldown. Coba lagi setelah beberapa menit.
                logger.warn(`Kemungkinan cooldown untuk ID ${entityId}. Mencoba lagi dalam 5 menit.`);
                return 'cooldown';
            }
            return null;
        }
    }

    // Interval dalam milidetik
    async startBotLoop(mineDuration = 60000, factoryCooldown = 3600000, areaCooldown = 3600000, checkInterval = 5000) {
        if (!this.authToken) {
            logger.error(`Bot tidak dapat dimulai. Token otentikasi tidak ada.`);
            return;
        }
        this.isRunning = true;
        logger.info("Bot pintar dimulai... Memeriksa status aset secara berkala.");

        while (this.isRunning) {
            for (const asset of this.assets) {
                if (Date.now() < asset.nextActionTime) {
                    continue; // Lewati jika belum waktunya
                }

                logger.loading(`Memproses ${asset.type} dengan ID: ${asset.id}`);

                let result = null;
                switch (asset.type) {
                    case 'mine':
                        if (asset.status === 'idle') {
                            result = await this.#performAction("START_MINE", { mineId: asset.id }, asset.id);
                            if (result) {
                                asset.status = 'running';
                                asset.nextActionTime = Date.now() + mineDuration;
                                logger.info(`Mine ${asset.id} dimulai, claim dalam ${mineDuration / 1000} detik.`);
                            }
                        } else if (asset.status === 'running') {
                            result = await this.#performAction("CLAIM_MINE", { mineId: asset.id }, asset.id);
                            if (result) {
                                asset.status = 'idle';
                                asset.nextActionTime = Date.now(); // Bisa langsung start lagi
                            }
                        }
                        break;
                    case 'factory':
                        result = await this.#performAction("START_FACTORY", { factoryId: asset.id }, asset.id);
                        if (result) {
                            asset.nextActionTime = Date.now() + factoryCooldown;
                            logger.info(`Factory ${asset.id} dimulai, aksi berikutnya dalam ${factoryCooldown / 1000 / 60} menit.`);
                        }
                        break;
                    case 'area':
                        result = await this.#performAction("CLAIM_AREA", { areaId: asset.id, amountToClaim: 1 }, asset.id);
                        if (result) {
                            asset.nextActionTime = Date.now() + areaCooldown;
                            logger.info(`Area ${asset.id} diklaim, aksi berikutnya dalam ${areaCooldown / 1000 / 60} menit.`);
                        }
                        break;
                }

                // Jika error 400 (cooldown), set waktu tunggu
                if (result === 'cooldown') {
                    asset.nextActionTime = Date.now() + 300000; // Coba lagi dalam 5 menit
                }

                await this.sleep(1000); // Jeda 1 detik antar request agar tidak spam server
            }
            
            await this.sleep(checkInterval); // Tunggu sebelum memeriksa seluruh daftar aset lagi
        }
    }
}

async function main() {
    logger.banner();
    const config = await readConfig();
    if (!config || !config.assets || config.assets.length === 0) {
        logger.error("Tidak ada 'assets' yang ditemukan di config.json atau format salah. Bot tidak bisa berjalan.");
        return;
    }
    logger.info(`Konfigurasi untuk "${config.name || 'Default Account'}" dimuat.`);
    logger.info(`Ditemukan total ${config.assets.length} aset.`);

    try {
        const bot = new CraftWorldBot(config);
        
        logger.loading('Mendapatkan token otentikasi awal...');
        const initialToken = await web3Login();
        bot.setAuthToken(initialToken);
        
        // Atur durasi & cooldown di sini (dalam milidetik)
        // mineDuration: 60 detik, factoryCooldown: 1 jam, areaCooldown: 1 jam, checkInterval: 10 detik
        bot.startBotLoop(60000, 3600000, 3600000, 10000);

    } catch (error) {
        logger.error(`Error utama: ${error.message}`);
    }
}

if (require.main === module) {
    main().catch(error => {
        logger.error(`Error utama yang tidak tertangani: ${error.message}`);
    });
}
