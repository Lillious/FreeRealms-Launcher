const {
    ipcRenderer
} = require('electron');
const {
    exec
} = require('child_process'); // Import exec function from child_process module
const util = require('util');
const execpromise = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');
const request = require('request');
const extract = require('extract-zip');
const fetch = require("node-fetch");

// Buttons
const close = document.getElementById('close');
const minimize = document.getElementById('minimize');
const startServer = document.getElementById('start-server');
const install = document.getElementById('install');
const play = document.getElementById('play-status');
const addServer = document.getElementById('add-server');

// Elements
const progressBarContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress');
const toast = document.getElementById('toast');

// Input fields
const serverName = document.getElementById('server-name-input');
const serverIp = document.getElementById('server-ip-input');
const firstName = document.getElementById('firstname');
const lastName = document.getElementById('lastname');
        

const exists = {
    client() {
        if (fs.existsSync(path.join(__dirname, '../Client/'))) return true;
        return false;
    },
    clientExecutable() {
        if (fs.existsSync(path.join(__dirname, '../Client/FreeRealms.exe'))) return true;
        return false;
    },
    server() {
        if (fs.existsSync(path.join(__dirname, '../Server/'))) return true;
        return false;
    },
    serverExecutable() {
        if (fs.existsSync(path.join(__dirname, '../Server/OSFRServer.exe'))) return true;
        return false;
    },
    config() {
        if (fs.existsSync(path.join(__dirname, '../config.json'))) return true;
        return false;
    },
    logs() {
        if (fs.existsSync(path.join(__dirname, '../log.txt'))) return true;
        return false;
    },
}

// Update first and last name from config.json
if (exists.config()) {
    const config = require(path.join(__dirname, '../config.json'));
    document.getElementById('firstname').value = config.FirstName || '';
    document.getElementById('lastname').value = config.LastName || '';
}

// Attempt to close the server if the window is closed
close.addEventListener('click', () => {
    exec('taskkill /f /im OSFRServer.exe', (err, stdout, stderr) => {
        ipcRenderer.send('close');
    });
});

// Minimize the window
minimize.addEventListener('click', () => {
    ipcRenderer.send('minimize');
});

// Porgress bar controls
const ProgressBar = {
    show() {
        progressBarContainer.style.display = 'block';
    },
    hide() {
        progressBarContainer.style.display = 'none';
    },
    update(value) {
        this.show();
        progressBar.style.width = `${value}%`;
        if (value === 100) {
            setTimeout(() => {
                progressBarContainer.style.display = 'none';
                this.update(0);
                this.hide();
            }, 500);
        }
    }
}

const ToastMessage = {
    update(message) {
        toast.innerHTML = message;
    },
    clear() {
        toast.innerHTML = '';
    }
}

const Prevent = {
    install() {
        install.disabled = true;
    },
    play() {
        play.disabled = true;
    }
}

const Allow = {
    install() {
        install.disabled = false;
    },
    play() {
        play.disabled = false;
    }
}

const Notification = {
    show(mode, message) {
        const NotificationContainer = document.createElement('div');
        const NotificationContent = document.createElement('div');
        NotificationContainer.classList.add('notification-bar');
        NotificationContent.classList.add('notification-content');
        NotificationContent.innerHTML = message;
        NotificationContainer.appendChild(NotificationContent);
        NotificationContainer.style.marginTop = `${50 * document.getElementsByClassName('notification-bar').length}px`;
        if (mode === 'success') NotificationContainer.style.borderRight = '4px solid #238636';
        else if (mode === 'error') NotificationContainer.style.borderRight = '4px solid #ed6a5e';
        else if (mode === 'information') NotificationContainer.style.borderRight = '4px solid #2a9d8f';
        document.body.appendChild(NotificationContainer);
        this.clear(NotificationContainer);
        if (!exists.logs()) fs.writeFileSync(path.join(__dirname, '../log.txt'), '');
        fs.appendFileSync(path.join(__dirname, '../log.txt'), `${new Date().toLocaleString()} [${mode}] ${message}\n`, (err) => {
            if (err) {
                console.error(err);
            }
        });
    },
    clear(notification) {
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 3000);
    }
}

const isRunning = {
    client() {
        return new Promise((resolve, reject) => {
            exec('tasklist', (err, stdout, stderr) => {
                if (err) {
                    reject(err)
                }
                if (stdout.includes('FreeRealms.exe')) resolve(true);
                resolve(false);
            });
        });
    },
    async server() {
        return new Promise((resolve, reject) => {
            exec('tasklist', (err, stdout, stderr) => {
                if (err) {
                    reject(err)
                }
                if (stdout.includes('OSFRServer.exe')) resolve(true);
                resolve(false);
            });
        });
    }
}

