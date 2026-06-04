const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'Hugosmp.net';
const PORT = 25565;

process.on('uncaughtException', (err) => {
    console.log(`[💥] Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
    console.log(`[💥] Unhandled Rejection: ${reason}`);
});

const accounts = [
    'NebelBand', 'FreeB4B', 'NebelBenix', 'alkaner12', 'Dihloco', 'meloupup', 'DrDihNut', 'Aawaz3', 'Saugroboter3', 'Oafka40', 'FullestFox'
];

const proxies = [
    { host: '77.83.233.87', port: 6705, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '172.98.168.203', port: 6850, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.26', port: 7097, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.57.76.118', port: 5690, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.9.30', port: 6103, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.69', port: 5642, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '77.83.233.28', port: 6646, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.74', port: 6728, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.4', port: 6658, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.238', port: 5947, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.117.55.230', port: 6876, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.53.67', port: 7439, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.75', port: 5784, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '77.83.233.243', port: 6861, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.53.140', port: 7512, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '92.119.182.209', port: 6854, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '77.83.233.10', port: 6628, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.85', port: 6739, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.11', port: 7082, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.180', port: 5753, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.9.191', port: 6264, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.113.119.117', port: 6791, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.57.76.2', port: 5574, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.177.59', port: 5432, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '92.119.182.179', port: 6824, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.54.137', port: 7009, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.9.234', port: 6307, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.54.231', port: 7103, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.113.119.94', port: 6768, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.189', port: 6843, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.54.188', port: 7060, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.58', port: 6460, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.54.149', port: 7021, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.22.234.49', port: 7899, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.142', port: 6544, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.16', port: 6670, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.166', port: 5875, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.63', port: 6135, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.243', port: 6897, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.147.186.86', port: 6959, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '77.83.233.236', port: 6854, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.113.119.195', port: 6869, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.127', port: 6781, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.2', port: 7073, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.117.55.249', port: 6895, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.79', port: 5788, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.195', port: 267, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.22.234.212', port: 8062, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.147.186.209', port: 7082, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.177.139', port: 5512, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '172.98.168.226', port: 6873, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.54.205', port: 7077, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.117.55.148', port: 6794, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.53.113', port: 7485, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '172.98.168.185', port: 6832, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.179.137', port: 5509, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.117.55.242', port: 6888, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.147.186.183', port: 7056, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.185', port: 5894, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '92.119.182.216', port: 6861, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.249', port: 6903, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.170', port: 5879, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.113.119.229', port: 6903, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.39.33.99', port: 5808, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '194.113.119.90', port: 6764, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.151', port: 6223, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.233', port: 7304, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.179.193', port: 5565, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.9.249', port: 6322, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.144', port: 6216, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.9.54', port: 6127, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.112', port: 6766, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.138', port: 5711, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.247', port: 6319, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '172.98.168.49', port: 6696, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.66', port: 5639, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.97', port: 6499, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.22.234.85', port: 7935, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.22.234.62', port: 7912, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.179.141', port: 5513, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '154.36.110.250', port: 6904, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.91', port: 6163, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.158', port: 7229, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.117.55.22', port: 6668, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.222', port: 5795, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '206.232.70.78', port: 7149, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.123', port: 6195, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.59.10.43', port: 5614, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.179.66', port: 5438, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.58.23.75', port: 5648, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.59.10.213', port: 5784, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.89', port: 6491, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '172.98.168.210', port: 6857, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.200', port: 6272, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.31', port: 6433, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '31.56.138.214', port: 6286, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.150.177.251', port: 5624, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.159.53.198', port: 7570, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '45.151.162.180', port: 6582, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' }
];

const RECONNECT_DELAY_NORMAL  = 5 * 60 * 1000;
const RECONNECT_DELAY_RETRY   = 60 * 60 * 1000;
const PROXY_SWITCH_DELAY      = 15 * 60 * 1000;
const LOGIN_DELAY             = 30 * 1000;
const NOTIFY_COOLDOWN_MS      = 30 * 60 * 1000;
const MAX_PROXY_ATTEMPTS      = 2;
const MAX_JOIN_RETRIES        = 3;
const BAD_PROXY_TIMEOUT       = 60 * 60 * 1000;
const PROXY_CHECK_INTERVAL    = 20 * 60 * 1000;
const PROXY_TEST_TIMEOUT      = 8000;
const AUTH_ERROR_DELAY        = 30 * 60 * 1000;
const AUTH_MAX_RETRIES        = 3;
const STATUS_UPDATE_INTERVAL  = 2 * 60 * 60 * 1000;
const CRITICAL_EVENTS_ONLY    = true;

const bots = {};
const restartLock = new Set();
const notifyCooldown = {};
const badProxies = new Map();
const authErrorCount = {};
const offlineSince = {};

const accountState = {};
accounts.forEach((name, i) => {
    accountState[name] = {
        currentProxyIdx: i % proxies.length,
        proxyAttempts: 0,
        joinRetries: 0,
    };
    authErrorCount[name] = 0;
    offlineSince[name] = Date.now();
});

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1510411219654148167/l4a4xjAlMUq2-sZF8P3Lgta9ND2_q_77uVsuACuFgpwt9huPczS81NHLG_3LfpVrkbOw';

// ─── Notify ───────────────────────────────────────────────────────────────────

async function notify(msg, username = null, force = false, critical = false) {
    if (CRITICAL_EVENTS_ONLY && !critical && !force) return;

    if (username && !force && !critical) {
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
                content: `🔔 ${msg} — 🕐 ${time}`
            })
        });
    } catch (err) {
        console.log(`[!] Discord Webhook Fehler: ${err.message}`);
    }
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

function clearTokenCache(username) {
    const baseDir = process.env.APPDATA || os.homedir();
    const cachePaths = [
        path.join(baseDir, '.minecraft', 'nmp-cache.json'),
        path.join(os.homedir(), '.minecraft', 'nmp-cache.json'),
    ];

    for (const p of cachePaths) {
        try {
            if (fs.existsSync(p)) {
                fs.unlinkSync(p);
                console.log(`[Auth] Token-Cache gelöscht: ${p}`);
            }
        } catch (e) {
            console.warn(`[Auth] Cache konnte nicht gelöscht werden: ${e.message}`);
        }
    }
}

// ─── Proxy Health System ──────────────────────────────────────────────────────

function markProxyBad(host) {
    if (badProxies.has(host)) return;
    badProxies.set(host, Date.now());
    console.log(`[✗] Proxy ${host} deaktiviert für 1 Stunde`);

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
        console.log(`[✓] Proxy ${host} wieder freigegeben nach 1h`);
        return false;
    }
    return true;
}

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

async function checkAllProxies(silent = true) {
    if (!silent) console.log('\n[🔍] Proxy Status Check...');

    for (const proxy of proxies) {
        isProxyBad(proxy.host);

        if (isProxyBad(proxy.host)) {
            const since = badProxies.get(proxy.host);
            const remaining = Math.round((BAD_PROXY_TIMEOUT - (Date.now() - since)) / 60000);
            if (!silent) console.log(`  ⏳ ${proxy.host} — gesperrt noch ~${remaining} Min`);
            continue;
        }

        const ok = await testProxy(proxy);
        if (!silent) console.log(`  ${ok ? '✅' : '⚠️'} ${proxy.host}:${proxy.port}`);
    }

    if (!silent) {
        const active = proxies.filter(p => !isProxyBad(p.host)).length;
        console.log(`[🔍] Check fertig — ${active}/${proxies.length} aktiv\n`);
    }
}

// ─── Proxy Auswahl ────────────────────────────────────────────────────────────

function findBestProxy(username) {
    const state = accountState[username];

    const fixed = proxies[state.currentProxyIdx];
    if (!isProxyBad(fixed.host)) return fixed;

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
        console.log(`[🔄] ${username} — Proxy-Problem, warte 15 Min`);
        setTimeout(() => {
            const newProxy = findBestProxy(username);
            console.log(`[🔀] ${username} versucht Proxy ${newProxy.host}`);
            createBot(username);
        }, PROXY_SWITCH_DELAY);
        return;
    }

    state.joinRetries++;

    if (state.joinRetries > MAX_JOIN_RETRIES) {
        const waitMin = Math.round(RECONNECT_DELAY_RETRY / 60000);
        console.log(`[⏳] ${username} — ${state.joinRetries}. Fehlversuch, warte ${waitMin} Min`);
        setTimeout(() => createBot(username), RECONNECT_DELAY_RETRY);
    } else {
        console.log(`[⏳] ${username} — Reconnect in 5 Min (Versuch ${state.joinRetries}/${MAX_JOIN_RETRIES})`);
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
        console.log(`[🔒] ${username} — restartLock aktiv`);
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
        version: '1.21.4',
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
                    console.log(`[!] Proxy ${proxy.host} Fehler: ${err.message}`);
                    proxy._failCount = (proxy._failCount || 0) + 1;

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

    // ─── Resource Pack Fix für HugoSMP ───────────────────────────────────────
    // HugoSMP hängt im Configuration State bis das Resource Pack bestätigt wird
    bot._client.on('add_resource_pack', (data) => {
        console.log(`[RP ${username}] Resource Pack → sende successfully_loaded`);
        bot._client.write('resource_pack_receive', {
            uuid: data.uuid,
            result: 0 // 0 = successfully_loaded
        });
    });

    bots[username] = {
        bot,
        lastSeen: Date.now(),
        onlineSince: null,
        isOnline: false,
        proxy: proxy.host,
        afkInterval: null,
    };

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
        bots[username].onlineSince = Date.now();
        offlineSince[username] = null;

        accountState[username].joinRetries = 0;
        accountState[username].proxyAttempts = 0;
        notifyCooldown[username] = 0;
        proxy._failCount = 0;
        authErrorCount[username] = 0;

        restartLock.delete(username);

        setTimeout(() => {
            if (bot.entity) bot.chat('/afk 35');
        }, 3000);

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
        if (bots[username]) {
            bots[username].isOnline = false;
            bots[username].onlineSince = null;
        }
        if (!offlineSince[username]) offlineSince[username] = Date.now();
        restartLock.delete(username);
        fireReady();
        scheduleReconnect(username, proxyFailed);
    });

    bot.on('kicked', (reason) => {
        console.log(`[!] ${username} gekickt: ${reason}`);
        if (bots[username]?.afkInterval) clearInterval(bots[username].afkInterval);
        if (bots[username]) {
            bots[username].isOnline = false;
            bots[username].onlineSince = null;
        }
        if (!offlineSince[username]) offlineSince[username] = Date.now();
        restartLock.delete(username);
        setTimeout(() => createBot(username), RECONNECT_DELAY_NORMAL);
        fireReady();
    });

    bot.on('error', (err) => {
        console.log(`[!] ${username} Fehler: ${err.message}`);

        if (err.message.includes('Failed to obtain profile data')) {
            authErrorCount[username] = (authErrorCount[username] || 0) + 1;
            const attempt = authErrorCount[username];

            console.log(`[💤] ${username} — Auth-Fehler #${attempt}, lösche Token-Cache...`);
            clearTokenCache(username);

            restartLock.delete(username);

            if (attempt >= AUTH_MAX_RETRIES) {
                setTimeout(() => {
                    authErrorCount[username] = 0;
                    createBot(username);
                }, 60 * 60 * 1000);
            } else {
                const delayMs = Math.min(5 * 60 * 1000 * Math.pow(3, attempt - 1), AUTH_ERROR_DELAY);
                const delayMin = Math.round(delayMs / 60000);
                console.log(`[💤] ${username} — Warte ${delayMin} Min (Auth Backoff #${attempt})`);
                setTimeout(() => createBot(username), delayMs);
            }

            fireReady();
            return;
        }

        restartLock.delete(username);
        fireReady();
    });

    setTimeout(() => {
        restartLock.delete(username);
        fireReady();
    }, 60000);
}

