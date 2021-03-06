'use strict';

const winston = require(`winston`);
require(`winston-daily-rotate-file`);

winston.addColors({
  Error: `red`,
  Warn: `yellow`,
  Info: `green`,
  Verbose: `cyan`,
  Debug: `blue`,
  Silly: `magenta`
});
const logger = winston.createLogger(
  {
    levels: {
      Error: 0,
      Warn: 1,
      Info: 2,
      Verbose: 3,
      Debug: 4,
      Silly: 5
    },
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    transports: [new winston.transports.Console({level: `Silly`})]
  });

module.exports = logger;
