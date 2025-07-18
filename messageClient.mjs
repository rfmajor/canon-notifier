import twilio from "twilio"
import sgMail from '@sendgrid/mail';
import logger from './logger.mjs'

export async function sendSMSMessage(accountSid, twilioApiKey, messageEligibleSites, recipients, messagingServiceId) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    for (const recipient of recipients) {
        logger.info(`Sending an SMS about availability to ${recipient}`)
        await twilioClient.messages.create({
          body: buildMessageBody(messageEligibleSites),
          messagingServiceSid: messagingServiceId,
          to: recipient
        })
        .then(message => logger.info(message.sid));
    }
}

export async function sendMailMessage(sendGridApiKey, messageEligibleSites, recipients, sender) {
    sgMail.setApiKey(sendGridApiKey)
    for (const recipient of recipients) {
        logger.info(`Sending an email about availability to ${recipient}`)
        const msg = {
            to: recipient,
            from: sender,
            subject: 'Canon is now available',
            text: buildMessageBody(messageEligibleSites),
        }
        sgMail
            .send(msg)
            .then(() => { logger.info('Email sent') })
            .catch((error) => { logger.error(error) })
    }
}

export async function callPhone(accountSid, twilioApiKey, recipients, caller, url) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    for (const recipient of recipients) {
        logger.info(`Calling ${recipient} to notify about availability`)
        await twilioClient.calls.create({
            from: caller,
            to: recipient,
            url: url
        });
    }

}

function buildMessageBody(messageEligibleSites) {
    let body = "Found new available products:\n"

    for (const site of messageEligibleSites) {
        body += `${site["name"]}: ${site["url"]}\n`
    }

    return body.replaceAll("_", "%5D")
}