// ─── Start ────────────────────────────────────────────────────────────────────

checkAllProxies(true).then(() => {
    processLoginQueue();
});

setInterval(() => checkAllProxies(true), PROXY_CHECK_INTERVAL);

// ─── Health Check alle 5 Min ─────────────────────────────────────────────────

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
        const authErr = authErrorCount[username] > 0 ? ` | AuthErr: ${authErrorCount[username]}` : '';
        console.log(`  ${status} | ${username} | Proxy: ${data.proxy} | Aktivität: ${timeSince}s | Retries: ${state.joinRetries}${authErr}`);
    }

    const badList = [...badProxies.keys()];
    console.log(`  Bad Proxies: ${badList.length > 0 ? badList.join(', ') : 'keine'}`);
    console.log('-----------------------------------\n');
}, 5 * 60 * 1000);

// ─── Status Update alle 2 Stunden ────────────────────────────────────────────

setInterval(() => {
    const now = Date.now();
    let onCount = 0, totalOnMin = 0;
    const offLines = [];

    for (const username of accounts) {
        const data  = bots[username];
        const state = accountState[username];
        if (data?.isOnline && data.onlineSince) {
            onCount++;
            totalOnMin += Math.round((now - data.onlineSince) / 60000);
        } else {
            const offMin = offlineSince[username]
                ? Math.round((now - offlineSince[username]) / 60000)
                : '?';
            offLines.push(`${username}(${offMin}m,r${state.joinRetries})`);
        }
    }

    const avgOn = onCount > 0 ? Math.round(totalOnMin / onCount) : 0;
    const bad   = [...badProxies.keys()];

    const parts = [
        `📊 ${new Date().toLocaleTimeString('de-DE')} ✅${onCount}/${accounts.length} ~${avgOn}m`,
        offLines.length ? `❌ ${offLines.join(' ')}` : null,
        bad.length      ? `🚫 ${bad.join(',')}` : null,
    ].filter(Boolean);

    fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parts.join('\n') })
    }).catch(() => {});
}, STATUS_UPDATE_INTERVAL);
