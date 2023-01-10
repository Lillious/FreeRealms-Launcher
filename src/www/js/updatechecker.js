const { ipcRenderer } = require('electron');
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const fetch = require("node-fetch");
const fs = require("fs");
const request = require("request");
const path = require("path");
const { exec } = require('child_process'); // Import exec function from child_process module
const toast = document.getElementById("toast");
toast.innerHTML = "Checking for updates...";

close.addEventListener('click', () => {
    exec('taskkill /f /im OSFRServer.exe', (err, stdout, stderr) => {
        ipcRenderer.send('close');
    });
});

minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

// Parse current version from package.json
const version = require(path.join(__dirname, "../package.json")).version;
// Parse https://raw.githubusercontent.com/Lillious/FreeRealms-Launcher/main/package.json as a json and check if version is greater than the current version
// If it is, show a toast with the update message and a button to download the update
fetch("https://raw.githubusercontent.com/Lillious/FreeRealms-Launcher/main/package.json", {
    headers: {
    'Cache-Control': 'no-cache'
  }}).then((res) => res.json()).then((json) => {
    if (!json.version) return console.error("Failed to check for updates");
    if (json.version > version) {
        toast.innerHTML = `An update is available!<br><span id='update' style="color: #419cff; cursor: pointer;">Download v${json.version}</span><br><br><span id='skip-update' style="color: #419cff; cursor: pointer;">Skip update</span>`;
        toast.style.display = "block";
        const updateButton = document.getElementById("update");
        const skipUpdateButton = document.getElementById("skip-update");
        skipUpdateButton.onclick = () => {
            toast.style.display = "none";
            location.href = "index.html";
        }
        updateButton.onclick = () => {
            // Delete Server folder if it exists
            if (fs.existsSync(path.join(__dirname, "../../../Server"))) {
                fs.rmdirSync(path.join(__dirname, "../../../Server"), { recursive: true });
            }

            // Delete Client folder if it exists
            if (fs.existsSync(path.join(__dirname, "../../../Client"))) {
                fs.rmdirSync(path.join(__dirname, "../../../Client"), { recursive: true });
            }

            const updatePath = path.join(__dirname, `../../../update/update.exe`);
            const installPath = path.join(__dirname, `../../../`);
            const executablePath = path.join(__dirname, `../../../`);
            const executable = "FreeRealmsLauncher.exe";
            const appname = "FreeRealmsLauncher.exe";
            const url = `https://github.com/Lillious/FreeRealms-Launcher/releases/download/v${json.version}/FreeRealms.Launcher_v${json.version}.zip`;
            exec(`"${updatePath}" --url=${url} --install=${installPath} --executablepath=${executablePath} --executable=${executable} --appname=${appname}`, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
    } else {
        setTimeout(() => {
            toast.innerHTML = "No updates available";
        }, 2000);
        setTimeout(() => {
            location.href = "./index.html";
        }, 4000);
    }
});