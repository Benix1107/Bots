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
    'NebelBenix', 'DrDihNut', 'Aawaz3', 'Saugroboter3', 'Oafka40',
];

const proxies = [
    { host: '166.0.40.18',      port: 7026, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '23.27.88.243',     port: 7245, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.23.91.207',     port: 7966, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '150.241.118.95',   port: 6097, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '23.27.67.12',      port: 6514, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '104.253.199.103',  port: 5382, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '104.253.248.205',  port: 5984, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '166.0.40.207',     port: 7215, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.23.89.158',     port: 7915, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.23.91.89',      port: 7848, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.29.142.53',     port: 7772, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.23.91.235',     port: 7994, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '82.23.86.82',      port: 7340, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '23.27.65.9',       port: 5512, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '150.241.119.33',   port: 5535, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '166.0.41.207',     port: 6715, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '209.166.23.115',   port: 5276, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '209.166.22.21',    port: 5682, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '104.253.109.49',   port: 5327, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
    { host: '209.166.3.57',     port: 7218, type: 5, username: 'kxjojarp', password: 'rrfizodtjsqj' },
];

// ─── KERN-ÄNDERUNG: Feste Proxy-Zuweisung pro Account ────────────────────────
// Jeder Account hat genau 1 Primary + max 2 Backup-Proxys
// Die Backups sind ebenfalls fix – kein zufälliges Rotieren!
const MAX_PROXY_SWITCHES = 2; // max Wechsel pro Account insgesamt

const RECONNECT_DELAY_NORMAL  = 5 * 60 * 1000;
const RECONNECT_DELAY_RETRY   = 60 * 60 * 1000;
const LOGIN_DELAY = 3 * 60 * 1000; // 3 Minuten zwischen jedem Account
const NOTIFY_COOLDOWN_MS      = 30 * 60 * 1000;
const MAX_JOIN_RETRIES        = 3;
const BAD_PROXY_TIMEOUT       = 60 * 60 * 1000;
const PROXY_CHECK_INTERVAL    = 20 * 60 * 1000;
const PROXY_TEST_TIMEOUT      = 8000;
const AUTH_ERROR_DELAY        = 30 * 60 * 1000;
const AUTH_MAX_RETRIES        = 3;
const STATUS_UPDATE_INTERVAL  = 6 * 60 * 60 * 1000;
const CRITICAL_EVENTS_ONLY    = true;

const bots = {};
const restartLock = new Set();
const notifyCooldown = {};
const badProxies = new Map();
const authErrorCount = {};
const offlineSince = {};

// Feste Proxy-Zuweisung: Account[i] → Primary Proxy[i], Backup[i+10], Backup[i+10+1]
// So hat jeder Account immer dieselben 3 IPs – Microsoft sieht max. 3 IPs pro Account
const accountState = {};
accounts.forEach((name, i) => {
    const primaryIdx = i % 10;           // Proxy 0–9: Primary-Pool
    const backup1Idx = 10 + (i % 10);   // Proxy 10–19: Backup 1
    const backup2Idx = 10 + ((i + 1) % 10); // Proxy 10–19: Backup 2 (leicht versetzt)

    accountState[name] = {
        proxyPool: [primaryIdx, backup1Idx, backup2Idx], // feste Reihenfolge
        currentPoolIdx: 0,   // Index in proxyPool (0 = primary, 1 = backup1, 2 = backup2)
        proxySwitches: 0,    // zählt wie oft gewechselt wurde
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
            body: JSON.stringify({ content: `🔔 ${msg} — 🕐 ${time}` })
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
}

function isProxyBad(host) {
    if (!badProxies.has(host)) return false;
    const since = badProxies.get(host);
    if (Date.now() - since > BAD_PROXY_TIMEOUT) {
        badProxies.delete(host);
        console.log(`[✓] Proxy ${host} wieder freigegeben`);
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
        isProxyBad(proxy.host); // expired entries clearen
        if (isProxyBad(proxy.host)) continue;
        const ok = await testProxy(proxy);
        if (!silent) console.log(`  ${ok ? '✅' : '⚠️'} ${proxy.host}:${proxy.port}`);
    }
    if (!silent) {
        const active = proxies.filter(p => !isProxyBad(p.host)).length;
        console.log(`[🔍] Check fertig — ${active}/${proxies.length} aktiv\n`);
    }
}

// ─── Proxy für Account holen (nur aus festem Pool!) ───────────────────────────

function getCurrentProxy(username) {
    const state = accountState[username];
    const idx = state.proxyPool[state.currentPoolIdx];
    return proxies[idx];
}

// Wechselt zum nächsten Backup – aber nur wenn noch Wechsel übrig
// Gibt false zurück wenn kein Wechsel mehr möglich
function switchToNextProxy(username) {
    const state = accountState[username];

    if (state.proxySwitches >= MAX_PROXY_SWITCHES) {
        console.log(`[⚠️] ${username} — max Proxy-Wechsel (${MAX_PROXY_SWITCHES}) erreicht, bleibe auf aktuellem Proxy`);
        return false;
    }

    if (state.currentPoolIdx >= state.proxyPool.length - 1) {
        console.log(`[⚠️] ${username} — kein weiterer Backup-Proxy verfügbar`);
        return false;
    }

    state.currentPoolIdx++;
    state.proxySwitches++;
    const newProxy = getCurrentProxy(username);
    console.log(`[🔀] ${username} — Wechsel zu Backup-Proxy #${state.currentPoolIdx}: ${newProxy.host} (${state.proxySwitches}/${MAX_PROXY_SWITCHES} Wechsel)`);
    return true;
}

// ─── Reconnect Logik ──────────────────────────────────────────────────────────

function scheduleReconnect(username, proxyFailed = false) {
    const state = accountState[username];

    if (proxyFailed) {
        const switched = switchToNextProxy(username);
        if (switched) {
            console.log(`[🔄] ${username} — Proxy-Problem, wechsle Proxy und warte 2 Min`);
            setTimeout(() => createBot(username), 2 * 60 * 1000);
        } else {
            // Kein Wechsel mehr → normaler Retry mit aktuellem Proxy
            console.log(`[🔄] ${username} — Proxy-Problem, kein Wechsel mehr, warte 15 Min`);
            setTimeout(() => createBot(username), 15 * 60 * 1000);
        }
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

// ─── Login Queue ──────────────────────────────────────────────────────────────

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
    const delay = 20000 + Math.random() * 40000;
    setTimeout(() => {
        if (!bot.entity || !bots[username]?.isOnline) return;
        bots[username].lastSeen = Date.now();
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5, true);
        scheduleRandomLook(bot, username);
    }, delay);
}

// ─── Bot erstellen ────────────────────────────────────────────────────────────

function createBot(username, onReady = null) {
    
    if (bots[username]?.isOnline) {
        console.log(`[⚠️] ${username} — bereits online, überspringe`);
        if (onReady) onReady();
        return;
    }

    if (restartLock.has(username)) {
        console.log(`[🔒] ${username} — restartLock aktiv`);
        if (onReady) onReady();
        return;
    }
    restartLock.add(username);

    const proxy = getCurrentProxy(username);
    const state = accountState[username];
    console.log(`\n[+] Starte ${username} via ${proxy.host}:${proxy.port} (Pool-Slot ${state.currentPoolIdx})`);

    let proxyFailed = false;
    let epipeOccurred = false;
    let disconnectHandled = false;
    let wasOnline = false;

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
                    if (proxy._failCount >= 2) markProxyBad(proxy.host);
                    proxyFailed = true;
                    client.emit('error', err);
                    return;
                }

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

    bot._client.on('add_resource_pack', (data) => {
        console.log(`[RP ${username}] Resource Pack → sende successfully_loaded`);
        bot._client.write('resource_pack_receive', {
            uuid: data.uuid,
            result: 0
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
        wasOnline = true; // NEU
        console.log(`[✓] ${username} online via ${proxy.host}`);
        bots[username].isOnline = true;
        bots[username].lastSeen = Date.now();
        bots[username].onlineSince = Date.now();
        offlineSince[username] = null;

        accountState[username].joinRetries = 0;
        notifyCooldown[username] = 0;
        proxy._failCount = 0;
        authErrorCount[username] = 0;

        restartLock.delete(username);

        setTimeout(() => {
            if (bot.entity) bot.chat('/afk');
        }, 3000);

        scheduleRandomLook(bot, username);
        fireReady();
    });

    bot.on('login', () => console.log(`[i] ${username} logged in`));

   bot.on('end', (reason) => {
    if (disconnectHandled) return;
    disconnectHandled = true;

    console.log(`[-] ${username} getrennt: ${reason}`);
    if (bots[username]) {
        bots[username].isOnline = false;
        bots[username].onlineSince = null;
    }
    if (!offlineSince[username]) offlineSince[username] = Date.now();
    restartLock.delete(username);
    fireReady();

    if (epipeOccurred) {
        // EPIPE: kurzer Reconnect, kein scheduleReconnect danach
        console.log(`[🔄] ${username} — EPIPE, reconnecte in 10s (gleicher Proxy)`);
        setTimeout(() => createBot(username), 10000);
    } else {
        scheduleReconnect(username, proxyFailed);
    }
});

    bot.on('kicked', (reason) => {
    let reasonStr;
    try {
        const parsed = typeof reason === 'string' ? JSON.parse(reason) : reason;
        reasonStr = parsed?.value?.text?.value || parsed?.text || JSON.stringify(parsed, null, 2);
    } catch {
        reasonStr = String(reason);
    }
    console.log(`[KICK ${username}] ${reasonStr}`);
    if (bots[username]) {
        bots[username].isOnline = false;
        bots[username].onlineSince = null;
    }
    if (!offlineSince[username]) offlineSince[username] = Date.now();
    restartLock.delete(username);
    fireReady();

    // Bei internal error länger warten
    const delay = reasonStr.includes('internal error') 
        ? 10 * 60 * 1000  // 10 Min
        : RECONNECT_DELAY_NORMAL; // 5 Min normal
    setTimeout(() => createBot(username), delay);
});

    bot.on('error', (err) => {
        if (err.code === 'EPIPE' || err.code === 'ECONNRESET' || err.message.includes('EPIPE')) {
    console.log(`[!] ${username} — ${err.code || 'EPIPE'}, Proxy instabil`);
    proxy._failCount = (proxy._failCount || 0) + 1;
    if (proxy._failCount >= 2) markProxyBad(proxy.host);
    epipeOccurred = true;
    // Kein fireReady, kein restartLock.delete hier – end kommt danach
    return;
}

        if (err.message.includes('Failed to obtain profile data')) {
            // Auth-Fehler: disconnectHandled ignorieren, eigene Logik
            if (disconnectHandled) return; // NEU
            disconnectHandled = true;      // NEU
            
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
                console.log(`[💤] ${username} — Warte ${Math.round(delayMs / 60000)} Min (Auth Backoff #${attempt})`);
                setTimeout(() => createBot(username), delayMs);
            }

            fireReady();
            return;
        }

        if (disconnectHandled) return;
        disconnectHandled = true;

        console.log(`[!] ${username} Fehler: ${err.message}`);
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
    // Proxy-Zuweisung anzeigen
    console.log('\n[📋] Proxy-Zuweisung:');
    accounts.forEach((name) => {
        const state = accountState[name];
        const poolInfo = state.proxyPool.map((idx, i) =>
            `${i === 0 ? 'P' : `B${i}`}:${proxies[idx].host}`
        ).join(' | ');
        console.log(`  ${name}: ${poolInfo}`);
    });
    console.log('');
    processLoginQueue();
});

setInterval(() => checkAllProxies(true), PROXY_CHECK_INTERVAL);

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
        const proxy = getCurrentProxy(username);
        const authErr = authErrorCount[username] > 0 ? ` | AuthErr: ${authErrorCount[username]}` : '';
        console.log(`  ${status} | ${username} | Proxy: ${proxy.host} (Slot ${state.currentPoolIdx}) | Aktivität: ${timeSince}s | Retries: ${state.joinRetries}${authErr}`);
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
