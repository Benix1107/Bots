const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');

const HOST = 'donutsmp.net';
const PORT = 25565;

// Ganz oben hinzufügen — fängt unerwartete Crashes ab
process.on('uncaughtException', (err) => {
    console.log(`[💥] Uncaught Exception: ${err.message}`);
    notify(`💥 **Script Fehler:** \`${err.message}\``, null, true);
});

process.on('unhandledRejection', (reason) => {
    console.log(`[💥] Unhandled Rejection: ${reason}`);
    notify(`💥 **Script Rejection:** \`${reason}\``, null, true);
});

const accounts = [
    'NebelBenix', 'Aawaz3', 'Saugroboter3', 'Oafka40'
];

const proxies = [
    { host: '167.71.32.51',   port: 1080, type: 5, username: '', password: '' },
    { host: '192.252.214.17', port: 4145, type: 5, username: '', password: '' },
    //{ host: '67.201.35.145',  port: 4145, type: 5, username: '', password: '' },
    { host: '174.75.211.193', port: 4145, type: 5, username: '', password: '' },
    { host: '72.223.188.67',  port: 4145, type: 5, username: '', password: '' },
    { host: '72.207.33.64',   port: 4145, type: 5, username: '', password: '' },
];

const RECONNECT_DELAY_NORMAL = 5 * 60 * 1000;
const RECONNECT_DELAY_RETRY  = 60 * 60 * 1000;
const PROXY_SWITCH_DELAY     = 15 * 60 * 1000;
const LOGIN_DELAY            = 30 * 1000;
const NOTIFY_COOLDOWN_MS     = 5 * 60 * 1000;
const MAX_PROXY_ATTEMPTS     = 2;
const MAX_JOIN_RETRIES       = 3;
const BAD_PROXY_TIMEOUT      = 60 * 60 * 1000; // 1.5 Stunden
const PROXY_CHECK_INTERVAL   = 20 * 60 * 1000;
const PROXY_TEST_TIMEOUT     = 8000;

const bots = {};
const restartLock = new Set();
const notifyCooldown = {};
const badProxies = new Map(); // host → timestamp

const accountState = {};
accounts.forEach((name, i) => {
    accountState[name] = {
        currentProxyIdx: i % proxies.length,
        proxyAttempts: 0,
        joinRetries: 0,
    };
});

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1510411219654148167/l4a4xjAlMUq2-sZF8P3Lgta9ND2_q_77uVsuACuFgpwt9huPczS81NHLG_3LfpVrkbOw';

// ─── Notify ───────────────────────────────────────────────────────────────────

async function notify(msg, username = null, force = false) {
    if (username && !force) {
        const last = notifyCooldown[username] || 0;
        if (Date.now() - last < NOTIFY_COOLDOWN_MS) return;
        notifyCooldown[username] = Date.now();
    }

    const time = new Date().toLocaleTimeString('de-DE');
    console.log(`\n🔔 [${time}] ${msg}\n`);

    try {
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content:
                    '----------------------------------------------------------------------\n' +
                    `🔔 **Bot Benachrichtigung**\n${msg}\n🕐 ${time}` +
                    '\n----------------------------------------------------------------------'
            })
        });
    } catch (err) {
        console.log(`[!] Discord Webhook Fehler: ${err.message}`);
    }
}

// ─── Proxy Health System ──────────────────────────────────────────────────────

function markProxyBad(host) {
    if (badProxies.has(host)) return;
    badProxies.set(host, Date.now());
    console.log(`[✗] Proxy ${host} als bad markiert für 1.5 Stunden`);
    notify(`🔴 Proxy \`${host}\` deaktiviert für 1.5 Stunden`, null, true);

    // Alle Bots die diesen Proxy nutzen neu verbinden
    for (const username of accounts) {
        const data = bots[username];
        if (data && data.proxy === host && data.isOnline) {
            console.log(`[→] ${username} nutzt bad proxy → wird neu verbunden`);
            try { data.bot.end(); } catch (e) {}
        }
    }
}

