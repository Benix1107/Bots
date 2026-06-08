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
    'Benix1107'
];

const proxies = [
    { host: '209.166.23.115',   port: 5276, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '209.166.22.21',    port: 5682, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '104.253.109.49',   port: 5327, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '209.166.3.57',     port: 7218, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
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

function scheduleRandomLook(bot, username) {
    const delay = 20000 + Math.random() * 40000; // 20–60s zufällig
    setTimeout(() => {
        if (!bot.entity || !bots[username]?.isOnline) return;
        bots[username].lastSeen = Date.now();
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5, true);
        scheduleRandomLook(bot, username);
    }, delay);
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
    let epipeOccurred = false;

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

                // Raw-Socket EPIPE/ECONNRESET still abfangen
                info.socket.on('error', (sockErr) => {
                    if (['EPIPE', 'ECONNRESET', 'ETIMEDOUT'].includes(sockErr.code)) return;
                    console.log(`[!] ${username} Socket-Fehler: ${sockErr.message}`);
                });

                proxy._failCount = 0;
                client.setSocket(info.socket);
                client.emit('connect');
            });
        }
    };

    const bot = mineflayer.createBot(botOptions);

    // ─── Resource Pack Fix für HugoSMP ───────────────────────────────────────
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

        scheduleRandomLook(bot, username);

        fireReady();
    });

    bot.on('login', () => console.log(`[i] ${username} logged in`));

    bot.on('end', (reason) => {
        console.log(`[-] ${username} getrennt: ${reason}`);
        if (bots[username]) {
            bots[username].isOnline = false;
            bots[username].onlineSince = null;
        }
        if (!offlineSince[username]) offlineSince[username] = Date.now();
        restartLock.delete(username);
        fireReady();

        // Bei EPIPE sofort reconnecten mit neuem Proxy, nicht 15 Min warten
        if (epipeOccurred) {
            console.log(`[🔄] ${username} — EPIPE-Reconnect sofort mit neuem Proxy`);
            accountState[username].currentProxyIdx = (accountState[username].currentProxyIdx + 1) % proxies.length;
            setTimeout(() => createBot(username), 10000); // 10s warten dann neu
        } else {
            scheduleReconnect(username, proxyFailed);
        }
    });

    bot.on('kicked', (reason) => {
        let reasonStr = reason;
        try { reasonStr = JSON.stringify(JSON.parse(reason), null, 2); } catch {}
        console.log(`[!] ${username} gekickt: ${reasonStr}`);
        if (bots[username]) {
            bots[username].isOnline = false;
            bots[username].onlineSince = null;
        }
        if (!offlineSince[username]) offlineSince[username] = Date.now();
        restartLock.delete(username);
        fireReady();
        setTimeout(() => createBot(username), RECONNECT_DELAY_NORMAL);
    });

    bot.on('error', (err) => {
        // EPIPE / ECONNRESET: Proxy-Drop, kein echter Fehler
        if (err.code === 'EPIPE' || err.code === 'ECONNRESET' || err.message.includes('EPIPE')) {
            console.log(`[!] ${username} — ${err.code || 'EPIPE'}, Proxy ${proxy.host} instabil`);
            proxy._failCount = (proxy._failCount || 0) + 1;
            if (proxy._failCount >= 2) markProxyBad(proxy.host);
            epipeOccurred = true;
            restartLock.delete(username);
            fireReady();
            return;
        }

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
