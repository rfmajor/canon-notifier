import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.mjs'
import withTimeout from './timeout.mjs'

puppeteer.use(StealthPlugin())

const PAGE_TIMEOUT_MS = 15000
const FUNCTION_TIMEOUT_MS = 20000

const handlers = {
    "canon": {
        "headless": true,
        "contentCheck": async (page) => {
            const price = await page.$('[data-testid=product-tile-price]')
            return !!price
        },
        "availabilityCheck": async (page) => {
            const availabilityElement = await page.$('[data-testid=sf-stock-messaging-static]')
            const innerText = await page.evaluate(el => el.innerText, availabilityElement);
            return innerText.includes("Dostępne")
        }
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
            const availability = await page.$(".availability-in-stock_-")
            return !!availability
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
    "xkom": {
        "headless": true,
        "contentCheck": async (page) => {
            const productTitle = await page.$('[data-name="productTitle"]')
            return !!productTitle
        },
        "availabilityCheck": async (page) => {
            const buyBox = await page.$('[data-name="buybox"]')
            const innerText = await page.evaluate(el => el.innerText, buyBox);
            return !innerText.includes("niedostępny")
        }
    },
    "mediaexpert": {
        "headless": true,
        "contentCheck": async (page) => {
            const productGalleryView = await page.$(".product-gallery-view")
            return !!productGalleryView
        },
        "availabilityCheck": async (page) => {
            const addToCartButton = await page.$('[cy="addToCartButton"]')
            return !!addToCartButton
        }
    },
}

export async function checkAvailability(sites) {
    let browser
    try {
        browser = await puppeteer.launch();

        const asyncRequests = []
        const syncRequests = []
        for (const [siteName, siteData] of Object.entries(sites)) {
          const siteUrl = siteData['url']
          groupRequestByType(siteName, siteUrl, browser, asyncRequests, syncRequests)
        }
        const availability = await Promise.all(asyncRequests)

        // execute sync requests sequentially
        for (const request of syncRequests) {
            availability.push(await request())
        }

        return availability
    } catch (err) {
        logger.error("Checking availabilities failed: " + err)
        return {}
    } finally {
        if (browser) {
            await browser.close()
        }
    }
}

function groupRequestByType(siteName, siteUrl, browser, asyncRequests, syncRequests) {
    const handler = handlers[siteName]
    if (!handler) {
        logging.error(`Skipping ${siteName}, no handler found`)
        return
    }
    if (handler["headless"]) {
        syncRequests.push(async () => await checkSite(siteName, siteUrl, browser))
    } else {
        asyncRequests.push(checkSite(siteName, siteUrl, browser))
    }
}

async function checkSite(siteName, siteUrl, browser) {
    logger.info(`Checking ${siteName} availability`)
    let available = false
    let error
    try {
        if (!(siteName in handlers)) {
            throw Error(`No handler found for ${siteName}`)
        }
        const handler = handlers[siteName]
        if (!handler['headless']) {
            [available, error] = await checkNormal(siteName, siteUrl, handler['contentCheck'], handler['availabilityCheck'])
        } else {
            [available, error] = await checkHeadless(siteName, siteUrl, handler['contentCheck'], handler['availabilityCheck'], browser)
        }
    } catch (err) {
        logger.error(err.message)
        error = err
    }

    return {"siteName": siteName, "available": available, "error": error ? error.message : null}
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
            return [availabilityCheck(data)]
        }, FUNCTION_TIMEOUT_MS)
    } catch (err) {
        logger.error(`Error while checking ${siteName} availability: ${err}`)
        return [false, err]
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

            return [await availabilityCheck(page)]
        }, FUNCTION_TIMEOUT_MS)
    } catch (err) {
        logger.error(`Error while checking ${siteName} availability: ${err}`)
        return [false, err]
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