checkClientStatus();

function checkClientStatus() {
    isRunning.client().then((result) => {
        if (result) {
            play.innerHTML = 'Playing';
            Prevent.play();
        } else {
            play.innerHTML = 'Play';
            Allow.play();
        }
        setTimeout(() => {
            checkClientStatus();
        }, 3000);
    }).catch((err) => {
        console.error(err);
    });
}

checkServerStatus();

function checkServerStatus() {
    isRunning.server().then((result) => {
        if (result) {
            startServer.innerHTML = 'Stop Server';
        } else {
            startServer.innerHTML = 'Start Server';
        }
        setTimeout(() => {
            checkServerStatus();
        }, 3000);
    }).catch((err) => {
        console.error(err);
    });
}


// Check if client and server files exist
if ((exists.client() && exists.clientExecutable()) && (exists.server() && exists.serverExecutable())) {
    Prevent.install();
} else {
    Allow.install();
}

function getInstallerFile(installerfileURL, installerfilename, name) {
    var received_bytes = 0;
    var total_bytes = 0;
    var outStream = fs.createWriteStream(installerfilename);
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
                Prevent.install();
                ToastMessage.update(`${name} download is currently in progress...`);
                received_bytes += chunk.length;
                showDownloadingProgress(received_bytes, total_bytes);
            })
            .on('end', function() {
                Prevent.install();
                resolve();
            })
            .pipe(outStream);
    })
};

// Show the downloading progress of the installer and send it to the progress bar
function showDownloadingProgress(received, total) {
    ProgressBar.update(((received * 100) / total).toFixed(1));
}

const File = {
    async extract(type, source, target) {
        if (type === 'client') {
            try {
                await extract(source, {
                    dir: target
                })
                Notification.show('success', 'Client installed successfully');
                ToastMessage.clear();
                fs.unlink(path.join(__dirname, '../', 'Client.zip'), (err) => {
                    if (err) {
                        Notification.show('error', 'Error deleting Client.zip');
                    }
                });
            } catch (err) {
                Notification.show('error', 'Error extracting Client files');
                ProgressBar.hide();
                ToastMessage.clear();
            }
        }
        if (type === 'server') {
            try {
                await extract(source, {
                    dir: target
                })
                Notification.show('success', 'Server installed successfully');

                ToastMessage.clear();
                fs.unlink(path.join(__dirname, '../', 'Server.zip'), (err) => {
                    if (err) {
                        Notification.show('error', 'Error deleting Server.zip');
                    }
                });
            } catch (err) {
                Notification.show('error', 'Error extracting Server files');
                ProgressBar.hide();
                ToastMessage.clear();
            }
        }
    }
}
install.addEventListener('click', async () => {
    if (!exists.serverExecutable()) {
        getInstallerFile('https://files.lilliousnetworks.com/Server.zip', path.join(__dirname, '../', 'Server.zip'), "Server").then(() => {
            ToastMessage.update('Extracting files...');
            ProgressBar.hide();
            Prevent.install();
            File.extract('server', path.join(__dirname, '../', 'Server.zip'), path.join(__dirname, '../'));
        });
    }
    if (!exists.clientExecutable()) {
        ToastMessage.update('Client download is currently in progress...');
        ProgressBar.show();
        getInstallerFile('https://files.lilliousnetworks.com/Client.zip', path.join(__dirname, '../', 'Client.zip'), "Client").then(() => {
            ToastMessage.update('Extracting files...');
            ProgressBar.hide();
            Prevent.install();
            File.extract('client', path.join(__dirname, '../', 'Client.zip'), path.join(__dirname, '../'));
        });
    }
});

class OSFRServer {
    constructor(client, server, args) {
        this.client = client;
        this.server = server;
        this.args = args;
    }
    Start() {
        const config = fs.readFileSync(path.join(__dirname, '../Server/config.json'), 'utf8');
        if (config === '') {
            startServer.innerHTML = 'Start Server';
            showToast('error', `Invalid configuration file!`);
            return;
        }
        const process = exec(this.server, {
            cwd: path.join(__dirname, '../Server/')
        }, (err, stdout, stderr) => {});
        process.stderr.on('data', (data) => {
            console.log(data);
        });
        process.stdout.on('data', (data) => {
            console.log(data);
            if (data.includes('Started listening!')) {
                Notification.show('success', `Server started!`);
                startServer.innerHTML = 'Stop Server';
                return;
            }
            if (data.includes('Invalid configuration!')) {
                Notification.show('error', `Invalid configuration file!`);
                process.kill();
                return;
            }
        });
        process.on('error', (err) => {
            console.log(err);
        });
    }

