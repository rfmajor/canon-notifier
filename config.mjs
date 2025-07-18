const config = { }

config.job = {}
config.job.timeoutMs = 55000
config.job.schedule = '* * * * *'
config.awsRegion = 'eu-north-1'

config.sms = {}
config.mail = {}
config.call = {}
config.sms.intervals = {
    "canon": 1,
    "fotoplus": 1,
    "mediamarkt": 1,
    "cyfrowe": 1,
    "fotoforma": 1,
    "fotopoker": 1,
    "mediaexpert": 12
}
config.sms.recipients = [
    "+48515050764"
]
config.sms.messagingServiceId = 'MGb1ec5e8e4e7b2608d79542695b053f7b'
config.mail.recipients = [
    "rfmajor99@gmail.com",
    "alicia01kl@gmail.com"
]
config.mail.sender = 'canon-availability@filipmajor.com'
config.call.recipients = [
    "+48515050764"
]
config.call.caller = "+12184005231"
config.call.url = "https://demo.twilio.com/welcome/voice/"
config.sites = {
    "canon": {
        "id": "1",
        "url": "https://www.canon.pl/store/canon-kompaktowy-aparat-canon-powershot-g7-x-mark-iii-czarny/3637C002/"
    },
    "fotoplus": {
        "id": "2",
        "url": "https://fotoplus.pl/canon-powershot-g7-x-mark-iii?w=11329&srsltid=AfmBOoq8ZbOrPRDiUonIV1wP_LJdEufND2eCIOMsTF2Az-3mbBn573rBxDo"
    },
    "mediamarkt": {
        "id": "3",
        "url": "https://mediamarkt.pl/pl/product/_aparat-canon-powershot-g7-x-mark-iii-czarny-1416782.html?srsltid=AfmBOopTAOonXReSXkPzzM6ioBL0Eo1tjlo141A7bl52xNHLLd7FUWAy"
    },
    "cyfrowe": {
        "id": "4",
        "url": "https://www.cyfrowe.pl/aparat-cyfrowy-canon-powershot-g7-x-mark-iii-czarny-p.html?srsltid=AfmBOoqE5L2F7leU7qt2LciybFGMYONMaGjOBKrTxQ0SkUuB78dFJxOD"
    },
    "fotoforma": {
        "id": "5",
        "url": "https://fotoforma.pl/aparat-canon-powershot-g7-x-mark-iii-czarny?srsltid=AfmBOorl2mOiibRiayJy4Q-ogRu3rE5Mu_cxMq4roi7-qLRbsN-Vynrw"
    },
    "fotopoker": {
        "id": "6",
        "url": "https://fotopoker.pl/aparat-canon-powershot-g7x-mark-iii-srebrny.html?srsltid=AfmBOoonA9IAMbhgpY8di8nPXPhq802DaHGedVkQiY6WzmfY3QgO9COy"
    },
    "mediaexpert": {
        "id": "7",
        "url": "https://www.mediaexpert.pl/foto-i-kamery/aparaty-fotograficzne/aparat-cyfrowy/aparat-canon-powershot-g7-x-iii-bk-eu26"
    }
}
config.twilio = {}
config.twilio.secretName = 'twilio-keys'
config.twilio.secrets = [
    'shopping-api-key',
    'shopping-api-sid'
]
config.sendGrid = {}
config.sendGrid.secretName = 'sendgrid-keys'
config.sendGrid.secrets = [
    'sendgrid-api-key'
]
config.reportFile = './availability_metrics.txt'

export default config
