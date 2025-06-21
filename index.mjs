import { DynamoDBClient, BatchGetItemCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { sendAvailabilityMessage } from './smsClient.mjs'
import { checkAvailability } from './availabilityCheck.mjs'

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
    }
}

const minSmsIntervalHours = 12 
const minSmsIntervalMs = 1000 * 60 * 60 * minSmsIntervalHours

export const handler = async (_) => {
  let twilioApiKey;
  let accountSid;
  console.log("Retrieving twilio API key and accountSid")
  try {
    const secretCommand = new GetSecretValueCommand({ SecretId: secretName });
    const secretResponse = await secretsClient.send(secretCommand);

    const parsedSecret = JSON.parse(secretResponse.SecretString);
    twilioApiKey = parsedSecret["shopping-api-key"];
    accountSid = parsedSecret["shopping-api-sid"];
    if (!twilioApiKey) throw new Error("shopping-api-key not found in secret");
  } catch (err) {
    console.error("Error retrieving twilio secret:", err);
    return {
      statusCode: 500,
      body: "Error retrieving twilio secret"
    };
  }

  let availability
  try {
    availability = await checkAvailability(sites)
  } catch (err) {
    console.error("Error fetching data:", err);
    return {
      statusCode: 500,
      body: "Error fetching data"
    };
  }

  console.log(availability)
  let anyAvailable = false
  for (let a of availability) {
    if (a["available"]) {
        anyAvailable = true
        break
    }
  }

  if (!anyAvailable) {
      console.log("No products available, skipping")
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

  console.log("Retrieving last sent timestamps of the SMS")
  const lastSentSmsMessages = {};
  try {
    const getItemCommand = new BatchGetItemCommand(readParams)
    const data = await dbClient.send(getItemCommand);

    const responses = data.Responses.AvailabilityTimestamp
    for (let response of responses) {
      lastSentSmsMessages[response['ID']['N']] = response['Timestamp']['S']
    }
  } catch (err) {
    console.error("DynamoDB error:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error"
    };
  }

  const putRequests = []
  const smsUrls = []
  const now = new Date();
  for (let [siteId, lastSent] of Object.entries(lastSentSmsMessages)) {
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
          console.log(`No product available for ${siteName}`)
          continue
      }
      const lastSentDate = lastSent ? new Date(lastSent) : new Date(0)
      const timeDiff = now.getTime() - lastSentDate.getTime()

      console.log(`${siteName} is available, last SMS was sent on ${lastSentDate} (${timeDiff / 1000 / 60 / 60} hours ago)`)
      if (siteAvailability["available"]) {
          if (timeDiff < minSmsIntervalMs) {
              console.log(`Skipping SMS for ${siteName}`)
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
      console.log("No SMS messages to be sent")
      return {
          statusCode: 200,
          body: JSON.stringify('Lambda finished successfully'),
      };
  }

  console.log("Proceeding with sending SMS")
  const writeParams = {
    RequestItems: {
        AvailabilityTimestamp: putRequests
    }
  };
  const command = new BatchWriteItemCommand(writeParams)

  try {
    console.log("Overwriting the timestamp row")
    await dbClient.send(command);
  } catch (err) {
    console.error("Error updating DynamoDB:", err);
    return {
      statusCode: 500,
      body: "Error updating DynamoDB"
    };
  }

  try {
    await sendAvailabilityMessage(accountSid, twilioApiKey, smsUrls)
  } catch (err) {
    console.error("Error sending SMS:", err);
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
