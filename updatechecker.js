const { ipcRenderer } = require('electron');
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const fetch = require("node-fetch");
const fs = require("fs");
const request = require("request");
const path = require("path");
const { exec } = require('child_process'); // Import exec function from child_process module
const { shell } = require("electron");
const unzipper = require('unzipper');
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
console.log(version);
fetch("https://raw.githubusercontent.com/Lillious/FreeRealms-Launcher/main/package.json", {
    headers: {
    'Cache-Control': 'no-cache'
  }}).then((res) => res.json()).then((json) => {
    if (!json.version) return console.error("Failed to check for updates");
    console.log(json.version);
    if (json.version > version) {
        toast.innerHTML = `Update available! Click <span id='update' style="color: #419cff; cursor: pointer;">here</span> to download version ${json.version}`;
        toast.style.display = "block";
        const updateButton = document.getElementById("update");
        updateButton.onclick = () => {
            // Download the update and save it to the current directory
            getInstallerFile(`https://github.com/Lillious/FreeRealms-Launcher/releases/download/v${json.version}/FreeRealms.Launcher.zip`, path.join(__dirname, '../', 'Update.zip'), `update v${json.version}`).then(() => {
                extractFiles(path.join(__dirname, '../', 'Update.zip'), path.join(__dirname, '../')).then(() => {
                    // Delete the downloaded update
                    fs.unlink(path.join(__dirname, '../', 'Update.zip'), (err) => {
                        if (err) return console.error(err);
                        // Open the new version of the launcher
                        shell.openPath(path.join(__dirname, '../', 'FreeRealms.Launcher.exe'));
                        // Close the current version of the launcher
                        window.close();
                    });
                });
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

function showDownloadingProgress(received, total) {
    var percentage = ((received * 100) / total).toFixed(1);
    document.getElementById('progress-text').innerHTML = percentage + '%';
    // Set progress bar width to percentage
    document.getElementById('progress').style.width = percentage + '%';
    if (document.getElementById('progress-text').innerHTML == '100.0%') {
        document.getElementById('progress-text').innerHTML = '0%'
        document.getElementById('progress-container').style.display = 'none';
    } else {
        document.getElementById('progress-container').style.display = 'block';
    }
}

function getInstallerFile (installerfileURL,installerfilename, name) {
    // Variable to save downloading progress
    var received_bytes = 0;
    var total_bytes = 0;
    var outStream = fs.createWriteStream(installerfilename);
    // Create new promise with the Promise() constructor;
    return new Promise((resolve, reject) => {
        request
            .get(installerfileURL)
                .on('error', function(err) {
                    console.log(err);
                    reject(err);
                })
                .on('response', function(data) {
                    total_bytes = parseInt(data.headers['content-length']);
                })
                .on('data', function(chunk) {
                    document.getElementById('toast').innerHTML = `Downloading ${name}...`;
                    received_bytes += chunk.length;
                    showDownloadingProgress(received_bytes, total_bytes);
                })
                .on('end', function() {
                    resolve();
                })
                .pipe(outStream);
    })
};

function extractFiles (file, filePath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(file)
        .pipe(unzipper.Parse())
        .on('entry', function (entry) {
            const fileName = entry.path;
            const type = entry.type; // 'Directory' or 'File'
            // if type is Directory, create it
            if (type === 'Directory') {
                fs.mkdir(path.join(filePath, fileName), (err) => {
                    if (err) throw err;
                });
            } else {
                document.getElementById('toast').innerHTML = `Extracting ${fileName}...`
                entry.pipe(fs.createWriteStream(path.join(filePath, fileName)));
            }
        }).on('close', () => {
            resolve();
        }); 
    });
}