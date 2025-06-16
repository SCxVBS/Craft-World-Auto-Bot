const { ethers } = require("ethers");
const fs = require("fs").promises;
let fetch;

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
  }
};

async function web3Login(privateKey) {
  if (!fetch) {
    logger.startLoading('Initializing fetch...');
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default;
    logger.success('Fetch initialized');
  }

  try {
    logger.startLoading(`Authenticating wallet ${privateKey.slice(0, 6)}...`);
    if (!privateKey) {
      throw new Error('Private key is required');
    }
    const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(normalizedKey)) {
      throw new Error('Invalid private key format');
    }
    const wallet = new ethers.Wallet(normalizedKey);
    const userAddress = wallet.address;
    const chainId = "84532";
    logger.success(`Wallet loaded: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    logger.debug(`Wallet address: ${userAddress}`);

    const baseHeaders = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Linux\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "x-bundle-id": "craftworld",
      "x-client-id": "25bc35076e7821aa8a5779982e2d04b2",
      "x-sdk-name": "UnitySDK_WebGL",
      "x-sdk-os": "WebGLPlayer",
      "x-sdk-platform": "unity",
      "x-sdk-version": "5.19.1"
    };

    logger.startLoading('Fetching payload...');
    const payloadUrl = "https://preview.craft-world.gg/auth/payload";
    const payloadBody = JSON.stringify({ address: userAddress, chainId: chainId });
    const payloadFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json; charset=utf-8",
        "sec-fetch-site": "same-origin",
      },
      referrer: "https://preview.craft-world.gg/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: payloadBody,
      method: "POST",
      mode: "cors",
      credentials: "include"
    };

    const payloadResponse = await fetch(payloadUrl, payloadFetchOptions);
    if (!payloadResponse.ok) {
      throw new Error(`Payload fetch failed: ${payloadResponse.status}`);
    }
    const payloadData = await payloadResponse.json();
    logger.success('Payload fetched');

    const siwePayload = {
      ...payloadData.payload,
      domain: "preview.craft-world.gg",
      uri: "https://preview.craft-world.gg",
      statement: "By signing this message, you are authenticating your wallet with the game and agreeing to the Terms & Conditions."
    };

    const message = `${siwePayload.domain} wants you to sign in with your Ethereum account:\n${siwePayload.address}\n\n${siwePayload.statement}\n\nURI: ${siwePayload.uri}\nVersion: ${siwePayload.version}\nChain ID: ${siwePayload.chain_id}\nNonce: ${siwePayload.nonce}\nIssued At: ${siwePayload.issued_at}${siwePayload.expiration_time ? `\nExpiration Time: ${siwePayload.expiration_time}` : ""}`;

    logger.startLoading('Signing message...');
    const signature = await wallet.signMessage(message);
    logger.success('Message signed');
    logger.debug(`Signature: ${signature}`);

    logger.startLoading('Sending Thirdweb event...');
    const thirdwebEventUrl = "https://c.thirdweb.com/event";
    const thirdwebEventBody = JSON.stringify({
      source: "connectWallet",
      action: "connect",
      walletAddress: userAddress,
      walletType: "metamask",
    });
    const thirdwebEventFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json; charset=utf-8",
        "sec-fetch-site": "cross-site",
      },
      referrer: "https://preview.craft-world.gg/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: thirdwebEventBody,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    };

    const thirdwebEventResponse = await fetch(thirdwebEventUrl, thirdwebEventFetchOptions);
    if (!thirdwebEventResponse.ok) {
      logger.warn('Thirdweb event failed - continuing');
    } else {
      logger.success('Thirdweb event sent');
    }

    logger.startLoading('Performing login...');
    const loginUrl = "https://preview.craft-world.gg/auth/login";
    const loginBody = JSON.stringify({
      payload: {
        Payload: {
          domain: siwePayload.domain,
          address: siwePayload.address,
          statement: siwePayload.statement,
          uri: siwePayload.uri,
          version: siwePayload.version,
          chain_id: siwePayload.chain_id,
          nonce: siwePayload.nonce,
          issued_at: siwePayload.issued_at,
          expiration_time: siwePayload.expiration_time
        },
        Signature: signature
      }
    });
    const loginFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json; charset=utf-8",
        "sec-fetch-site": "same-origin"
      },
      referrer: "https://preview.craft-world.gg/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: loginBody,
      method: "POST",
      mode: "cors",
      credentials: "include"
    };

    const loginResponse = await fetch(loginUrl, loginFetchOptions);
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    const loginData = await loginResponse.json();
    const customToken = loginData.customToken;
    logger.success('Login successful');
    logger.info(`Custom Token: ${customToken.slice(0, 10)}...`);
    logger.info(`UID: ${loginData.uid}`);

    logger.startLoading('Authenticating with Firebase...');
    const firebaseSignInUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyDgDDykbRrhbdfWUpm1BUgj4ga7d_-wy_g";
    const firebaseSignInBody = JSON.stringify({ token: customToken, returnSecureToken: true });
    const firebaseSignInFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        "x-client-data": "CLCIywE=",
        "x-client-version": "Chrome/JsCore/11.4.0/FirebaseCore-web",
        "x-firebase-appcheck": "eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==",
        "x-firebase-gmpid": "1:54312317442:web:585f62354db53c142bed1b"
      },
      referrerPolicy: "no-referrer",
      body: firebaseSignInBody,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    };

    const firebaseSignInResponse = await fetch(firebaseSignInUrl, firebaseSignInFetchOptions);
    if (!firebaseSignInResponse.ok) {
      throw new Error(`Firebase authentication failed: ${firebaseSignInResponse.status}`);
    }
    const firebaseSignInData = await firebaseSignInResponse.json();
    const idToken = firebaseSignInData.idToken;
    logger.success('Firebase authenticated');
    logger.info(`ID Token: ${idToken.slice(0, 10)}...`);

    logger.startLoading('Validating JWT...');
    const thirdwebValidateUrl = "https://embedded-wallet.thirdweb.com/api/2023-10-20/embedded-wallet/validate-custom-jwt";
    const thirdwebValidateBody = JSON.stringify({ jwt: idToken, developerClientId: "25bc35076e7821aa8a5779982e2d04b2" });
    const thirdwebValidateFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        "x-embedded-wallet-version": "unity:5.19.1",
        "x-session-nonce": "63ba8f76-cb07-4408-99b2-008ccca8df6b",
        "x-thirdweb-client-id": "25bc35076e7821aa8a5779982e2d04b2"
      },
      referrer: "https://preview.craft-world.gg/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: thirdwebValidateBody,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    };

    const thirdwebValidateResponse = await fetch(thirdwebValidateUrl, thirdwebValidateFetchOptions);
    if (!thirdwebValidateResponse.ok) {
      throw new Error(`JWT validation failed: ${thirdwebValidateResponse.status}`);
    }
    const thirdwebValidateData = await thirdwebValidateResponse.json();
    const finalJwtToken = thirdwebValidateData.verifiedToken.jwtToken;
    logger.success('JWT validated');

    logger.success(`Authenticated wallet: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    return finalJwtToken;

  } catch (error) {
    logger.error(`Authentication failed: ${error.message}`);
    logger.debug(`Error details: ${error.stack}`);
    throw error;
  }
}

module.exports = { web3Login };