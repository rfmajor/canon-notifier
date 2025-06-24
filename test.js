import { checkAvailability } from './availabilityCheck.mjs'
import { readFileSync } from 'fs'

const sites = JSON.parse(readFileSync('./sites.json', { encoding: 'utf8', flag: 'r' }))

let availability
try {
  availability = await checkAvailability(sites)
  console.log(availability)
} catch (err) {
  console.error("Error fetching data:", err);
}
