const { ipcRenderer } = require('electron');
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const { exec } = require('child_process'); // Import exec function from child_process module
const fs = require('fs'); // Import fs module
const path = require('path'); // Import path module
const request = require('request');
const ping = require('ping');
const extract = require('extract-zip');

// Check if config.json contains values for FirstName and LastName and set them to the input fields
if (fs.existsSync(path.join(__dirname, '../config.json'))) {
    const config = require(path.join(__dirname, '../config.json'));
    if (config.FirstName != '' && config.LastName != '') {
        document.getElementById('firstname').value = config.FirstName;
        document.getElementById('lastname').value = config.LastName;
    }
}

close.addEventListener('click', () => {
    exec('taskkill /f /im OSFRServer.exe', (err, stdout, stderr) => {
        ipcRenderer.send('close');
    });
});

minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

// Start Apache and Tomcat
const startServer = document.getElementById('start-server');

const updateToast = (message, options) => {
    document.getElementById('toast').innerHTML = message;
    if (options.progressbar) {
        document.getElementById('install').disabled = true;
        document.getElementById('progress').style.width = '0%';
        document.getElementById('progress-container').style.display = 'block';
    } else {
        document.getElementById('install').disabled = false;
        document.getElementById('progress-container').style.display = 'none';
    }
}

// Check if the server is running as a subprocess
exec('tasklist', (err, stdout, stderr) => {
    if (err) {
        console.error(err);
        return;
    }
    if (stdout.includes('OSFRServer.exe')) {
        startServer.innerHTML = 'Stop Server';
        document.getElementById('firstname').disabled = true;
        document.getElementById('lastname').disabled = true;
    } else {
        startServer.innerHTML = 'Start Server';
        document.getElementById('firstname').disabled = false;
        document.getElementById('lastname').disabled = false;
    }
});

setInterval(() => {
    exec('tasklist', (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        if (stdout.includes('FreeRealms.exe')) {
            document.getElementById('play-status').innerHTML = 'Playing';
            document.getElementById('play-status').disabled = true;
        } else {
            if (fs.existsSync(path.join(__dirname, '../Client/', 'FreeRealms.exe'))) {
                document.getElementById('play-status').innerHTML = 'Play';
                document.getElementById('play-status').disabled = false;
            } else {
                document.getElementById('play-status').innerHTML = 'Play';
                document.getElementById('play-status').disabled = true;
            }
        }
    });
}, 3000);

if (!fs.existsSync(path.join(__dirname, '../Server/', 'OSFRServer.exe')) || !fs.existsSync(path.join(__dirname, '../Client/', 'FreeRealms.exe'))) {
    document.getElementById('install').disabled = false;
} else {
    document.getElementById('install').disabled = true;
}

// Check if the server files and client files exist
if (!fs.existsSync(path.join(__dirname, '../Server/', 'OSFRServer.exe'))) {
    document.getElementById('start-server').disabled = true;
    document.getElementById('firstname').disabled = true;
    document.getElementById('lastname').disabled = true;
}
else {
    document.getElementById('start-server').disabled = false;
}

if(!fs.existsSync(path.join(__dirname, '../Client/', 'FreeRealms.exe'))) {
    document.getElementById('play-status').disabled = true;
}
else {
    document.getElementById('play-status').disabled = false;
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
                    document.getElementById('install').disabled = true;
                    document.getElementById('toast').innerHTML = `${name} download is currently in progress...`;
                    received_bytes += chunk.length;
                    showDownloadingProgress(received_bytes, total_bytes);
                })
                .on('end', function() {
                    document.getElementById('install').disabled = true;
                    resolve();
                })
                .pipe(outStream);
    })
};

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

