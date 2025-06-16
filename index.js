const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const { web3Login } = require('./auth');

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m",
  dim: "\x1b[2m"
};

// Animasi loading
const loadingFrames = ['⠋', '⠙', '⠚', '⠞', '⠦', '⠧', '⠇', '⠏'];
let loadingInterval = null;

const logger = {
  startLoading: (msg) => {
    logger.stopLoading();
    let frameIndex = 0;
    process.stdout.write(`${colors.cyan}[${loadingFrames[frameIndex]}] ${msg}${colors.reset}`);
    loadingInterval = setInterval(() => {
      process.stdout.write(`\r${colors.cyan}[${loadingFrames[frameIndex = (frameIndex + 1) % loadingFrames.length]}] ${msg}${colors.reset}`);
    }, 100);
  },
  stopLoading: () => {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
      process.stdout.write('\r\x1b[K');
    }
  },
  info: (msg) => {
    logger.stopLoading();
    console.log(`${colors.green}[✓] ${msg}${colors.reset}`);
  },
  warn: (msg) => {
    logger.stopLoading();
    console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`);
  },
  error: (msg) => {
    logger.stopLoading();
    console.log(`${colors.red}[✗] ${msg}${colors.reset}`);
  },
  success: (msg) => {
    logger.stopLoading();
    console.log(`${colors.green}[✅] ${msg}${colors.reset}`);
  },
  step: (msg) => {
    logger.stopLoading();
    console.log(`${colors.white}[➤] ${msg}${colors.reset}`);
  },
  debug: (msg) => {
    if (process.env.DEBUG === 'true') {
      logger.stopLoading();
      console.log(`${colors.dim}${colors.cyan}[🔍] ${msg}${colors.reset}`);
    }
  },
  section: (msg) => {
    logger.stopLoading();
    console.log(`${colors.white}── ${colors.bold}${msg} ──${colors.reset}`);
  },
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`███████╗ ██████╗██╗  ██╗██╗   ██╗██████╗ ███████╗`);
    console.log(`██╔════╝██╔════╝╚██╗██╔╝██║   ██║██╔══██╗██╔════╝`);
    console.log(`███████╗██║      ╚███╔╝ ╚██╗ ██╔╝██████╔╝███████╗`);
    console.log(`╚════██║██║      ██╔██╗  ╚████╔╝ ██╔══██╗╚════██║`);
    console.log(`███████║╚██████╗██╔╝ ██╗  ╚██╔╝  ██████╔╝███████║`);
    console.log(`╚══════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚══════╝`);
    console.log(`---------------------------------------------`);
    console.log(`  Created by SCxVBS | Telegram: t.me/scxvbs  `);
    console.log(`---------------------------------------------${colors.reset}`);
    console.log();
  }
};

process.removeAllListeners('warning');

const getRandomUserAgent = () => {
  const browsers = [
    { ua: '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"', platform: 'Windows' },
    { ua: '"Google Chrome";v="128", "Chromium";v="128", "Not;A=Brand";v="99"', platform: 'Macintosh' },
    { ua: '"Firefox";v="127", "Gecko";v="20100101", "Mozilla";v="5.0"', platform: 'Linux' },
    { ua: '"Safari";v="17.0", "AppleWebKit";v="605.1.15", "Version";v="17.0"', platform: 'Macintosh' }
  ];
  const selected = browsers[Math.floor(Math.random() * browsers.length)];
  return { 'sec-ch-ua': selected.ua, 'sec-ch-ua-platform': selected.platform };
};

async function readConfig() {
  try {
    logger.startLoading('Loading config.json...');
    const data = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(data);
    if (!config.accounts || !Array.isArray(config.accounts)) {
      throw new Error('Invalid config.json: "accounts" array is required');
    }
    logger.debug(`Read ${config.accounts.length} account configs`);
    logger.success(`Loaded ${config.accounts.length} account configs`);
    return config;
  } catch (error) {
    logger.error(`Failed to load config.json: ${error.message}`);
    return { accounts: [] };
  }
}

async function readPrivateKeys() {
  try {
    logger.startLoading('Loading private keys...');
    const data = await fs.readFile('pk.txt', 'utf8');
    logger.debug(`Raw pk.txt content: ${JSON.stringify(data)}`);
    const keys = data.split('\n').map(key => key.trim()).filter(key => key.length > 0);
    logger.debug(`Split keys: ${keys.map(k => k.slice(0, 6) + '...').join(', ')}`);
    const validKeys = keys.filter(key => {
      const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
      const isValid = /^[0-9a-fA-F]{64}$/.test(cleanKey);
      if (!isValid) {
        logger.warn(`Invalid private key: ${key.slice(0, 6)}...`);
      }
      return isValid;
    });
    if (validKeys.length === 0) {
      logger.error('No valid private keys found');
    } else {
      logger.success(`Loaded ${validKeys.length} private keys`);
    }
    return validKeys;
  } catch (error) {
    logger.error(`Failed to load pk.txt: ${error.message}`);
    return [];
  }
}

class CraftWorldBot {
  constructor(accountIndex) {
    this.baseURL = 'https://preview.craft-world.gg/api/1/user-actions/ingest';
    this.authToken = null;
    this.mineIds = [];
    this.factoryIds = [];
    this.areaIds = [];
    this.accountIndex = accountIndex;
    this.isRunning = false;
    this.previousResources = {};
    this.tokenRenewalInterval = null;

    const userAgent = getRandomUserAgent();
    this.headers = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.7",
      "content-type": "application/json",
      "priority": "u=1, i",
      "sec-ch-ua": userAgent['sec-ch-ua'],
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": userAgent['sec-ch-ua-platform'],
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      "x-app-version": "0.33.7",
      "Referer": "https://preview.craft-world.gg/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };
  }

  async setIdsFromConfig(accountConfig) {
    const assets = accountConfig.assets || [];
    this.mineIds = assets.filter(asset => asset.type === 'mine').map(asset => asset.id);
    this.factoryIds = assets.filter(asset => asset.type === 'factory').map(asset => asset.id);
    this.areaIds = assets.filter(asset => asset.type === 'area').map(asset => asset.id);

    if (this.mineIds.length === 0 && this.factoryIds.length === 0 && this.areaIds.length === 0) {
      logger.error(`No assets found for account ${this.accountIndex + 1}`);
      return false;
    }

    logger.section(`Account ${this.accountIndex + 1} Assets`);
    if (this.mineIds.length > 0) logger.info(`Mines: ${this.mineIds.join(', ')}`);
    if (this.factoryIds.length > 0) logger.info(`Factories: ${this.factoryIds.join(', ')}`);
    if (this.areaIds.length > 0) logger.info(`Areas: ${this.areaIds.join(', ')}`);
    return true;
  }

  setAuthToken(token) {
    this.authToken = token.startsWith('Bearer jwt_') ? token : `Bearer jwt_${token}`;
    this.headers.authorization = this.authToken;
    logger.success(`Auth token set for account ${this.accountIndex + 1}`);
  }

  generateActionId() {
    return uuidv4();
  }

  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  getResourceEmoji(symbol) {
    const emojiMap = {
      'EARTH': '🌍', 'WATER': '💧', 'FIRE': '🔥', 'MUD': '🟤',
      'CLAY': '🧱', 'SAND': '🏖️', 'COPPER': '🟠', 'SEAWATER': '🌊',
      'HEAT': '🌡️', 'ALGAE': '🌿', 'LAVA': '🌋', 'CERAMICS': '🏺',
      'STEEL': '⚙️', 'OXYGEN': '💨', 'GLASS': '🪟', 'GAS': '💨',
      'STONE': '🪨', 'STEAM': '♨️', 'SCREWS': '🔩', 'FUEL': '⛽',
      'CEMENT': '🏗️', 'OIL': '🛢️', 'ACID': '🧪', 'SULFUR': '💛',
      'PLASTICS': '♻️', 'FIBERGLASS': '🪟', 'ENERGY': '⚡', 'HYDROGEN': '💨',
      'DYNAMITE': '💥', 'COIN': '🪙'
    };
    return emojiMap[symbol] || '📦';
  }

  displayResourceInfo(account) {
    logger.section(`Account ${this.accountIndex + 1} Resources`);
    logger.info(`Power: ${this.formatNumber(account.power || 0)} ⚡`);
    logger.info(`XP: ${this.formatNumber(account.experiencePoints || 0)} 🏆`);
    logger.info(`Wallet: ${account.walletAddress?.slice(0, 6)}...${account.walletAddress?.slice(-4) || 'N/A'} 💳`);
    if (account.skillPoints !== undefined) {
      logger.info(`Skill Points: ${this.formatNumber(account.skillPoints)} 🌟`);
    }

    if (account.resources?.length > 0) {
      logger.info('Resources:');
      account.resources
        .filter(r => r.amount > 0)
        .forEach(r => logger.info(`  ${this.getResourceEmoji(r.symbol)} ${r.symbol}: ${this.formatNumber(r.amount)}`));
    } else {
      logger.info('No resources available');
    }
  }

  storeCurrentResources(account) {
    this.previousResources = {};
    if (account.resources?.length) {
      account.resources.forEach(r => this.previousResources[r.symbol] = r.amount);
    }
    this.previousResources.power = account.power || 0;
    this.previousResources.experiencePoints = account.experiencePoints || 0;
    this.previousResources.skillPoints = account.skillPoints || 0;
  }

  displayClaimSummary(account) {
    const updates = [];
    if (account.resources?.length) {
      account.resources
        .filter(r => r.amount > 0)
        .forEach(r => updates.push(`${this.getResourceEmoji(r.symbol)} ${r.symbol}: ${this.formatNumber(r.amount)}`));
    }
    if (account.experiencePoints !== undefined) {
      updates.push(`XP: ${this.formatNumber(account.experiencePoints)}`);
    }
    return updates.join(' | ');
  }

  async startFactory(factoryId) {
    let retries = 3;
    while (retries > 0) {
      try {
        logger.startLoading(`Starting factory ${factoryId}...`);
        const actionId = this.generateActionId();
        const payload = {
          data: [{
            id: actionId,
            actionType: "START_FACTORY",
            payload: { factoryId },
            time: Date.now()
          }]
        };

        const response = await axios.post(this.baseURL, payload, { headers: this.headers });
        if (response.data.data.processed.includes(actionId)) {
          logger.success(`Factory ${factoryId} started`);
          return true;
        }
        logger.error(`Failed to start factory ${factoryId}: Action not processed`);
        return false;
      } catch (error) {
        retries--;
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.debug(`Factory ${factoryId} error: ${errorMsg}`);
        if (retries === 0) {
          logger.error(`Failed to start factory ${factoryId}: ${errorMsg}`);
          return false;
        }
        await this.sleep(2000 * (4 - retries));
      }
    }
    return false;
  }

  async claimArea(areaId, amountToClaim = 1) {
    let retries = 3;
    while (retries > 0) {
      try {
        logger.startLoading(`Claiming area ${areaId}...`);
        const actionId = this.generateActionId();
        const payload = {
          data: [{
            id: actionId,
            actionType: "CLAIM_AREA",
            payload: { areaId, amountToClaim },
            time: Date.now()
          }]
        };

        const response = await axios.post(this.baseURL, payload, { headers: this.headers });
        if (response.data.data.processed.includes(actionId)) {
          logger.success(`Area ${areaId} claimed`);
          return true;
        }
        logger.error(`Failed to claim area ${areaId}: Action not processed`);
        return false;
      } catch (error) {
        retries--;
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.debug(`Area ${areaId} error: ${errorMsg}`);
        if (retries === 0) {
          logger.error(`Failed to claim area ${areaId}: ${errorMsg}`);
          return false;
        }
        await this.sleep(2000 * (4 - retries));
      }
    }
    return false;
  }

  async startMine(mineId) {
    let retries = 3;
    while (retries > 0) {
      try {
        logger.startLoading(`Starting mine ${mineId}...`);
        const actionId = this.generateActionId();
        const payload = {
          data: [{
            id: actionId,
            actionType: "START_MINE",
            payload: { mineId },
            time: Date.now()
          }]
        };

        const response = await axios.post(this.baseURL, payload, { headers: this.headers });
        if (response.data.data.processed.includes(actionId)) {
          this.storeCurrentResources(response.data.data.account);
          logger.success(`Mine ${mineId} started`);
          return response.data.data.account;
        }
        logger.error(`Failed to start mine ${mineId}: Action not processed`);
        return null;
      } catch (error) {
        retries--;
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.debug(`Mine ${mineId} error: ${errorMsg}`);
        if (retries === 0) {
          logger.error(`Failed to start mine ${mineId}: ${errorMsg}`);
          return null;
        }
        await this.sleep(2000 * (4 - retries));
      }
    }
    return null;
  }

  async claimMine(mineId) {
    let retries = 3;
    while (retries > 0) {
      try {
        logger.startLoading(`Claiming mine ${mineId}...`);
        const actionId = this.generateActionId();
        const payload = {
          data: [{
            id: actionId,
            actionType: "CLAIM_MINE",
            payload: { mineId },
            time: Date.now()
          }]
        };

        const response = await axios.post(this.baseURL, payload, { headers: this.headers });
        if (response.data.data.processed.includes(actionId)) {
          logger.success(`Mine ${mineId} claimed: ${this.displayClaimSummary(response.data.data.account)}`);
          return response.data.data.account;
        }
        logger.error(`Failed to claim mine ${mineId}: Action not processed`);
        return null;
      } catch (error) {
        retries--;
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.debug(`Mine ${mineId} error: ${errorMsg}`);
        if (retries === 0) {
          logger.error(`Failed to claim mine ${mineId}: ${errorMsg}`);
          return null;
        }
        await this.sleep(2000 * (4 - retries));
      }
    }
    return null;
  }

  async getAccountInfo() {
    let retries = 3;
    while (retries > 0) {
      try {
        logger.startLoading(`Fetching account ${this.accountIndex + 1} info...`);
        const actionId = this.generateActionId();
        const payload = {
          data: [{
            id: actionId,
            actionType: "START_MINE",
            payload: { mineId: this.mineIds[0] || '' },
            time: Date.now()
          }]
        };

        const response = await axios.post(this.baseURL, payload, { headers: this.headers });
        logger.success(`Account info fetched`);
        return response.data.data.account;
      } catch (error) {
        retries--;
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.debug(`Account info error: ${errorMsg}`);
        if (retries === 0) {
          logger.error(`Failed to fetch account info: ${errorMsg}`);
          return null;
        }
        await this.sleep(2000 * (4 - retries));
      }
    }
    return null;
  }

  async displayAccountStatus() {
    logger.startLoading(`Fetching status for account ${this.accountIndex + 1}...`);
    const account = await this.getAccountInfo();
    if (account) {
      this.displayResourceInfo(account);
    } else {
      logger.error(`Failed to fetch status for account ${this.accountIndex + 1}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async renewToken(privateKey) {
    try {
      logger.startLoading(`Renewing token for account ${this.accountIndex + 1}...`);
      const newToken = await web3Login(privateKey);
      this.setAuthToken(newToken);
      logger.success(`Token renewed for account ${this.accountIndex + 1}`);
    } catch (error) {
      logger.error(`Failed to renew token for account ${this.accountIndex + 1}: ${error.message}`);
    }
  }

  async startCombinedLoop(mineInterval = 60000, claimInterval = 60000, enableFactory = true, enableArea = true, privateKey) {
    if (this.isRunning) {
      logger.warn(`Bot already running for account ${this.accountIndex + 1}`);
      return;
    }

    if (!this.authToken) {
      logger.error(`No auth token for account ${this.accountIndex + 1}`);
      return;
    }

    if (this.mineIds.length === 0 && this.factoryIds.length === 0 && this.areaIds.length === 0) {
      logger.error(`No assets configured for account ${this.accountIndex + 1}`);
      return;
    }

    this.isRunning = true;
    let cycleCount = 0;

    this.tokenRenewalInterval = setInterval(() => {
      this.renewToken(privateKey);
    }, 3600000);

    while (this.isRunning) {
      try {
        logger.section(`Cycle ${cycleCount + 1} | Account ${this.accountIndex + 1}`);

        for (const mineId of this.mineIds) {
          const mineAccount = await this.startMine(mineId);
          if (mineAccount) {
            this.displayResourceInfo(mineAccount);
          }
          await this.sleep(2000);
        }

        if (enableFactory) {
          for (const factoryId of this.factoryIds) {
            await this.startFactory(factoryId);
            await this.sleep(2000);
          }
        }

        logger.startLoading(`Waiting ${mineInterval/1000}s before claiming...`);
        await this.sleep(mineInterval);

        for (const mineId of this.mineIds) {
          await this.claimMine(mineId);
          await this.sleep(2000);
        }

        if (enableArea) {
          for (const areaId of this.areaIds) {
            await this.claimArea(areaId, 1);
            await this.sleep(2000);
          }
        }

        cycleCount++;
        logger.startLoading(`Waiting ${claimInterval/1000}s for next cycle...`);
        await this.sleep(claimInterval);
      } catch (error) {
        const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
        logger.error(`Cycle error for account ${this.accountIndex + 1}: ${errorMsg}`);
        await this.sleep(5000);
      }
    }
  }

  stopBot() {
    this.isRunning = false;
    if (this.tokenRenewalInterval) {
      clearInterval(this.tokenRenewalInterval);
      this.tokenRenewalInterval = null;
    }
    logger.warn(`Bot stopped for account ${this.accountIndex + 1}`);
  }
}

