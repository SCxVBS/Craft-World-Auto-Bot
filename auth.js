const { ethers } = require("ethers");
const fs = require("fs");
// const fetch = require("node-fetch"); // <-- BARIS INI DIHAPUS ATAU DIKOMENTARI

let fetch; // Deklarasikan variabel fetch di scope global modul ini

// Import colors for logging
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bold: "\x1b[1m"
};

process.removeAllListeners('warning');

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`)
};

async function web3Login() {
  // Panggil fungsi ini untuk memastikan fetch diinisialisasi
  // Ini akan dijalankan pertama kali web3Login dipanggil
  if (!fetch) { // Inisialisasi fetch hanya sekali
    const nodeFetch = await import('node-fetch');
    fetch = nodeFetch.default; // node-fetch mengekspor fungsi utamanya sebagai default
  }

  try {
    // 1. Read private key from pk.txt
    logger.loading('Reading private key from pk.txt...');
    const privateKey = fs.readFileSync("pk.txt", "utf8").trim();
    const wallet = new ethers.Wallet(privateKey);
    const userAddress = wallet.address;
    const chainId = "84532";
    logger.success(`Wallet loaded: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);

    // Define the base headers with common values
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

    // --- Step 1: Fetching Payload ---
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

    // Gunakan fetch yang sudah diinisialisasi
    const payloadResponse = await fetch(payloadUrl, payloadFetchOptions);

    if (!payloadResponse.ok) {
      throw new Error(`Payload fetch failed: ${payloadResponse.status}`);
    }
    const payloadData = await payloadResponse.json();
    logger.success('Payload fetched successfully');

    // Construct message for signing (EIP-4361 / SIWE)
    const siwePayload = {
      ...payloadData.payload,
      domain: "preview.craft-world.gg",
      uri: "https://preview.craft-world.gg",
      statement: "By signing this message, you are authenticating your wallet with the game and agreeing to the Terms & Conditions."
    };

    const message = `${siwePayload.domain} wants you to sign in with your Ethereum account:\n${siwePayload.address}\n\n${siwePayload.statement}\n\nURI: ${siwePayload.uri}\nVersion: ${siwePayload.version}\nChain ID: ${siwePayload.chain_id}\nNonce: ${siwePayload.nonce}\nIssued At: ${siwePayload.issued_at}${siwePayload.expiration_time ? `\nExpiration Time: ${siwePayload.expiration_time}` : ""}`;

    // --- Step 2: Signing Message ---
    const signature = await wallet.signMessage(message);
    logger.success('Message signed successfully');

    // --- Step 3: Sending Thirdweb Event (Informational) ---
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
        "sec-fetch-site": "cross-site", // Specific for thirdweb.com
      },
      referrer: "https://preview.craft-world.gg/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: thirdwebEventBody,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    };

    // Gunakan fetch yang sudah diinisialisasi
    const thirdwebEventResponse = await fetch(thirdwebEventUrl, thirdwebEventFetchOptions);

    if (!thirdwebEventResponse.ok) {
      logger.warn('Thirdweb event failed - continuing anyway');
    } else {
      logger.success('Thirdweb event sent successfully');
    }

    // --- Step 4: Performing Initial Login ---
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

    // Gunakan fetch yang sudah diinisialisasi
    const loginResponse = await fetch(loginUrl, loginFetchOptions);

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    const loginData = await loginResponse.json();
    const customToken = loginData.customToken;
    logger.success('Login successful');
    logger.info(`Custom Token: ${customToken.slice(0, 10)}...`);
    logger.info(`UID: ${loginData.uid}`);

    // --- Step 5: Sign in with Custom Token (Firebase Identity Toolkit) ---
    const firebaseSignInUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyDgDDykbRrhbdfWUpm1BUgj4ga7d_-wy_g";
    const firebaseSignInBody = JSON.stringify({ token: customToken, returnSecureToken: true });
    const firebaseSignInFetchOptions = {
      headers: {
        ...baseHeaders, // Start with base headers
        "content-type": "application/json", // Specific content type for this API
        "sec-fetch-site": "cross-site", // Specific for Google APIs
        // Unique headers for Firebase Identity Toolkit
        "x-client-data": "CLCIywE=",
        "x-client-version": "Chrome/JsCore/11.4.0/FirebaseCore-web",
        "x-firebase-appcheck": "eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==",
        "x-firebase-gmpid": "1:54312317442:web:585f62354db53c142bed1b"
      },
      referrerPolicy: "no-referrer", // Specific for this call
      body: firebaseSignInBody,
      method: "POST",
      mode: "cors",
      credentials: "omit"
    };

    // Gunakan fetch yang sudah diinisialisasi
    const firebaseSignInResponse = await fetch(firebaseSignInUrl, firebaseSignInFetchOptions);

    if (!firebaseSignInResponse.ok) {
      throw new Error(`Firebase authentication failed: ${firebaseSignInResponse.status}`);
    }
    const firebaseSignInData = await firebaseSignInResponse.json();
    const idToken = firebaseSignInData.idToken;
    logger.success('Firebase authentication successful');
    logger.info(`ID Token: ${idToken.slice(0, 10)}...`);

    // --- Step 6: Validate Custom JWT with Thirdweb Embedded Wallet ---
    const thirdwebValidateUrl = "https://embedded-wallet.thirdweb.com/api/2023-10-20/embedded-wallet/validate-custom-jwt";
    const thirdwebValidateBody = JSON.stringify({ jwt: idToken, developerClientId: "25bc35076e7821aa8a5779982e2d04b2" });
    const thirdwebValidateFetchOptions = {
      headers: {
        ...baseHeaders,
        "content-type": "application/json", // Specific for this API
        "sec-fetch-site": "cross-site", // Specific for thirdweb.com
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

    // Gunakan fetch yang sudah diinisialisasi
    const thirdwebValidateResponse = await fetch(thirdwebValidateUrl, thirdwebValidateFetchOptions);

    if (!thirdwebValidateResponse.ok) {
      throw new Error(`JWT validation failed: ${thirdwebValidateResponse.status}`);
    }
    const thirdwebValidateData = await thirdwebValidateResponse.json();
    const finalJwtToken = thirdwebValidateData.verifiedToken.jwtToken;
    logger.success('JWT validation successful');

    logger.success(`Authentication successful for wallet: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    
    return finalJwtToken;

  } catch (error) {
    logger.error(`Authentication failed: ${error.message}`);
    throw error;
  }
}

// Export the function
module.exports = {
  web3Login
};