function isProxyBad(host) {
    if (!badProxies.has(host)) return false;
    const since = badProxies.get(host);
    if (Date.now() - since > BAD_PROXY_TIMEOUT) {
        badProxies.delete(host);
        // failCount NICHT resetten — bleibt bei 0 nach erfolgreichem Bot-Connect
        console.log(`[✓] Proxy ${host} wieder freigegeben nach 1.5h`);
        notify(`🟢 Proxy \`${host}\` ist wieder verfügbar`, null, true);
        return false;
    }
    return true;
}

// Proxy Check — NUR für Statusanzeige, beeinflusst _failCount NICHT
function testProxy(proxy) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), PROXY_TEST_TIMEOUT);

        SocksClient.createConnection({
            proxy: {
                host: proxy.host,
                port: proxy.port,
                type: 5,
                userId: proxy.username || undefined,
                password: proxy.password || undefined,
            },
            command: 'connect',
            destination: { host: HOST, port: PORT },
        }, (err, info) => {
            clearTimeout(timer);
            if (err) {
                resolve(false);
            } else {
                try { info.socket.destroy(); } catch (e) {}
                resolve(true);
            }
        });
    });
}

// Nur zur Anzeige — kein Einfluss auf badProxies oder _failCount
async function checkAllProxies(silent = false) {
    if (!silent) console.log('\n[🔍] Proxy Status Check (nur Anzeige)...');

    for (const proxy of proxies) {
        if (isProxyBad(proxy.host)) {
            const since = badProxies.get(proxy.host);
            const remaining = Math.round((BAD_PROXY_TIMEOUT - (Date.now() - since)) / 60000);
            if (!silent) console.log(`  ⏳ ${proxy.host}:${proxy.port} — bad für noch ~${remaining} Min`);
            continue;
        }

        const ok = await testProxy(proxy);
        if (!silent) console.log(`  ${ok ? '✅' : '⚠️'} ${proxy.host}:${proxy.port}${!ok ? ' (TCP-Test fehlgeschlagen, aber noch nicht bad)' : ''}`);
    }

    if (!silent) {
        const active = proxies.filter(p => !isProxyBad(p.host)).length;
        console.log(`[🔍] Check fertig — ${active}/${proxies.length} nicht gesperrt\n`);
    }
}

// ─── Proxy Auswahl ────────────────────────────────────────────────────────────

function findBestProxy(username) {
    const state = accountState[username];

    const fixed = proxies[state.currentProxyIdx];
    if (!isProxyBad(fixed.host)) return fixed;

    // Fixer Proxy ist bad → suche Alternative
    for (let i = 1; i < proxies.length; i++) {
        const idx = (state.currentProxyIdx + i) % proxies.length;
        if (!isProxyBad(proxies[idx].host)) {
            if (state.proxyAttempts < MAX_PROXY_ATTEMPTS) {
                state.currentProxyIdx = idx;
                state.proxyAttempts++;
                console.log(`[→] ${username} weicht auf Proxy ${proxies[idx].host} aus`);
                return proxies[idx];
            }
        }
    }

    return proxies[state.currentProxyIdx];
}

// ─── Reconnect Logik ──────────────────────────────────────────────────────────

