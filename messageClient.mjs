import twilio from "twilio"
import sgMail from '@sendgrid/mail';
import logger from './logger.mjs'

export async function sendSMSMessage(accountSid, twilioApiKey, messageEligibleSites) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    logger.info("Sending the SMS about availability")
    await twilioClient.messages.create({
      body: buildMessageBody(messageEligibleSites),
      messagingServiceSid: 'MGb1ec5e8e4e7b2608d79542695b053f7b',
      to: '+48515050764'
    })
    .then(message => logger.info(message.sid));
}

export async function sendMailMessage(sendGridApiKey, messageEligibleSites, recipients) {
    sgMail.setApiKey(sendGridApiKey)
    for (const recipient of recipients) {
        logger.info(`Sending an email about availability to ${recipient}`)
        const msg = {
            to: recipient,
            from: 'canon-availability@filipmajor.com',
            subject: 'Canon is now available',
            text: buildMessageBody(messageEligibleSites),
        }
        sgMail
            .send(msg)
            .then(() => { logger.info('Email sent') })
            .catch((error) => { logger.error(error) })
    }
}

export async function callPhone(accountSid, twilioApiKey) {
  const twilioClient = twilio(accountSid, twilioApiKey);
  logger.info("Calling to notify about availability")

  await twilioClient.calls.create({
    from: "+12184005231",
    to: "+48515050764",
    url: "https://demo.twilio.com/welcome/voice/",
  });
}

function buildMessageBody(messageEligibleSites) {
    let body = "Found new available products:\n"

    for (const site of messageEligibleSites) {
        body += `${site["name"]}: ${site["url"]}\n`
    }

    return body.replaceAll("_", "%5D")
}

