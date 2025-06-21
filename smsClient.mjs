import twilio from "twilio"

export async function sendAvailabilityMessage(accountSid, twilioApiKey, urls) {
    const twilioClient = twilio(accountSid, twilioApiKey);
    console.log("Sending the SMS about availability")
    await twilioClient.messages.create({
      body: `Found new available products:\n${urls.join("\n")}`,
      messagingServiceSid: 'MGb1ec5e8e4e7b2608d79542695b053f7b',
      to: '+48515050764'
    })
    .then(message => console.log(message.sid));
}
