const canonSiteRegex = "chakra-text css-19qxpy"

export async function checkAvailability(sites) {
    const promises = []
    for (const [siteName, siteData] of Object.entries(sites)) {
      const siteUrl = siteData['url']
      promises.push(checkSite(siteName, siteUrl))
    }
    const resolvedPromises = await Promise.all(promises)

    return resolvedPromises
}

async function checkSite(siteName, siteUrl) {
    console.log(`Checking ${siteName} availability`)
    let available = false
    try {
        const response = await fetch(siteUrl)
        if (!response.ok) {
            throw new Error(`Invalid response status for ${siteName}: ${response.status}`)
        }
        const data = await response.text()
        switch (siteName) {
          case 'canon': 
              available = checkCanon(data)
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

function checkCanon(data) {
    return !data.includes(canonSiteRegex)
}
