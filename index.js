const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

// Pastikan file auth.js ada di folder yang sama dan berfungsi dengan benar.
const { web3Login } = require('./auth'); 

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m"
};

// Menghapus listener peringatan yang tidak perlu untuk output yang lebih bersih
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
        return JSON.parse(data);
    } catch (error) {
        logger.error('Error membaca config.json: ' + error.message);
        return null;
    }
}

class CraftWorldBot {
    constructor(config) {
        this.accountName = config.name || "My Account";
        this.mineIds = config.mineIds || [];
        this.factoryIds = config.factoryIds || [];
        this.areaIds = config.areaIds || [];

        this.baseURL = 'https://preview.craft-world.gg/api/1/user-actions/ingest';
        this.authToken = null;
        this.isRunning = false;
        this.headers = {
            "accept": "*/*", "accept-language": "en-US,en;q=0.7",
            "content-type": "application/json", "priority": "u=1, i",
            "sec-ch-ua-mobile": "?0", "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin",
            "sec-gpc": "1", "x-app-version": "0.33.7",
            "Referer": "https://preview.craft-world.gg/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        };
    }

    setAuthToken(token) {
        this.authToken = token.startsWith('Bearer jwt_') ? token : `Bearer jwt_${token}`;
        this.headers.authorization = this.authToken;
        logger.success(`Auth token set successfully for ${this.accountName}`);
    }
    
    formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
    generateActionId() { return uuidv4(); }
    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    displayResourceInfo(account) {
        logger.step(`=== INFO SUMBER DAYA | ${this.accountName} ===`);
        logger.info(`Power: ${this.formatNumber(account.power || 0)}`);
        logger.info(`XP: ${this.formatNumber(account.experiencePoints || 0)}`);
        if (account.skillPoints !== undefined) {
            logger.info(`Skill Points: ${this.formatNumber(account.skillPoints)}`);
        }
    }
    
    async #performAction(actionType, payloadData, entityId, retryCount = 3) {
        for (let i = 0; i < retryCount; i++) {
            try {
                const actionId = this.generateActionId();
                const payload = { data: [{ id: actionId, actionType, payload: payloadData, time: Date.now() }] };
                
                const userAgent = '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"';
                this.headers['sec-ch-ua'] = userAgent;
                this.headers['sec-ch-ua-platform'] = '"Windows"';

                const response = await axios.post(this.baseURL, payload, { headers: this.headers });
                if (response.data?.data?.processed?.includes(actionId)) {
                    logger.success(`${actionType} berhasil untuk ID: ${entityId}`);
                    return response.data.data;
                }
            } catch (error) {
                const errMsg = error.response ? `Status ${error.response.status}` : error.message;
                logger.error(`Gagal ${actionType} untuk ID ${entityId} (Percobaan ${i+1}/${retryCount}): ${errMsg}`);
                if (i < retryCount - 1) await this.sleep(2000 * (i + 1));
            }
        }
        logger.error(`Semua percobaan gagal untuk ${actionType} pada ID: ${entityId}`);
        return null;
    }

    startFactory(factoryId) {
        return this.#performAction("START_FACTORY", { factoryId }, factoryId);
    }
    claimArea(areaId, amountToClaim = 1) {
        return this.#performAction("CLAIM_AREA", { areaId, amountToClaim }, areaId);
    }
    startMine(mineId) {
        return this.#performAction("START_MINE", { mineId }, mineId);
    }
    claimMine(mineId) {
        return this.#performAction("CLAIM_MINE", { mineId }, mineId);
    }

    async getAccountInfo() {
        logger.loading(`Mengambil status awal akun untuk ${this.accountName}...`);
        if (this.mineIds.length === 0) {
            logger.warn("Tidak ada mineId yang ditemukan untuk mengambil info akun.");
            return;
        }
        const data = await this.startMine(this.mineIds[0]);
        if (data && data.account) {
            this.displayResourceInfo(data.account);
        } else {
            logger.error("Tidak dapat mengambil info awal akun.");
        }
    }

    async startBotLoop(mineInterval = 60000, claimInterval = 3000) {
        if (!this.authToken) {
            logger.error(`Bot tidak dapat dimulai. Token otentikasi tidak ada.`);
            return;
        }
        this.isRunning = true;
        let cycleCount = 0;

        while (this.isRunning) {
            cycleCount++;
            logger.step(`=== SIKLUS ${cycleCount} | ${this.accountName} ===`);
            
            try {
                logger.loading(`Memulai semua mine dan factory...`);
                const startPromises = [
                    ...this.mineIds.map(id => this.startMine(id)),
                    ...this.factoryIds.map(id => this.startFactory(id))
                ];
                await Promise.allSettled(startPromises);
                
                logger.loading(`Menunggu ${mineInterval / 1000} detik agar mine selesai...`);
                await this.sleep(mineInterval);

                logger.loading(`Mengklaim semua mine dan area...`);
                const claimPromises = [
                    ...this.mineIds.map(id => this.claimMine(id)),
                    ...this.areaIds.map(id => this.claimArea(id))
                ];
                const results = await Promise.allSettled(claimPromises);

                const lastSuccessfulClaim = results.reverse().find(r => r.status === 'fulfilled' && r.value?.account);
                if (lastSuccessfulClaim) {
                    this.displayResourceInfo(lastSuccessfulClaim.value.account);
                }

                logger.loading(`Siklus selesai. Menunggu ${claimInterval / 1000} detik untuk siklus berikutnya...`);
                await this.sleep(claimInterval);

            } catch (error) {
                logger.error(`Terjadi error tak terduga di loop utama: ${error.message}`);
                await this.sleep(15000);
            }
        }
    }
    
    stopBot() {
        this.isRunning = false;
        logger.warn(`Bot untuk ${this.accountName} telah dihentikan.`);
    }
}

async function main() {
    logger.banner();
    const config = await readConfig();
    if (!config) return;

    const hasIds = (config.mineIds?.length || config.factoryIds?.length || config.areaIds?.length) > 0;
    if (!hasIds) {
        logger.error("Tidak ada 'mineIds', 'factoryIds', atau 'areaIds' yang ditemukan di config.json. Bot tidak bisa berjalan.");
        return;
    }
    logger.info(`Konfigurasi untuk "${config.name || 'Default Account'}" dimuat.`);
    logger.info(`Ditemukan: ${config.mineIds?.length || 0} Mines, ${config.factoryIds?.length || 0} Factories, ${config.areaIds?.length || 0} Areas.`);

    try {
        const bot = new CraftWorldBot(config);
        
        logger.loading('Mendapatkan token otentikasi awal...');
        const initialToken = await web3Login();
        bot.setAuthToken(initialToken);
        
        await bot.getAccountInfo();
        
        // Memulai loop utama bot. Anda bisa mengubah interval di sini (dalam milidetik).
        // Contoh: mineInterval 60 detik, claimInterval 5 detik
        await bot.startBotLoop(60000, 5000);

    } catch (error) {
        logger.error(`Error utama: ${error.message}`);
    }
}

// Menangani penutupan program (Ctrl+C)
process.on('SIGINT', () => {
    logger.warn('Mematikan bot...');
    process.exit(0);
});

// Menjalankan fungsi utama jika file ini dieksekusi secara langsung
if (require.main === module) {
    main().catch(error => {
        logger.error(`Error utama yang tidak tertangani: ${error.message}`);
    });
}