async function main() {
  logger.banner();

  try {
    const config = await readConfig();
    const privateKeys = await readPrivateKeys();

    if (privateKeys.length === 0) {
      logger.error('No private keys found');
      return;
    }

    if (config.accounts.length < privateKeys.length) {
      logger.warn(`Only ${config.accounts.length} accounts configured for ${privateKeys.length} keys`);
    }

    const bots = [];
    for (let i = 0; i < Math.min(privateKeys.length, config.accounts.length); i++) {
      logger.section(`Setting up account ${i + 1}`);
      logger.startLoading(`Authenticating account ${i + 1}...`);
      try {
        const token = await web3Login(privateKeys[i]);
        const bot = new CraftWorldBot(i);
        const idsSet = await bot.setIdsFromConfig(config.accounts[i]);
        if (!idsSet) {
          logger.error(`Skipping account ${i + 1}: No assets`);
          continue;
        }
        bot.setAuthToken(token);
        bots.push({ bot, privateKey: privateKeys[i] });
        logger.success(`Account ${i + 1} ready`);
      } catch (error) {
        logger.error(`Authentication failed for account ${i + 1}: ${error.message}`);
        logger.debug(`Error details: ${error.stack}`);
        continue;
      }
    }

    if (bots.length === 0) {
      logger.error('No bots configured. Exiting...');
      return;
    }

    logger.section(`Starting ${bots.length} Bot(s)`);
    await Promise.all(bots.map(async ({ bot, privateKey }, index) => {
      await bot.displayAccountStatus();
      await bot.startCombinedLoop(60000, 60000, true, true, privateKey);
    }));
  } catch (error) {
    const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
    logger.error(`Main error: ${errorMsg}`);
    logger.debug(`Error details: ${error.stack}`);
  }
}

process.on('SIGINT', () => {
  logger.warn('Shutting down...');
  process.exit(0);
});

module.exports = CraftWorldBot;

if (require.main === module) {
  main().catch(error => {
    const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
    logger.error(`Main error: ${errorMsg}`);
    logger.debug(`Error details: ${error.stack}`);
  });
}