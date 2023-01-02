const { app, BrowserWindow, ipcMain } = require('electron');
const crash = (err) => { console.error(`\x1b[31m${err}\x1b[0m`); process.exit(1); };
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Check if config.json exists
if (!fs.existsSync(path.join(__dirname, 'config.json'))) {
    // If it doesn't exist, create it
    fs.writeFileSync(path.join(__dirname, 'config.json'),
    JSON.stringify({
        GUID: "",
        FirstName: "",
        LastName: "",
    }, null, 4));
}

// Create GUID
const charset = () => {
    const numbers = [];
    for (let i = 0; i < 10; i++) {
      numbers.push(String.fromCharCode(48 + i))
    }
    return numbers;
}
// The array that contains the generated UUID
const uuid = [];

generateGUID = () => {
  for (let i = 0; i < 19; i++){
    const part1 = crypto.randomBytes(256).readUInt32BE()%charset().length;
    uuid.push(charset()[part1]);
  }
    // Change the array to string format
    let result = uuid.toString();
  
    // Clean up the formatting
    result = result.replace(/[, ]+/g, "");
    // return the result
    return result;
}

// Check if GUID value is not empty in config.json
const config = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
const configJson = JSON.parse(config);
if (configJson.GUID === "") {
    // If it is empty, generate a new GUID and write it to config.json
    configJson.GUID = generateGUID();
    fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(configJson, null, 4));
}

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1000,
        minWidth: 1000,
        maxWidth: 1000,
        height: 750,
        minHeight: 750,
        maxHeight: 750,
        frame: false,
        darkTheme: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            sandbox: false,
            spellcheck: false,
        }
    });
    win.loadFile('./src/index.html')
    .catch((err) => { crash(err); });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
})
.catch((err) => { crash(err); });

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('close', () => {
    app.quit();
});

ipcMain.on('minimize', () => {
    BrowserWindow.getAllWindows()[0].minimize();
});

ipcMain.on('maximize', () => {
    if (BrowserWindow.getAllWindows()[0].isMaximized()) {
        BrowserWindow.getAllWindows()[0].unmaximize();
    } else {
        BrowserWindow.getAllWindows()[0].maximize();
    }
});