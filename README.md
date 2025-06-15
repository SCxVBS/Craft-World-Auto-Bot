<div align="center">

# Craft World Auto Bot by SCxVBS

**Automated Bot for Mining & Claim in Craft World with Multi-ID Support.**

<p>
  <img src="https://img.shields.io/badge/Made_with-Node.js-339933?style=for-the-badge&logo=node.js" alt="Made with Node.js"/>
  <img src="https://img.shields.io/badge/version-1.2.0-blue?style=for-the-badge" alt="Version"/>
  <img src="https://img.shields.io/github/license/scxvbs/craft-world-bot?style=for-the-badge&color=yellow" alt="License"/>
  <img src="https://img.shields.io/badge/Maintained%3F-Yes-green.svg?style=for-the-badge" alt="Maintained"/>
</p>

<p>
  <a href="https://t.me/scxvbs" target="_blank">
    <img src="https://img.shields.io/badge/Join_Telegram_Group-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Join Telegram Group"/>
  </a>
  <a href="https://whatsapp.com/channel/0029VbAR1YL5EjxqhRhOzT3x" target="_blank">
    <img src="https://img.shields.io/badge/Follow_on_WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Follow on WhatsApp"/>
  </a>
</p>

</div>

---

> **Notice:** This script is designed for educational purposes and to automate repetitive tasks. Use it wisely and understand the risks.

## ✨ Key Features

-   **🤖 Full Automation**: Automatically runs `start` and `claim` cycles for all your assets.
-   **⚡ Multi-ID Support**: Designed to efficiently manage multiple `mineIds`, `factoryIds`, and `areaIds` in a single account.
-   **⚙️ Efficient & Parallel**: Uses `Promise.allSettled` to run all tasks simultaneously, saving time and resources.
-   **🔧 Easy Configuration**: Simply set up all your IDs in one easy-to-understand `config.json` file.
-   **📊 Informative Logging**: Provides clear, colored logs for every action, making monitoring easy.

## 🛠️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" alt="Axios"/>
</p>

## 🚀 Installation & Usage Guide

Make sure you have [Node.js](https://nodejs.org/) (version 16 or higher is recommended) and [Git](https://git-scm.com/) installed.

1.  **Clone This Repository**
    Open your terminal or command prompt and run the following command:
    ```bash
    git clone https://github.com/SCxVBS/Craft-World-Auto-Bot.git
    ```
    

2.  **Navigate to the Project Directory**
    ```bash
    cd Craft-World-Auto-Bot
    ```

3.  **Install Dependencies**
    Run this command to install all the necessary packages for the bot.
    ```bash
    npm install
    ```

4.  **Create Private Key File**
    Create a new file named `pk.txt` in the project folder, then fill it with your wallet's *private key*.

5.  **Configure Your Assets**
    - Open the `config.json` file.
    - Modify its content according to the `mineIds`, `factoryIds`, and `areaIds` you own.
    
    **Example `config.json`:**
    ```json
    {
      "name": "My Craft World Account",
      "mineIds": [
        "mine-id-1",
        "mine-id-2"
      ],
      "factoryIds": [
        "factory-id-1",
        "factory-id-2",
        "factory-id-3"
      ],
      "areaIds": [
        "area-id-1"
      ]
    }
    ```

6.  **How to Find Your Asset IDs**
    To get the IDs, you need to use the *Developer Tools* feature in your browser.
    -   Open the Craft World website in your browser (Chrome/Firefox).
    -   Right-click anywhere on the page, then select **"Inspect"** or press the **F12** key.
    -   Select the **"Network"** tab.
    -   Perform an action in the game (e.g., start a mine). A request named `ingest` will appear. Click on that request.
    -   In the panel that appears, look for the **"Payload"** or **"Request"** tab. You will find the required ID there.

    **A. Finding `mineId`**
    Perform an action related to a mine (start/claim) to find the `mineId`.
    ![Image for finding Mine ID](1.PNG)

    **B. Finding `factoryId`**
    Perform an action related to a factory (start) to find the `factoryId`.
    ![Image for finding Factory ID](2.PNG)

    **C. Finding `areaId`**
    Perform an action related to an area (claim) to find the `areaId`.
    ![Image for finding Area ID](3.PNG)

7.  **Run the Bot**
    After all configurations are complete, run the bot with the command:
    ```bash
    node index.js
    ```
    The bot will start running, and you will see the activity logs in your terminal.

## 📂 File Structure


Craft-World-Bot/
├── node_modules/       # Dependency folder (auto-generated)
├── auth.js             # Module for authentication (web3 login)
├── config.json         # Main configuration file for all your IDs
├── index.js            # Main script to run the bot
├── package.json        # Project information and dependency list
├── package-lock.json   # Locked dependency versions
├── pk.txt              # File to store your private key (Must be created manually)
└── README.md           # The file you are currently reading


## ⚠️ Disclaimer

The author (SCxVBS) is not responsible for any losses, asset damages, or account bans that may occur from using this script. You are fully responsible for your own actions. **Do With Your Own Risk (DWYOR).**

---

<div align="center">
  Made with ❤️ by SCxVBS
</div>