    Stop() {
        exec('taskkill /f /im OSFRServer.exe', (err, stdout, stderr) => {
            if (err) {
                Notification.show('error', `Server stopped`);
                startServer.innerHTML = 'Stop Server';
                return;
            }
            Notification.show('error', `Server stopped`);
        });
    }

    Play() {
        const FirstName = document.getElementById('firstname').value.toString().charAt(0).toUpperCase() + document.getElementById('firstname').value.toString().slice(1).toLowerCase().replace(/[^a-zA-Z ]\s/g, "") || '';
        const LastName = document.getElementById('lastname').value.toString().charAt(0).toUpperCase() + document.getElementById('lastname').value.toString().slice(1).toLowerCase().replace(/[^a-zA-Z ]\s/g, "") || '';
        firstName.value = FirstName;
        lastName.value = LastName;
        if (FirstName === '') return Notification.show('error', `Please enter a valid first name!`);

        const config = fs.readFileSync(path.join(__dirname, '../Server/config.json'), 'utf8');
        if (config === '') {
            showToast('error', `Invalid or empty configuration file`);
            return;
        }
        if (!exists.config()) return Notification.show('error', `Invalid or empty configuration file`);

        const configPath = fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8');
        const configJson = JSON.parse(configPath);
        configJson.FirstName = FirstName;
        configJson.LastName = LastName;
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));

        const SelectedServer = document.getElementsByClassName('selected')[0];
        if (!SelectedServer) return Notification.show('error', `Please select a server!`);
        const serverIP = `Server=${SelectedServer.children[4].innerHTML}:20260`
        minimize.click();

        const process = exec(`${this.client} ${this.args} ${serverIP} Ticket=${configJson.FirstName}`, {
            cwd: path.join(__dirname, '../Client/')
        }, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
            }
        });

        process.stdout.on('data', (data) => {
            console.log(data);
        });
    }
}

const configPath = fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8');
const configJson = JSON.parse(configPath);
const args = `inifile=ClientConfig.ini Guid=${configJson.GUID} Internationalization:Locale=8 ShowMemberLoadingScreen=0 Country=US key=m80HqsRO9i4PjJSCOasVMg== CasSessionId=Jk6TeiRMc4Ba38NO`
const _OSFRServer = new OSFRServer("FreeRealms.exe", "OSFRServer.exe", args);

startServer.addEventListener('click', () => {
    if (startServer.innerHTML === 'Stop Server') {
        _OSFRServer.Stop();
        return;
    }
    if (!exists.server()) return Notification.show('error', `Please install the server first!`);
    _OSFRServer.Start();
});

play.addEventListener('click', () => {
    if (!exists.client()) return Notification.show('error', `Please install the client first!`);
    _OSFRServer.Play();
    Prevent.play();
    // Check if the client is running after 5 seconds. If it's not, DirectX9 is probably not installed. Show a notification with a link to download it.
    setTimeout(() => {
        if (!isRunning('FreeRealms.exe')) {
            Notification.show('error', `<a href="https://download.microsoft.com/download/1/7/1/1718CCC4-6315-4D8E-9543-8E28A4E18C4C/dxwebsetup.exe" target="">DirextX9</a> is required to play FreeRealms.`);
        }
    }, 5000);
});

