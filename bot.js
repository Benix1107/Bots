const mineflayer = require('mineflayer');
const { SocksClient } = require('socks');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    //{ host: '192.252.214.17', port: 4145, type: 5, username: '', password: '' },
    //{ host: '67.201.35.145',  port: 4145, type: 5, username: '', password: '' },
    //{ host: '174.75.211.193', port: 4145, type: 5, username: '', password: '' },
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
const BAD_PROXY_TIMEOUT      = 60 * 60 * 1000; // 1 Stunde
const PROXY_CHECK_INTERVAL   = 20 * 60 * 1000;
const PROXY_TEST_TIMEOUT     = 8000;
// FIX: 30 Min statt 15 Min — Mojang hat ein Rate-Limit auf den Session-Endpunkt,
//      zu schnelle Retries führen wieder zum selben "Failed to obtain profile data" Fehler
const AUTH_ERROR_DELAY       = 30 * 60 * 1000;
const AUTH_MAX_RETRIES       = 3;

const bots = {};
// FIX: restartLock wurde bisher zu früh gelöscht (vor Bot-Initialisierung),
//      was Race Conditions bei Reconnects verursacht hat
const restartLock = new Set();
const notifyCooldown = {};
const badProxies = new Map(); // host → timestamp

// FIX: Auth-Fehler Counter pro Account tracken
const authErrorCount = {};

const accountState = {};
accounts.forEach((name, i) => {
    accountState[name] = {
        currentProxyIdx: i % proxies.length,
        proxyAttempts: 0,
        joinRetries: 0,
    };
    authErrorCount[name] = 0;
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

// ─── FIX: Token-Cache löschen ─────────────────────────────────────────────────
// Mineflayer/minecraft-protocol speichert Microsoft-Tokens lokal.
// Wenn dieser Cache korrupt oder abgelaufen ist, schlägt Auth stumm fehl.
// Lösung: Cache-Dateien vor dem Retry löschen, damit frischer Token geholt wird.

function clearTokenCache(username) {
    const baseDir = process.env.APPDATA || os.homedir();

    // minecraft-protocol speichert Tokens hier:
    const cachePaths = [
        path.join(baseDir, '.minecraft', 'nmp-cache.json'),
        // Fallback-Pfad auf Linux/macOS:
        path.join(os.homedir(), '.minecraft', 'nmp-cache.json'),
    ];

    let deleted = false;
    for (const p of cachePaths) {
        try {
            if (fs.existsSync(p)) {
                fs.unlinkSync(p);
                console.log(`[Auth] Token-Cache gelöscht für ${username}: ${p}`);
                deleted = true;
            }
        } catch (e) {
            console.warn(`[Auth] Cache konnte nicht gelöscht werden (${p}): ${e.message}`);
        }
    }

    if (!deleted) {
        console.log(`[Auth] Kein Token-Cache gefunden für ${username} — trotzdem Retry`);
    }
}

// ─── Proxy Health System ──────────────────────────────────────────────────────

function markProxyBad(host) {
    if (badProxies.has(host)) return;
    badProxies.set(host, Date.now());
    console.log(`[✗] Proxy ${host} als bad markiert für 1 Stunde`);
    notify(`🔴 Proxy \`${host}\` deaktiviert für 1 Stunde`, null, true);

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
        console.log(`[✓] Proxy ${host} wieder freigegeben nach 1h`);
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
        console.log(`[🔒] ${username} — restartLock aktiv, überspringe`);
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

    // FIX: restartLock erst nach vollständiger Bot-Initialisierung freigeben,
    //      nicht sofort — verhindert Race Conditions bei schnellen Reconnects
    // (Lock wird jetzt in 'end', 'kicked', und Error-Handler freigegeben)

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
        // FIX: Auth-Fehler Counter bei erfolgreichem Login zurücksetzen
        authErrorCount[username] = 0;

        restartLock.delete(username); // Lock freigeben nach erfolgreichem Spawn

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
        restartLock.delete(username); // Lock freigeben
        fireReady();
        scheduleReconnect(username, proxyFailed);
    });

    bot.on('kicked', (reason) => {
        console.log(`[!] ${username} gekickt: ${reason}`);
        if (bots[username]?.afkInterval) clearInterval(bots[username].afkInterval);
        if (bots[username]) bots[username].isOnline = false;
        restartLock.delete(username); // Lock freigeben
        notify(
            `🚫 **${username}** gekickt von **${HOST}**!\nGrund: \`${reason}\`\n→ Reconnect in ${RECONNECT_DELAY_NORMAL / 60000} Min`,
            username, true
        );
        setTimeout(() => createBot(username), RECONNECT_DELAY_NORMAL);
        fireReady();
    });

    bot.on('error', (err) => {
        console.log(`[!] ${username} Fehler: ${err.message}`);

        // FIX: "Failed to obtain profile data" Behandlung
        // Ursachen: abgelaufener/korrupter Token-Cache, Mojang Session-API Rate-Limit
        // Lösung:   1. Token-Cache löschen (damit frischer Token geholt wird)
        //           2. 30 Min warten (Rate-Limit abklingen lassen)
        //           3. Max. 3 Versuche, dann langer Cooldown
        if (err.message.includes('Failed to obtain profile data')) {
            authErrorCount[username] = (authErrorCount[username] || 0) + 1;
            const attempt = authErrorCount[username];

            console.log(`[💤] ${username} — Auth-Fehler #${attempt}, lösche Token-Cache...`);
            clearTokenCache(username);

            if (attempt >= AUTH_MAX_RETRIES) {
                const waitMin = 60;
                console.log(`[💤] ${username} — ${attempt} Auth-Fehler in Folge, warte ${waitMin} Min`);
                notify(
                    `💤 **${username}** — Wiederholter Auth-Fehler (${attempt}x)!\n→ Account eventuell gesperrt? Warte **${waitMin} Min**`,
                    username, true
                );
                restartLock.delete(username);
                setTimeout(() => {
                    authErrorCount[username] = 0;
                    createBot(username);
                }, waitMin * 60 * 1000);
            } else {
                const waitMin = Math.round(AUTH_ERROR_DELAY / 60000);
                console.log(`[💤] ${username} — Warte ${waitMin} Min (Versuch ${attempt}/${AUTH_MAX_RETRIES})`);
                notify(
                    `💤 **${username}** — Auth-Fehler (Minecraft Profil, Versuch ${attempt}/${AUTH_MAX_RETRIES})!\n→ Token-Cache geleert, Retry in **${waitMin} Min**`,
                    username, true
                );
                restartLock.delete(username);
                setTimeout(() => createBot(username), AUTH_ERROR_DELAY);
            }

            fireReady();
            return;
        }

        restartLock.delete(username); // Bei anderen Fehlern auch Lock freigeben
        fireReady();
    });

    setTimeout(() => {
        restartLock.delete(username); // Fallback: Lock nach 60s auf jeden Fall freigeben
        fireReady();
    }, 60000);
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
        const authErr = authErrorCount[username] > 0 ? ` | AuthErr: ${authErrorCount[username]}` : '';
        console.log(`  ${status} | ${username} | Proxy: ${data.proxy} | Aktivität: ${timeSince}s | Retries: ${state.joinRetries}${authErr}`);
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
            offline.push(`❌ ${username} (Retries: ${state.joinRetries}, AuthErr: ${authErrorCount[username]})`);
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
