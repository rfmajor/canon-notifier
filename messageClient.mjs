import twilio from "twilio"
import sgMail from '@sendgrid/mail';
import logger from './logger.mjs'

export async function sendSMSMessage(accountSid, twilioApiKey, urls) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    logger.info("Sending the SMS about availability")
    await twilioClient.messages.create({
      body: `Found new available products:\n${urls.join("\n").replaceAll("_", "%5D")}`,
      messagingServiceSid: 'MGb1ec5e8e4e7b2608d79542695b053f7b',
      to: '+48515050764'
    })
    .then(message => logger.info(message.sid));
}

export async function sendMailMessage(sendGridApiKey, urls, recipients) {
    sgMail.setApiKey(sendGridApiKey)
    for (const recipient of recipients) {
        logger.info(`Sending an email about availability to ${recipient}`)
        const msg = {
            to: recipient,
            from: 'canon-availability@filipmajor.com',
            subject: 'Canon is now available',
            text: `Found new available products:\n${urls.join("\n")}`,
        }
        sgMail
            .send(msg)
            .then(() => { logger.info('Email sent') })
            .catch((error) => { logger.error(error) })
    }
}
