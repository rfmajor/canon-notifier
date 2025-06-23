import twilio from "twilio"
import logger from './logger.mjs'

export async function sendAvailabilityMessage(accountSid, twilioApiKey, urls) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    logger.info("Sending the SMS about availability")
    await twilioClient.messages.create({
      body: `Found new available products:\n${urls.join("\n")}`,
      messagingServiceSid: 'MGb1ec5e8e4e7b2608d79542695b053f7b',
      to: '+48515050764'
    })
    .then(message => logger.info(message.sid));
}
