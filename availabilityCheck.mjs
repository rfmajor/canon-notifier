import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import logger from './logger.mjs'

puppeteer.use(StealthPlugin())

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
        switch (siteName) {
          case 'canon': 
              available = await checkCanon(siteUrl)
              break
          case 'fotoplus':
              available = await checkFotoplus(siteUrl)
              break
          case 'mediamarkt':
              available = await checkMediamarkt(siteUrl, browser)
              break
          case 'cyfrowe':
              available = await checkCyfrowe(siteUrl, browser)
              break
          case 'fotoforma':
              available = await checkFotoforma(siteUrl, browser)
              break
          default:
              break
        }
    } catch (error) {
        logger.error(error.message)
        available = false
    }

    return {"siteName": siteName, "available": available}
}

async function checkCanon(url) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Invalid response status for canon: ${response.status}`)
        }
        const data = await response.text()
        return !data.includes("chakra-text css-19qxpy")
    } catch (err) {
        logger.error("Error while checking canon availability: " + err)
        return false
    }
}

async function checkFotoplus(url) {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Invalid response status for fotoplus: ${response.status}`)
        }
        const data = await response.text()

        const checkFotoplusInner = function(data, keyword) {
            const str = data.substring(data.indexOf(keyword))
            const startIndex = str.indexOf("data-title")
            const endIndex = startIndex + str.substring(startIndex).indexOf("\n")
            const roi = str.substring(startIndex, endIndex)

            return roi.includes('dostępny')
        }

        return checkFotoplusInner(data, 'SKLEP INTERNETOWY') ||
            checkFotoplusInner(data, 'KRAKÓW') || 
            checkFotoplusInner(data, 'KATOWICE')
    } catch (err) {
        logger.error("Error while checking fotoplus availability: " + err)
        return false
    }
}

async function checkMediamarkt(url, browser) {
    try {
        const page = await browser.newPage()
        await randomizeUserAgent(page)

        await page.goto(url)
        const price = await page.$("[data-test='mms-product-price']")

        if (!price) {
            throw Error("No content loaded for mediamarkt, it might be blocked by captcha")
        }
        const availabilityElement = await page.$("[data-test='mms-cofr-delivery_AVAILABLE']")
        const available = !!availabilityElement

        page.close()
        return available
    } catch (err) {
        logger.error("Error while checking mediamarkt availability: " + err)
        return false
    }
}

async function checkCyfrowe(url, browser) {
    try {
        const page = await browser.newPage()
        await randomizeUserAgent(page)

        await page.goto(url)
        
        const cardOffer = await page.$(".product-card__offer")

        if (!cardOffer) {
            throw Error("No content loaded for cyfrowe, it might be blocked by captcha")
        }

        const notifyLayer = await page.$("[data-addclass='notify-layer']")
        const available = !notifyLayer

        page.close()
        return available
    } catch (err) {
        logger.error("Error while checking cyfrowe availability: " + err)
        return false
    }
}

async function checkFotoforma(url, browser) {
    try {
        const page = await browser.newPage()
        await randomizeUserAgent(page)

        await page.goto(url)
        
        const availabilityInfo = await page.$(".availability__availability .second")
        if (!availabilityInfo) {
            throw Error("No content loaded for cyfrowe, it might be blocked by captcha")
        }

        const innerText = await page.evaluate(el => el.innerText, availabilityInfo);
        const available = !innerText.includes("niedostępny")

        page.close()
        return available
    } catch (err) {
        logger.error("Error while checking fotoforma availability: " + err)
        return false
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
