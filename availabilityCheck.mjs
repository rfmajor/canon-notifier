import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.mjs'
import withTimeout from './timeout.mjs'

puppeteer.use(StealthPlugin())

const PAGE_TIMEOUT_MS = 15000
const FUNCTION_TIMEOUT_MS = 20000

const handlers = {
    "canon": {
        "headless": false,
        "contentCheck": (data) => {
            return data.includes('sf-product-detail-page')
        },
        "availabilityCheck": (data) => !data.includes("chakra-text css-19qxpy"),
    },
    "fotoplus": {
        "headless": false,
        "contentCheck": (data) => {
            return data.includes('SKLEP INTERNETOWY')
        },
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
        "contentCheck": async (page) => {
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
        "contentCheck": async (page) => {
            const cardOffer = await page.$(".product-card__offer")
            return !!cardOffer
        },
        "availabilityCheck": async (page) => {
            const notifyLayer = await page.$("[data-addclass='notify-layer']")
            return !notifyLayer
        }
    },
    "fotoforma": {
        "headless": false,
        "contentCheck": (data) => {
            return data.includes('availability__availability')
        },
        "availabilityCheck": (data) => {
            const startIndex = data.indexOf("availability__availability")
            const endIndex = data.indexOf("availability__file")
            const availabilityDivSubstring = data.substring(startIndex, endIndex)
            return !availabilityDivSubstring.includes("niedostępny")
        }
    },
    "fotopoker": {
        "headless": false,
        "contentCheck": (data) => {
            return data.includes('st_availability_info-value')
        },
        "availabilityCheck": (data) => {
            const startIndex = data.indexOf("st_availability_info-value")
            const endIndex = data.indexOf("<\/span>")
            const availabilityDivSubstring = data.substring(startIndex, endIndex)
            return !availabilityDivSubstring.includes("Zapytaj")
        }
    },
}

export async function checkAvailability(sites) {
    let browser
    try {
        browser = await puppeteer.launch();

        const promises = []
        for (const [siteName, siteData] of Object.entries(sites)) {
          const siteUrl = siteData['url']
          promises.push(checkSite(siteName, siteUrl, browser))
        }
        const resolvedPromises = await Promise.all(promises)

        return resolvedPromises
    } catch (err) {
        logger.error("Checking availabilities failed: " + err)
        return null
    } finally {
        if (browser) {
            await browser.close()
        }
    }
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
            available = await checkNormal(siteName, siteUrl, handler['contentCheck'], handler['availabilityCheck'])
        } else {
            available = await checkHeadless(siteName, siteUrl, handler['contentCheck'], handler['availabilityCheck'], browser)
        }
    } catch (error) {
        logger.error(error.message)
        available = false
    }

    return {"siteName": siteName, "available": available}
}

async function checkNormal(siteName, url, contentCheck, availabilityCheck) {
    try {
        return await withTimeout(async () => {
            const response = await fetch(url)
            if (!response.ok) {
                throw new Error(`Invalid response status for ${siteName}: ${response.status}`)
            }
            const data = await response.text()
            if (!contentCheck(data)) {
                throw new Error(`No content loaded for ${siteName}, you might need to use a headless browser`)
            }
            return availabilityCheck(data)
        }, FUNCTION_TIMEOUT_MS)
    } catch (err) {
        logger.error(`Error while checking ${siteName} availability: ${err}`)
        return false
    }
}

async function checkHeadless(siteName, url, contentCheck, availabilityCheck, browser) {
    const page = await browser.newPage()
    try {
        return await withTimeout(async () => {
            await randomizeUserAgent(page)

            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: PAGE_TIMEOUT_MS
            })

            if (!(await contentCheck(page))) {
                throw Error(`No content loaded for ${siteName}, it might be blocked by captcha`)
            }

            return await availabilityCheck(page)
        }, FUNCTION_TIMEOUT_MS)
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