document.getElementById('install').addEventListener('click', async () => {
    // Download Server files if they don't exist
    if (!fs.existsSync(path.join(__dirname, '../Server/', 'OSFRServer.exe'))) {
        getInstallerFile('https://github.com/cccfire/OpenSourceFreeRealms/releases/download/v1.2/OSFR.Server.zip', path.join(__dirname, '../', 'OSFR.Server.zip'), "Server").then(() => {
            updateToast('Extracting files...', { progressbar: false });
            extractServer(path.join(__dirname, '../', 'OSFR.Server.zip'), path.join(__dirname, '../'));
        });
    }

    // Download Client files if they don't exist
    if (!fs.existsSync(path.join(__dirname, '../Client/', 'FreeRealms.exe'))) {
        updateToast('Client download is currently in progress...', { progressbar: true });
        getInstallerFile('https://github.com/cccfire/OpenSourceFreeRealms/releases/download/v1.2/OSFR.Client.zip', path.join(__dirname, '../', 'Client.zip'), "Client").then(() => {
            updateToast('Extracting files...', { progressbar: false });
            extractClient(path.join(__dirname, '../', 'Client.zip'), path.join(__dirname, '../'));
        });
    }

async function extractServer (source, target) {
    try {
        await extract(source, { dir: target })
        // Rename folder to Server
        fs.rename(path.join(__dirname, '../OSFR Server'), path.join(__dirname, '../Server/'), (err) => {
            if (err) {
                updateToast('', { progressbar: false });
                showToast('error', 'Error renaming OSFR Server folder to Server');
            } else {
                updateToast('', { progressbar: false });
                showToast('success', 'Server installed successfully');
                document.getElementById('start-server').disabled = false;
            }
        });
        fs.unlink(path.join(__dirname, '../', 'OSFR.Server.zip'), (err) => {
            if (err) {
                updateToast('', { progressbar: false });
                showToast('error', 'Error deleting Server.zip');
            }
            updateToast('', { progressbar: false });
        });
      } catch (err) {
        updateToast('', { progressbar: false });
        showToast('error', 'Error extracting Server files');
      }
}

async function extractClient (source, target) {  
    try {
        await extract(source, { dir: target })
        // Rename folder to Client
        fs.rename(path.join(__dirname, '../OSFR Client'), path.join(__dirname, '../Client/'), (err) => {
            if (err) {
                updateToast('', { progressbar: false });
                showToast('error', 'Error renaming OSFR Client folder to Client');
            } else {
                updateToast('', { progressbar: false });
                showToast('success', 'Client installed successfully');
                document.getElementById('play-status').disabled = false;
            }
        });
        fs.unlink(path.join(__dirname, '../', 'Client.zip'), (err) => {
            if (err) {
                updateToast('', { progressbar: false });
                showToast('error', 'Error deleting Client.zip');
            }
            updateToast('', { progressbar: false });
        });
      } catch (err) {
        updateToast('', { progressbar: false });
        showToast('error', 'Error extracting Client files');
      }
    }
}); 

class Server {
    constructor (client, server, args) {
        this.client = client;
        this.server = server;
        this.args = args;
    }
    Start () {
        // Disable first and last name input fields
        document.getElementById('firstname').disabled = true;
        document.getElementById('lastname').disabled = true;
        var FirstName = document.getElementById('firstname').value.toString().charAt(0).toUpperCase() + document.getElementById('firstname').value.toString().slice(1).toLowerCase();
        var LastName = document.getElementById('lastname').value.toString().charAt(0).toUpperCase() + document.getElementById('lastname').value.toString().slice(1).toLowerCase();
        // Remove spaces
        FirstName = FirstName.replace(/[^a-zA-Z ]\s/g, "");
        LastName = LastName.replace(/[^a-zA-Z ]\s/g, "");
        if (FirstName === '') {
            showToast('error', `First name cannot be empty`);
            document.getElementById('firstname').disabled = false;
            document.getElementById('lastname').disabled = false;
            return;
        }
        // Check if server config.json is empty
        const config = fs.readFileSync(path.join(__dirname, '../Server/config.json'), 'utf8');
        if (config === '') {
            startServer.innerHTML = 'Start Server';
            showToast('error', `Invalid or empty configuration file`);
            return;
        }
        const configPath = fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8');
        const configJson = JSON.parse(configPath);
        const packetSendSelfToClient = fs.readFileSync(path.join(__dirname, '../Server/Customize/PacketSendSelfToClient.json'), 'utf8');
        const packetSendSelfToClientJson = JSON.parse(packetSendSelfToClient);
        packetSendSelfToClientJson.PlayerGUID = configJson.GUID;
        packetSendSelfToClientJson.FirstName = FirstName;
        configJson.FirstName = FirstName;
        configJson.LastName = LastName || "";
        packetSendSelfToClientJson.LastName = LastName;
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
        fs.writeFileSync(path.join(__dirname, '../Server/Customize/PacketSendSelfToClient.json'), JSON.stringify(packetSendSelfToClientJson, null, 4));
        
        const process = exec(this.server, { cwd: path.join(__dirname, '../Server/') }, (err, stdout, stderr) => {
        });
        process.stderr.on('data', (data) => {
            console.log(data);
        });
        process.stdout.on('data', (data) => {
            console.log(data);
            if (data.includes('Started listening!')) {
                showToast('success', `Server started`);
                startServer.innerHTML = 'Stop Server';
                return;
            }
            if (data.includes('Invalid configuration!')) {
                showToast('error', `Invalid configuration file!`);
                startServer.innerHTML = 'Start Server';
                return;
            }
        });
        process.on('error', (err) => {
            console.log(err);
        });
    }

