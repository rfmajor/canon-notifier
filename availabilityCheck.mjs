export async function checkAvailability(sites) {
    const browser = undefined
    // const browser = await puppeteer.launch({
    //     args: chromium.args,
    //     defaultViewport: chromium.defaultViewport,
    //     executablePath: await chromium.executablePath(
    //         process.env.AWS_EXECUTION_ENV
    //             ? '/opt/nodejs/node_modules/@sparticuz/chromium/bin'
    //             : undefined,
    //     ),
    //     headless: chromium.headless,
    //     ignoreHTTPSErrors: true,
    // });

    const promises = []
    for (const [siteName, siteData] of Object.entries(sites)) {
      const siteUrl = siteData['url']
      promises.push(checkSite(siteName, siteUrl, browser))
    }
    const resolvedPromises = await Promise.all(promises)

    // await browser.close()
    return resolvedPromises
}

async function checkSite(siteName, siteUrl, browser) {
    console.log(`Checking ${siteName} availability`)
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
          default:
              break
        }
    } catch (error) {
        console.error(error.message)
        available = false
    }

    console.log(`Availability on ${siteName}: ${available}`)
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
        console.log("Error while checking canon availability: " + err)
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
        console.log("Error while checking fotoplus availability: " + err)
        return false
    }
}

async function checkMediamarkt(url, browser) {
    // const page = browser.newPage()
    // await page.goto(url)
    // const availabilityElement = await page.$("[data-test='mms-cofr-delivery_AVAILABLE']")
    // const available = !!availabilityElement

    // page.close()
    // return available
    return false
}

