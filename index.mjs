import { DynamoDBClient, BatchGetItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { sendAvailabilityMessage } from './smsClient.mjs'
import { checkAvailability } from './availabilityCheck.mjs'
import cron from 'node-cron';
import logger from './logger.mjs';

const region = "eu-north-1";
const dbClient = new DynamoDBClient({ region });
const secretsClient = new SecretsManagerClient({ region });
const secretName = "twilio-keys";

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
    "cyfrowe": {
        "id": "4",
        "url": "https://www.cyfrowe.pl/aparat-cyfrowy-canon-powershot-g7-x-mark-iii-czarny-p.html?srsltid=AfmBOoqE5L2F7leU7qt2LciybFGMYONMaGjOBKrTxQ0SkUuB78dFJxOD",
    },
    "fotoforma": {
        "id": "5",
        "url": "https://fotoforma.pl/aparat-canon-powershot-g7-x-mark-iii-czarny?srsltid=AfmBOorl2mOiibRiayJy4Q-ogRu3rE5Mu_cxMq4roi7-qLRbsN-Vynrw",
    },
}

const minSmsIntervalHours = 12 
const minSmsIntervalMs = 1000 * 60 * 60 * minSmsIntervalHours

logger.info("Retrieving twilio API key and accountSid")
let twilioApiKey;
let accountSid;
try {
    const secretCommand = new GetSecretValueCommand({ SecretId: secretName });
    const secretResponse = await secretsClient.send(secretCommand);

    const parsedSecret = JSON.parse(secretResponse.SecretString);
    twilioApiKey = parsedSecret["shopping-api-key"];
    accountSid = parsedSecret["shopping-api-sid"];
    if (!twilioApiKey) throw new Error("shopping-api-key not found in secret");
  } catch (err) {
    logger.error("Error retrieving twilio secret:", err);
}

export const handler = async (_) => {
  let availability
  try {
    availability = await checkAvailability(sites)
  } catch (err) {
    logger.error("Error fetching data:", err);
    return {
      statusCode: 500,
      body: "Error fetching data"
    };
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
      return {
          statusCode: 200,
          body: JSON.stringify('Lambda finished successfully'),
      };
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
    logger.error("DynamoDB error:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error"
    };
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
  const smsUrls = []
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
      if (siteAvailability["available"]) {
          if (timeDiff < minSmsIntervalMs) {
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
              smsUrls.push(sites[siteName]["url"])
          }
      }
  }

  if (smsUrls.length == 0) {
      logger.info("No SMS messages to be sent")
      return {
          statusCode: 200,
          body: JSON.stringify('Lambda finished successfully'),
      };
  }

  logger.info("Proceeding with sending SMS")
  const writeParams = {
    RequestItems: {
        AvailabilityTimestamp: putRequests
    }
  };
  const command = new BatchWriteItemCommand(writeParams)

  try {
    logger.info("Overwriting the timestamp row")
    await dbClient.send(command);
  } catch (err) {
    logger.error("Error updating DynamoDB:", err);
    return {
      statusCode: 500,
      body: "Error updating DynamoDB"
    };
  }

  try {
    await sendAvailabilityMessage(accountSid, twilioApiKey, smsUrls)
  } catch (err) {
    logger.error("Error sending SMS:", err);
    return {
      statusCode: 500,
      body: "Error sending SMS"
    };
  }
  return {
      statusCode: 200,
      body: JSON.stringify('Lambda finished successfully'),
  };
};

cron.schedule('* * * * *', async () => await handler({}));