const Server = {
    add(name, ip, setup) {
        if (name === "" || ip === "") return Notification.show('error', 'Please enter a valid server name and IP');
        if (ip.split('.').length !== 4) return Notification.show('error', 'Please enter a valid server IP');
        if (name.length > 8) return Notification.show('error', 'Server name must be less than 8 characters');
        if (ip.length > 15) return Notification.show('error', 'Server IP must be less than 15 characters');
        serverName.value = '';
        serverIp.value = '';
        if (!setup) {
            if (configJson.ServerList.find((_server) => _server.Name === name)) return Notification.show('error', 'Server already exists by that name');
            if (configJson.ServerList.find((_server) => _server.IP === ip)) return Notification.show('error', 'Server already exists by that IP');
        }
        const parent = document.getElementById('connections');
        const server = document.createElement('div');
        server.addEventListener('click', () => {
            document.querySelectorAll('.server').forEach((_server) => {
                _server.classList.remove('selected');
            });
            server.classList.add('selected');
        });
        server.classList.add('server');
        const serverStatus = document.createElement('span');
        serverStatus.id = 'server-status';
        serverStatus.innerHTML = 'Checking...';
        serverStatus.style.color = '#1f7fff';
        const serverNameSpan = document.createElement('span');
        serverNameSpan.id = 'server-name';
        serverNameSpan.innerHTML = name;
        const remove = document.createElement('button');
        remove.id = 'remove-server';
        remove.innerHTML = '-';
        remove.addEventListener('click', () => {
            this.remove(name, server, parent);
        });
        server.appendChild(remove);
        const serverIpSpan = document.createElement('span');
        serverIpSpan.id = 'server-ip';
        serverIpSpan.innerHTML = ip;
        const latency = document.createElement('span');
        latency.id = 'latency';
        latency.innerHTML = '';
        server.appendChild(serverStatus);
        server.appendChild(serverNameSpan);
        server.appendChild(latency);
        server.appendChild(serverIpSpan);
        parent.appendChild(server);
        if (!setup) {
            configJson.ServerList.push({
                Name: name,
                IP: ip,
            });

            if (exists.config()) {
                fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
            } else {
                Notification.show('error', `Invalid or empty configuration file`);
                parent.removeChild(server);
            }
        }
    },
    remove(name, server, parent) {
        configJson.ServerList = configJson.ServerList.filter((_server) => _server.Name !== name);
        fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configJson, null, 4));
        parent.removeChild(server);
    }
}

addServer.addEventListener('click', () => {
    Server.add(serverName.value, serverIp.value, false);
});

configJson.ServerList.forEach((server) => {
    Server.add(server.Name, server.IP, true);
});

async function ping(host, port) {
    const PowerShellVersion = await execpromise('powershell $PSVersionTable');
    if (PowerShellVersion.stderr) throw new Error(PowerShellVersion.stderr);
    if (port > 65535) return false;
    const {
        stdout,
        stderr
    } = await execpromise(`powershell Test-NetConnection ${host}`);
    if (stderr) throw new Error(stderr);
    const latency = stdout.replace(/\s/g, '').split(':').slice(-1)[0];
    if (stdout.replace(/\s/g, '').includes('PingSucceeded:True')) return [true, latency];
    return false;
}

CheckConnection();
async function CheckConnection() {
    let servers = document.getElementsByClassName('server');
    for (let i = 0; i < configJson.ServerList.length; i++) {
        const server = configJson.ServerList[i];
        if (server.IP != '127.0.0.1') {
            const result = await ping(server.IP, 80);
            if (result[0]) {
                const latency = parseInt(result[1].replace('ms', ''));
                for (let i = 0; i < servers.length; i++) {
                    const serverIP = servers[i].children[4].innerHTML;
                    if (serverIP == server.IP) {
                        servers[i].children[1].innerHTML = 'Online';
                        servers[i].children[1].style.color = '#2ecc71';
                        if (latency < 50) {
                            servers[i].children[3].style.color = '#2ecc71';
                        } else if (latency < 120) {
                            servers[i].children[3].style.color = '#f4a261';
                        } else if (latency >= 120) {
                            servers[i].children[3].style.color = '#ed6a5e';
                        }
                        servers[i].children[3].innerHTML = ` ${latency}ms`;
                    }
                }
            } else {
                for (let i = 0; i < servers.length; i++) {
                    const serverIP = servers[i].children[4].innerHTML;
                    if (serverIP == server.IP) {
                        servers[i].children[1].innerHTML = 'Offline';
                        servers[i].children[1].style.color = '#ed6a5e';
                        servers[i].children[3].innerHTML = '';
                    }
                }
            }
        } else {
            for (let i = 0; i < servers.length; i++) {
                const serverIP = servers[i].children[4].innerHTML;
                if (serverIP == server.IP) {
                    servers[i].children[1].innerHTML = 'Localhost';
                    servers[i].children[1].style.color = '#2ecc71';
                    servers[i].children[3].innerHTML = '';
                }
            }
        }
    }
    setTimeout(() => {
        CheckConnection();
    }, 1000);
}

// Check for updates
const version = require(path.join(__dirname, '../package.json')).version;
fetch("https://raw.githubusercontent.com/Lillious/FreeRealms-Launcher/main/package.json", {
    headers: {
        'Cache-Control': 'no-cache'
    }
}).then((res) => res.json()).then((json) => {
    if (!json.version) return console.error("Failed to check for updates");
    if (json.version > version) {
        Notification.show('info', `<a href="https://github.com/Lillious/FreeRealms-Launcher/releases/download/v${json.version}/FreeRealms.Launcher_v${json.version}.zip" target="">v${json.version}</a> is now available!`);
    }
});