import { checkAvailability } from './availabilityCheck.mjs'

const sites = {
    "canon": {
        "id": "1",
        "url": "https://www.canon.pl/store/canon-kompaktowy-aparat-canon-powershot-g7-x-mark-iii-czarny/3637C002/",
    },
    "fotoplus": {
        "id": "2",
        "url": "https://fotoplus.pl/canon-powershot-g7-x-mark-iii?w=11329&srsltid=AfmBOoq8ZbOrPRDiUonIV1wP_LJdEufND2eCIOMsTF2Az-3mbBn573rBxDo",
    },
    "mediamarkt": {
        "id": "3",
        "url": "https://mediamarkt.pl/pl/product/_aparat-canon-powershot-g7-x-mark-iii-czarny-1416782.html?srsltid=AfmBOopTAOonXReSXkPzzM6ioBL0Eo1tjlo141A7bl52xNHLLd7FUWAy",
    },
}

let availability
try {
  availability = await checkAvailability(sites)
} catch (err) {
  console.error("Error fetching data:", err);
}
