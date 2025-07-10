import { DynamoDBClient, BatchGetItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { sendSMSMessage, sendMailMessage, callPhone } from './messageClient.mjs'
import { checkAvailability } from './availabilityCheck.mjs'
import logger, { writeAvailabilityStats } from './logger.mjs';
import withTimeout from './timeout.mjs'
import cron from 'node-cron';
import { readFileSync } from 'fs'

const region = "eu-north-1";
const JOB_TIMEOUT_MS = 55000;
const REPORT_FILE = "./availability_metrics.txt"

const sites = JSON.parse(readFileSync('./sites.json', { encoding: 'utf8', flag: 'r' }))
const minSmsIntervalsHours = JSON.parse(readFileSync('smsIntervals.json', { encoding: 'utf8', flag: 'r' }))

const dbClient = new DynamoDBClient({ region });
const secretsClient = new SecretsManagerClient({ region });

const [twilioApiKey, accountSid] = await getSecrets("twilio-keys", "shopping-api-key", "shopping-api-sid")
const [sendGridApiKey] = await getSecrets("sendgrid-keys", "sendgrid-api-key")
const mailRecipients = ["rfmajor99@gmail.com"]

async function runJob() {
  let availability
  try {
    availability = await checkAvailability(sites)
    writeAvailabilityStats(availability, REPORT_FILE)
  } catch (err) {
    logger.error("Aborting, error fetching data: ", err);
    return
  }

  logger.info(availability)
  let anyAvailable = false
  for (let a of availability) {
    if (a["available"]) {
        anyAvailable = true
        break
    }
  }

  if (!anyAvailable) {
      logger.info("No products available, skipping")
      return
  }

  const urlsIds = []
  for (let siteData of Object.values(sites)) {
    urlsIds.push({
      ID : { N: siteData['id'] }
    })
  }
  const readParams = {
    RequestItems: {
        AvailabilityTimestamp: {
            Keys: urlsIds
        }
    }
  };

  logger.info("Retrieving last sent timestamps of the SMS")
  const lastSentSmsMessages = {};
  try {
    const getItemCommand = new BatchGetItemCommand(readParams)
    const data = await dbClient.send(getItemCommand);

    const responses = data.Responses.AvailabilityTimestamp
    for (let response of responses) {
      const lastSentDate = response['Timestamp']['S'] ?
      new Date(response['Timestamp']['S']) : new Date(0)
      lastSentSmsMessages[response['ID']['N']] = lastSentDate
    }
  } catch (err) {
    logger.error("Aborting because of DynamoDB error: ", err);
    return
  }

  // populate missing data for new rows
  for (let [_siteName, siteData] of Object.entries(sites)) {
      const siteId = siteData['id']
      if (!(siteId in lastSentSmsMessages)) {
          lastSentSmsMessages[siteId] = new Date(0)
      }
  }

  logger.info(`Last sent SMS messages: ${JSON.stringify(lastSentSmsMessages)}`)

  const putRequests = []
  const messageEligibleSites = []
  const now = new Date();
  for (let [siteId, lastSentDate] of Object.entries(lastSentSmsMessages)) {
      let siteName = ''
      for (let name of Object.keys(sites)) {
          if (sites[name]['id'] == siteId) {
              siteName = name
              break
          }
      }
      let siteAvailability = {}
      for (let a of availability) {
          if (a["siteName"] == siteName) {
              siteAvailability = a
              break
          }
      }
      if (!siteAvailability["available"]) {
          logger.info(`No product available for ${siteName}`)
          continue
      }
      const timeDiff = now.getTime() - lastSentDate.getTime()

      logger.info(`${siteName} is available, last SMS was sent on ${lastSentDate} (${parseInt(timeDiff / 1000 / 60 / 60)} hours ago)`)
      const minIntervalHours = siteName in minSmsIntervalsHours ? minSmsIntervalsHours[siteName] : 1
      const minIntervalMs = minIntervalHours * 60 * 60 * 1000
      if (timeDiff < minIntervalMs) {
          logger.info(`Skipping SMS for ${siteName}`)
      } else {
          putRequests.push({
              PutRequest: {
                  Item: {
                      ID: { N: siteId },
                      Timestamp: { S: now.toISOString() }
                  }
              }
          })
          messageEligibleSites.push({"name": siteName, "url": sites[siteName]["url"]})
      }
  }

  if (messageEligibleSites.length == 0) {
      logger.info("No SMS messages to be sent")
      return
  }

  logger.info("Proceeding with sending SMS")
  const writeParams = {
    RequestItems: {
        AvailabilityTimestamp: putRequests
    }
  };
  const command = new BatchWriteItemCommand(writeParams)

  try {
    await sendSMSMessage(accountSid, twilioApiKey, messageEligibleSites)
    await sendMailMessage(sendGridApiKey, messageEligibleSites, mailRecipients)
    await callPhone(accountSid, twilioApiKey)
  } catch (err) {
    logger.error("Error sending messages:", err);
  }

  try {
    logger.info("Overwriting the timestamp row")
    await dbClient.send(command);
  } catch (err) {
    logger.error("Aborting, error updating DynamoDB: ", err);
    return
  }

};

async function getSecrets(secretName, ...secrets) {
    logger.info(`Retrieving secrets from ${secretName}`)
    const secretCommand = new GetSecretValueCommand({ SecretId: secretName });
    const secretResponse = await secretsClient.send(secretCommand);

    const parsedSecret = JSON.parse(secretResponse.SecretString);
    const parsedSecrets = []
    for (const secret of secrets) {
        if (!(secret in parsedSecret)) {
            throw new Error(`${secret} not found in secret: ${secretName}`);
        }
        parsedSecrets.push(parsedSecret[secret])
    }

    return parsedSecrets
}

cron.schedule('* * * * *', async () => await withTimeout(runJob, JOB_TIMEOUT_MS));

