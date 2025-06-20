import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { JSDOM } from 'jsdom';

const accountSid = 'AC9c1d277addb59f56e9a1b59ecf351b94';

const region = "eu-north-1";
const dbClient = new DynamoDBClient({ region });
const secretsClient = new SecretsManagerClient({ region });
const secretName = "twilio-keys";

// const canonUrl = "https://www.canon.pl/store/canon-kompaktowy-aparat-canon-powershot-g7-x-mark-iii-czarny/3637C002/"
const canonUrl = "https://www.canon.pl/store/canon-dalmierz-laserowy-canon-powershot-golf/6254C002/"

export const handler = async (_) => {
  let twilioApiKey;
  try {
    const secretCommand = new GetSecretValueCommand({ SecretId: secretName });
    const secretResponse = await secretsClient.send(secretCommand);

    const parsedSecret = JSON.parse(secretResponse.SecretString);
    twilioApiKey = parsedSecret["shopping-api-key"];
    if (!twilioApiKey) throw new Error("shopping-api-key not found in secret");
  } catch (err) {
    console.error("Error retrieving twilio secret:", err);
    return {
      statusCode: 500,
      body: "Error retrieving twilio secret"
    };
  }

  const params = {
    TableName: "AvailabilityTimestamp",
    Key: {
      id: { N: 1 }
    }
  };

  let lastSentSMSMessage;
  try {
    const command = new GetItemCommand(params);
    const data = await dbClient.send(command);

    if (!data.Item) {
      return {
        statusCode: 404,
        body: "Last timestamp not found"
      };
    }

    const dateValue = data.Item.Timestamp.S;
    lastSentSMSMessage = new Date(dateValue);
  } catch (err) {
    console.error("DynamoDB error:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error"
    };
  }

  let available = false
  try {
    const response = await fetch(canonUrl)
    const data = await response.text()
  
    const dom = new JSDOM(data);
  
    available = !dom.window.document.querySelector(".chakra-text.css-19qxpy")
  } catch (err) {
    console.error("Error fetching data:", err);
    return {
      statusCode: 500,
      body: "Error fetching data"
    };
  }

  if (available) {
    const now = new Date();
    // check if the message was already sent in the last 12 hours
    if (lastSentSMSMessage && now.getTime() - lastSentSMSMessage.getTime() < 1000 * 60 * 60 * 12) {
      return {
        statusCode: 200,
        body: "SMS already sent"
      };
    }
    const command = new PutItemCommand({
      TableName: "AvailabilityTimestamp",
      Item: {
        id: { N: 1 },
        Timestamp: { S: now.toISOString() }
      }
    });

    try {
      await dbClient.send(command);
    } catch (err) {
      console.error("Error updating DynamoDB:", err);
      return {
        statusCode: 500,
        body: "Error updating DynamoDB"
      };
    }

    try {
      const twilioClient = require('twilio')(accountSid, twilioApiKey);
      twilioClient.messages.create({
        body: `Canon is available at ${canonUrl}`,
        messagingServiceSid: 'MGb1ec5e8e4e7b2608d79542695b053f7b',
        to: '+48515050764'
      })
      .then(message => console.log(message.sid));
    } catch (err) {
      console.error("Error sending SMS:", err);
      return {
        statusCode: 500,
        body: "Error sending SMS"
      };
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify('SMS sent successfully'),
  };
};

handler({})