function scheduleReconnect(username, proxyFailed = false) {
    const state = accountState[username];

    if (proxyFailed) {
        notify(
            `🔄 **${username}** — Proxy-Problem!\n→ Warte 15 Min, dann Proxy-Wechsel`,
            username, true
        );

        setTimeout(() => {
            const newProxy = findBestProxy(username);
            notify(
                `🔀 **${username}** versucht Proxy \`${newProxy.host}:${newProxy.port}\``,
                username, true
            );
            createBot(username);
        }, PROXY_SWITCH_DELAY);

        return;
    }

    state.joinRetries++;

    if (state.joinRetries > MAX_JOIN_RETRIES) {
        const waitMin = Math.round(RECONNECT_DELAY_RETRY / 60000);
        notify(
            `⏳ **${username}** — ${state.joinRetries}. Fehlversuch!\n→ Warte **${waitMin} Min**`,
            username, true
        );
        setTimeout(() => createBot(username), RECONNECT_DELAY_RETRY);
    } else {
        const waitMin = Math.round(RECONNECT_DELAY_NORMAL / 60000);
        notify(
            `❌ **${username}** offline!\n→ Reconnect in ${waitMin} Min (Versuch ${state.joinRetries}/${MAX_JOIN_RETRIES})`,
            username
        );
        setTimeout(() => createBot(username), RECONNECT_DELAY_NORMAL);
    }
}

// ─── Bot erstellen ────────────────────────────────────────────────────────────

let loginQueue = [...accounts];
let loginRunning = false;

async function processLoginQueue() {
    if (loginRunning) return;
    loginRunning = true;

    while (loginQueue.length > 0) {
        const username = loginQueue.shift();
        await new Promise(resolve => createBot(username, resolve));

        if (loginQueue.length > 0) {
            console.log(`[⏳] Warte ${LOGIN_DELAY / 1000}s vor nächstem Login...`);
            await new Promise(r => setTimeout(r, LOGIN_DELAY));
        }
    }

    loginRunning = false;
}

function createBot(username, onReady = null) {
    if (restartLock.has(username)) {
        if (onReady) onReady();
        return;
    }
    restartLock.add(username);

    const proxy = findBestProxy(username);
    console.log(`\n[+] Starte ${username} via ${proxy.host}:${proxy.port}`);

    let proxyFailed = false;

    const botOptions = {
        host: HOST,
        port: PORT,
        username,
        auth: 'microsoft',
        version: '1.21.1',
        connect: (client) => {
            SocksClient.createConnection({
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    type: 5,
                    userId: proxy.username || undefined,
                    password: proxy.password || undefined,
                },
                command: 'connect',
                destination: { host: HOST, port: PORT },
            }, (err, info) => {
                if (err) {
                    console.log(`[!] Proxy ${proxy.host} Verbindungsfehler: ${err.message}`);

                    // _failCount nur bei echten Bot-Verbindungsfehlern erhöhen
                    proxy._failCount = (proxy._failCount || 0) + 1;
                    console.log(`[!] Proxy ${proxy.host} Fehler #${proxy._failCount}`);

                    if (proxy._failCount >= 2) {
                        markProxyBad(proxy.host);
                    }

                    proxyFailed = true;
                    client.emit('error', err);
                    return;
                }

                proxy._failCount = 0;
                client.setSocket(info.socket);
                client.emit('connect');
            });
        }
    };

    const bot = mineflayer.createBot(botOptions);

    bots[username] = {
        bot,
        lastSeen: Date.now(),
        isOnline: false,
        proxy: proxy.host,
        afkInterval: null,
    };

    restartLock.delete(username);

    let readyFired = false;
    function fireReady() {
        if (!readyFired && onReady) {
            readyFired = true;
            onReady();
        }
    }

    bot.once('spawn', () => {
        console.log(`[✓] ${username} online via ${proxy.host}`);
        bots[username].isOnline = true;
        bots[username].lastSeen = Date.now();

        accountState[username].joinRetries = 0;
        accountState[username].proxyAttempts = 0;
        notifyCooldown[username] = 0;
        proxy._failCount = 0;

        setTimeout(() => {
            if (bot.entity) bot.chat('/afk 35');
        }, 3000);

        notify(
            `✅ **${username}** online auf **${HOST}**!\nProxy: \`${proxy.host}:${proxy.port}\``,
            username, true
        );

        if (bots[username].afkInterval) clearInterval(bots[username].afkInterval);
        bots[username].afkInterval = setInterval(() => {
            if (!bot.entity) return;
            bots[username].lastSeen = Date.now();
            bot.look(Math.random() * Math.PI * 2, 0, true);
        }, 30000);

        fireReady();
    });

    bot.on('login', () => console.log(`[i] ${username} logged in`));

    bot.on('end', (reason) => {
        console.log(`[-] ${username} getrennt: ${reason}`);
        if (bots[username]?.afkInterval) clearInterval(bots[username].afkInterval);
        if (bots[username]) bots[username].isOnline = false;
        fireReady();
        scheduleReconnect(username, proxyFailed);
    });

    bot.on('kicked', (reason) => {
        console.log(`[!] ${username} gekickt: ${reason}`);
        notify(
            `🚫 **${username}** gekickt von **${HOST}**!\nGrund: \`${reason}\`\n→ Reconnect in ${RECONNECT_DELAY_NORMAL / 60000} Min`,
            username, true
        );
        setTimeout(() => createBot(username), RECONNECT_DELAY_NORMAL);
    });

    bot.on('error', (err) => {
    console.log(`[!] ${username} Fehler: ${err.message}`);

    if (err.message.includes('Failed to obtain profile data')) {
        console.log(`[💤] ${username} — Account-Fehler, warte 15 Min...`);
        notify(
            `💤 **${username}** — Account-Fehler (Minecraft Profil)!\n→ Warte 15 Min vor erneutem Versuch`,
            username, true
        );

        // Nicht scheduleReconnect aufrufen — direkt 15 Min warten
        setTimeout(() => createBot(username), 15 * 60 * 1000);

        // fireReady damit die Login-Queue weiterläuft
        fireReady();
        return;
    }

    fireReady();
});

    setTimeout(() => fireReady(), 60000);
}