    Stop () {
        exec('taskkill /f /im OSFRServer.exe', (err, stdout, stderr) => {
            if (err) {
                showToast('error', `Failed to stop server`);
                startServer.innerHTML = 'Stop Server';
                return;
            }
            showToast('error', `Server stopped`);
            startServer.innerHTML = 'Start Server';
            // Enable first and last name input fields
            document.getElementById('firstname').disabled = false;
            document.getElementById('lastname').disabled = false;
        });
    }

    Play () {
        // Get server ip from selected server
        const SelectedServer = document.getElementsByClassName('selected')[0];
        if (!SelectedServer) return showToast('error', `Please select a server`);
        const serverIP = `${SelectedServer.children[3].innerHTML}:20260`
        minimize.click();
        const process = exec(`${this.client} ${this.args} ${serverIP}`, { cwd: path.join(__dirname, '../Client/') }, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
            }
        });

        process.stdout.on('data', (data) => {
            console.log(data);
        });
    }
}

// read GUID.txt file and get GUID from it and use it in args for FreeRealms.exe
const configPath = fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8');
const configJson = JSON.parse(configPath);
const args = `inifile=ClientConfig.ini Guid=${configJson.GUID} Ticket=DWCq3TMkGwj9ZZt Internationalization:Locale=8 ShowMemberLoadingScreen=0 Country=US key=m80HqsRO9i4PjJSCOasVMg== CasSessionId=Jk6TeiRMc4Ba38NO`
const OSFRServer = new Server("FreeRealms.exe", "OSFRServer.exe", args);

startServer.addEventListener('click', () => {
    if (startServer.innerHTML === 'Stop Server') {
        OSFRServer.Stop();
        return;
    }
    OSFRServer.Start();
});

document.getElementById('play-status').addEventListener('click', () => {
    OSFRServer.Play();
    // Disable Play button
    document.getElementById('play-status').disabled = true;
});

function showToast (mode, message) {
    const NotificationContainer = document.createElement('div');
    const NotificationContent = document.createElement('div');
    const NotificationClose = document.createElement('div');
    NotificationContainer.classList.add('notification-bar');
    NotificationContent.classList.add('notification-content');
    // Create id
    NotificationContent.innerHTML = message;
    NotificationContainer.appendChild(NotificationContent);
    // Shift the element up by 50px for each notification that isn't on the screen
    NotificationContainer.style.marginTop = `${50 * document.getElementsByClassName('notification-bar').length}px`;
    if (mode === 'success') {
        // Green
        NotificationContainer.style.borderRight = '4px solid #238636';
    } else if (mode === 'error') {
        // Red
        NotificationContainer.style.borderRight = '4px solid #ed6a5e';
    } else if (mode === 'information') {
        // Blue
        NotificationContainer.style.borderRight = '4px solid #2a9d8f';
    }
    document.body.appendChild(NotificationContainer);
    NotificationClose.addEventListener('click', () => {
        document.body.removeChild(NotificationContainer);
    });
    setTimeout(() => {
        document.body.removeChild(NotificationContainer);
    }, 3000);

    // Write to log file
    // Create log file if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '../log.txt'))) {
        fs.writeFileSync(path.join(__dirname, '../log.txt'), '');
    }
    // Append message to log file
    fs.appendFileSync(path.join(__dirname, '../log.txt'), `${new Date().toLocaleString()} [${mode}] ${message}\n`, (err) => {
        if (err) {
            console.error(err);
        }
    });
};

document.getElementById('import-customize').addEventListener('click', () => {
    if (!fs.existsSync(path.join(__dirname, '../Server/Customize'))) return showToast('error', 'Unable to locate PacketSendSelfToClient.json');
    document.getElementById('import-customize-file').click();
    document.getElementById('import-customize-file').addEventListener('change', () => {
        const file = document.getElementById('import-customize-file').files[0];
        // Check if file is json
        if (file.type != 'application/json') return showToast('error', 'Failed to import customization file');
        // Check if file is PacketSendSelfToClient.json
        if (file.name != 'PacketSendSelfToClient.json') return showToast('error', 'Failed to import customization file');
        // move file to www folder
        const cwd = path.join(path.join(__dirname, '../Server/Customize/PacketSendSelfToClient.json'));
        fs.copyFile(file.path, cwd, (err) => {
            if (err) {
                showToast('error', 'Error importing PacketSendSelfToClient.json');
            } else {
                showToast('success', 'Imported PacketSendSelfToClient.json');
                showToast('information', 'Restart the server to apply changes');
            }
        });
    });
});

