import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.mjs'
import withTimeout from './timeout.mjs'

puppeteer.use(StealthPlugin())

const TIMEOUT_MS = 10000

const handlers = {
    "canon": {
        "headless": false,
        "availabilityCheck": (data) => !data.includes("chakra-text css-19qxpy"),
    },
    "fotoplus": {
        "headless": false,
        "availabilityCheck": (data) => {
            for (const keyword of ['SKLEP INTERNETOWY', 'KRAKÓW', 'KATOWICE']) {
                const str = data.substring(data.indexOf(keyword))
                const startIndex = str.indexOf("data-title")
                const endIndex = startIndex + str.substring(startIndex).indexOf("\n")
                const roi = str.substring(startIndex, endIndex)

                if (roi.includes('dostępny')) {
                    return true
                }
            }
            return false
        }
    },
    "mediamarkt": {
        "headless": true,
        "captchaCheck": async (page) => {
            const price = await page.$("[data-test='mms-product-price']")
            return !!price
        },
        "availabilityCheck": async (page) => {
            const availabilityElement = await page.$("[data-test='mms-cofr-delivery_AVAILABLE']")
            return !!availabilityElement
        }
    },
    "cyfrowe": {
        "headless": true,
        "captchaCheck": async (page) => {
            const cardOffer = await page.$(".product-card__offer")
            return !!cardOffer
        },
        "availabilityCheck": async (page) => {
            const notifyLayer = await page.$("[data-addclass='notify-layer']")
            return !notifyLayer
        }
    },
    "fotoforma": {
        "headless": true,
        "captchaCheck": async (page) => {
            const availabilityInfo = await page.$(".availability__availability .second")
            return !!availabilityInfo
        },
        "availabilityCheck": async (page) => {
            const availabilityInfo = await page.$(".availability__availability .second")
            const innerText = await page.evaluate(el => el.innerText, availabilityInfo);
            return !innerText.includes("niedostępny")
        }
    },
    "fotopoker": {
        "headless": true,
        "captchaCheck": async (page) => {
            const availabilityInfo = await page.$("#st_availability_info")
            return !!availabilityInfo
        },
        "availabilityCheck": async (page) => {
            const availabilityInfo = await page.$("#st_availability_info")
            const innerText = await page.evaluate(el => el.innerText, availabilityInfo);
            return !innerText.includes("Zapytaj")
        }
    },
}

export async function checkAvailability(sites) {
    const browser = await puppeteer.launch();

    const promises = []
    for (const [siteName, siteData] of Object.entries(sites)) {
      const siteUrl = siteData['url']
      promises.push(checkSite(siteName, siteUrl, browser))
    }
    const resolvedPromises = await Promise.all(promises)

    await browser.close()
    return resolvedPromises
}

async function checkSite(siteName, siteUrl, browser) {
    logger.info(`Checking ${siteName} availability`)
    let available = false
    try {
        if (!(siteName in handlers)) {
            throw Error(`No handler found for ${siteName}`)
        }
        const handler = handlers[siteName]
        if (!handler['headless']) {
            available = await checkNormal(siteName, siteUrl, handler['availabilityCheck'])
        } else {
            available = await checkHeadless(siteName, siteUrl, handler['captchaCheck'], handler['availabilityCheck'], browser)
        }
    } catch (error) {
        logger.error(error.message)
        available = false
    }

    return {"siteName": siteName, "available": available}
}

async function checkNormal(siteName, url, availabilityCheck) {
    try {
        return await withTimeout(async () => {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Invalid response status for ${siteName}: ${response.status}`)
            }
            const data = await response.text()
            return availabilityCheck(data)
        }, TIMEOUT_MS)
    } catch (err) {
        logger.error(`Error while checking ${siteName} availability: ${err}`)
        return false
    }
}

async function checkHeadless(siteName, url, captchaCheck, availabilityCheck, browser) {
    const page = await browser.newPage()
    try {
        return await withTimeout(async () => {
            await randomizeUserAgent(page)

            await page.goto(url)

            if (!(await captchaCheck(page))) {
                throw Error(`No content loaded for ${siteName}, it might be blocked by captcha`)
            }

            return await availabilityCheck(page)
        }, TIMEOUT_MS)
    } catch (err) {
        logger.error(`Error while checking ${siteName} availability: ${err}`)
        return false
    } finally {
        await page.close()
    }
}

async function randomizeUserAgent(page) {
    // Set a realistic user-agent to match the IP’s region and browser version
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    // Randomize viewport slightly to avoid fingerprinting from consistent dimensions
    await page.setViewport({
      width: Math.floor(1024 + Math.random() * 100),
      height: Math.floor(768 + Math.random() * 100),
    });
}