// ─── Start ────────────────────────────────────────────────────────────────────

checkAllProxies().then(() => {
    processLoginQueue();
});

setInterval(() => checkAllProxies(), PROXY_CHECK_INTERVAL);

// ─── Health Check alle 5 Min ──────────────────────────────────────────────────

setInterval(() => {
    const now = Date.now();
    console.log(`\n--- Health Check [${new Date().toLocaleTimeString('de-DE')}] ---`);

    for (const username of accounts) {
        const data = bots[username];
        const state = accountState[username];

        if (!data || !data.bot) {
            console.log(`[?] ${username}: kein Bot-Objekt`);
            continue;
        }

        const timeSince = Math.round((now - data.lastSeen) / 1000);
        const status = data.isOnline ? '✅ online' : '❌ offline';
        console.log(`  ${status} | ${username} | Proxy: ${data.proxy} | Aktivität: ${timeSince}s | Retries: ${state.joinRetries}`);
    }

    const badList = [...badProxies.keys()];
    console.log(`  Bad Proxies: ${badList.length > 0 ? badList.join(', ') : 'keine'}`);
    console.log('-----------------------------------\n');
}, 5 * 60 * 1000);

// ─── Status Update alle 30 Min ───────────────────────────────────────────────

setInterval(() => {
    const online = [];
    const offline = [];

    for (const username of accounts) {
        const data = bots[username];
        const state = accountState[username];
        if (data?.isOnline) {
            online.push(`✅ ${username} — Proxy: \`${data.proxy}\``);
        } else {
            offline.push(`❌ ${username} (Retries: ${state.joinRetries})`);
        }
    }

    const badList = [...badProxies.keys()];

    const lines = [
        `📊 **Status Update** — ${new Date().toLocaleTimeString('de-DE')}`,
        ``,
        `**Online (${online.length}/${accounts.length}):**`,
        online.length > 0 ? online.join('\n') : '_Niemand online_',
        ``,
        `**Offline (${offline.length}/${accounts.length}):**`,
        offline.length > 0 ? offline.join('\n') : '_Alle online_ 🎉',
        ``,
        `**Deaktivierte Proxies:** ${badList.length > 0 ? badList.join(', ') : 'keine'}`,
    ];

    notify(lines.join('\n'), null, true);
}, 30 * 60 * 1000);