// Export customizations
document.getElementById('export-customize').addEventListener('click', () => {
    // Check if customize folder exists
    if (!fs.existsSync(path.join(__dirname, '../Server/Customize'))) return showToast('error', 'Unable to locate PacketSendSelfToClient.json');
    // Create anchor element
    const a = document.createElement('a');
    a.style.display = 'none';
    a.setAttribute('href', path.join(__dirname, '../Server/Customize/PacketSendSelfToClient.json'));
    a.setAttribute('download', 'PacketSendSelfToClient.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('success', 'Exported PacketSendSelfToClient.json');
});

// Add a server
document.getElementById('add-server').addEventListener('click', () => {
    const serverName = document.getElementById('server-name-input').value;
    const serverIp = document.getElementById('server-ip-input').value;
    if (serverName === "" || serverIp === "") return showToast('error', 'Unable to add server');
    // Check if server already exists if there are any servers
    if (configJson.ServerList.find((server) => server.Name === serverName)) return showToast('error', 'Server already exists by that name');
    if (configJson.ServerList.find((server) => server.IP === serverIp)) return showToast('error', 'Server already exists by that IP');
    // Clear input fields
    document.getElementById('server-name-input').value = '';
    document.getElementById('server-ip-input').value = '';
    const parent = document.getElementById('connections');
    const server = document.createElement('div');
    server.addEventListener('click', () => {
        // remove the selected class from all servers
        document.querySelectorAll('.server').forEach((servers) => {
            servers.classList.remove('selected');
        });
        // add the selected class to the clicked server
        servers.classList.add('selected');
    });
    server.classList.add('server');
    const serverStatus = document.createElement('span');
    serverStatus.id = 'server-status';
    serverStatus.innerHTML = 'Checking...';
    serverStatus.style.color = '#f4a261';
    const serverNameSpan = document.createElement('span');
    serverNameSpan.id = 'server-name';
    serverNameSpan.innerHTML = serverName;
    const remove = document.createElement('button');
    remove.id = 'remove-server';
    remove.innerHTML = '-';
    remove.addEventListener('click', () => {
        // Remove server from config file
        configJson.ServerList = configJson.ServerList.filter((server) => server.Name !== serverName);
        // Write to config file
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
        parent.removeChild(server);
    });
    server.appendChild(remove);
    const serverIpSpan = document.createElement('span');
    serverIpSpan.id = 'server-ip';
    serverIpSpan.innerHTML = serverIp;
    server.appendChild(serverStatus);
    server.appendChild(serverNameSpan);
    server.appendChild(serverIpSpan);
    parent.appendChild(server);
    // Add server to config file
    configJson.ServerList.push({
        Name: serverName,
        IP: serverIp,
    });

    // Write to config file
    fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
});

configJson.ServerList.forEach((server) => {
    const parent = document.getElementById('connections');
    const serverDiv = document.createElement('div');
    serverDiv.addEventListener('click', () => {
        // remove the selected class from all servers
        document.querySelectorAll('.server').forEach((server) => {
            server.classList.remove('selected');
        });
        // add the selected class to the clicked server
        serverDiv.classList.add('selected');
    });
    // add class
    serverDiv.classList.add('server');
    const serverStatus = document.createElement('span');
    serverStatus.id = 'server-status';
    serverStatus.innerHTML = 'Checking...';
    serverStatus.style.color = '#f4a261';
    const serverName = document.createElement('span');
    serverName.id = 'server-name';
    serverName.innerHTML = server.Name;
    const remove = document.createElement('button');
    remove.id = 'remove-server';
    remove.innerHTML = '-';
    remove.addEventListener('click', () => {
        // Remove server from config file
        configJson.ServerList = configJson.ServerList.filter((server) => server.Name !== serverName.innerHTML);
        // Write to config file
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
        parent.removeChild(serverDiv);
    });
    serverDiv.appendChild(remove);
    const serverIp = document.createElement('span');
    serverIp.id = 'server-ip';
    serverIp.innerHTML = server.IP;
    serverDiv.appendChild(serverStatus);
    serverDiv.appendChild(serverName);
    serverDiv.appendChild(serverIp);
    parent.appendChild(serverDiv);
});

setInterval(() => {
    // Only run if play online is checked
    configJson.ServerList.forEach((server) => {
        // Check if server is online
        let servers = document.getElementsByClassName('server');
        ping.sys.probe(server.IP, (isAlive) => {
            if (isAlive) {
                // Find the server in the DOM by ip
                for (let i = 0; i < servers.length; i++) {
                    const serverIP = servers[i].children[3].innerHTML;
                    if (serverIP == server.IP) {
                        servers[i].children[1].innerHTML = 'Online';
                        servers[i].children[1].style.color = '#2ecc71';
                    }
                }
            } else {
                // Find the server in the DOM by ip
                for (let i = 0; i < servers.length; i++) {
                    const serverIP = servers[i].children[3].innerHTML;
                    if (serverIP == server.IP) {
                        servers[i].children[1].innerHTML = 'Offline';
                        servers[i].children[1].style.color = '#e74c3c';
                    }
                }
            }
        });
    });
}, 5000);