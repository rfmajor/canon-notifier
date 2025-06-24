import winston from 'winston';
import fs from 'fs'

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

export default logger;

export function writeAvailabilityStats(availability, outputFile) {
    const data = JSON.stringify({
        "timestamp": new Date().toISOString(),
        "availability": availability
    })

    fs.appendFile(outputFile, data, 'utf8', (err) => {
        if (err) {
            logger.error('Error writing to file: ', err);
            return;
        }
    });
}
