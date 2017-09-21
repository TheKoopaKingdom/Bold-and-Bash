const fs = require(`fs`);
const path = require(`path`);

const discord = require(`discord.js`);
const config = require(`config`);
const schedule = require(`node-schedule`);

const common = require(`./Common.js`);
const logger = require(`./Logging.js`);
const app = require(`./App.js`);
const data = require(`./Data.js`);

logger.info(`KoopaBot Version ${require(`../package.json`).version} Starting.`);

var commandList = [];
var cachedTriggers = [];
var client = new discord.Client();

process.on(`unhandledRejection`, function onError(err)
{
  throw err;
});

process.on(`SIGINT`, () =>
{
  logger.info(`Shutting down.`);
  process.exit();
});

client.on(`ready`, () =>
{
  // Initalize app channels.
  app.logChannel = client.channels.get(config.logChannel);
  if (!app.logChannel)
  {
    logger.error(`Logging channel #${config.logChannel} not found.`);
    throw (`LOG_CHANNEL_NOT_FOUND`);
  }
  app.guild = app.logChannel.guild;

  logger.info(`Bot is now online and connected to server.`);
});

client.on(`guildMemberAdd`, () =>
{
  app.stats.joins += 1;
});

client.on(`guildMemberRemove`, () =>
{
  app.stats.leaves += 1;
});

// Output the stats for app.stats every 24 hours.
// Server is in UTC mode, 11:30 EST would be 03:30 UTC.
schedule.scheduleJob(
  {
    hour: 3,
    minute: 30
  }, function()
  {
    logger.info(
      `Here are today's stats for ${(new Date()).toLocaleDateString()}! ${app.stats.joins} users \
have joined, ${app.stats.leaves} users have left, ${app.stats.warnings} warnings have been issued.`
    );
    app.logChannel.send(
      `Here are today's stats for ${(new Date()).toLocaleDateString()}! ${app.stats.joins} users \
have joined, ${app.stats.leaves} users have left, ${app.stats.warnings} warnings have been issued.`
    );

    // Clear the stats for the day.
    app.stats.joins = 0;
    app.stats.leaves = 0;
    app.stats.warnings = 0;
  });

client.on(`message`, message =>
{
  if (message.author.bot && !message.content.startsWith(`.ban`))
  {
    return;
  }

  if (!message.guild)
  {
    // We want to log PM attempts.
    logger.info(`${message.author.username} ${message.author} [PM]: ${message.content}`);
    app.logChannel.send(`${message.author} [PM]: ${message.content}`);
    message.reply(config.pmReply);
    return;
  }

  logger.verbose(
    `${message.author.username} ${message.author} [Channel: ${message.channel.name} \
${message.channel}]: ${message.content}`
  );

  if (message.content.startsWith(config.commandPrefix))
  {
    const splitMessage = message.content.match(/([\w|.|@|#|<|>|-]+)|("[^"]+")/g);
    const enteredCommand = splitMessage[0].slice(config.commandPrefix.length).toLowerCase();
    const args = splitMessage.slice(1, splitMessage.length);
    logger.info(`Command entered: ${enteredCommand} with args ${args}.`);

    const index = commandList.map(command => command.name.toLowerCase()).indexOf(enteredCommand);
    if (index >= 0)
      commandList[index].execute(message, args);
    else
      common.sendErrorMessage(`Command not found. See: \`.help\`.`, message);

  }
  else if (!message.author.bot)
  {
    // This is a normal channel message.
    cachedTriggers.forEach(function(trigger)
    {
      if (!trigger.roles || common.findArray(message.member.roles.map(member => member.name),
        trigger.roles))
      {
        if (trigger.trigger(message))
        {
          logger.debug(
            `${message.author.username} ${message.author} [Channel: ${message.channel}] triggered: \
${message.content}`
          );
          try
          {
            trigger.execute(message);
          }
          catch (err)
          {
            logger.error(err);
          }
        }
      }
    });
  }
});

// Load all command modules.
logger.info(`Loading Command Modules.`);
commandList = [];
fs.readdirSync(`Source/Commands/`).forEach(function(file)
{
  // Load the module if it's a script.
  if (path.extname(file) === `.js`)
  {
    if (file.includes(`.disabled`))
    {
      logger.info(`Did not load disabled module: ${file}`);
    }
    else
    {
      logger.info(`Loaded module: ${file}`);
      commandList.push(require(`./Commands/${file}`).command);
    }
  }
});

// Cache all triggers.
cachedTriggers = [];
logger.info(`Loading Triggers.`);
fs.readdirSync(`Source/Triggers/`).forEach(function(file)
{
  // Load the trigger if it's a script.
  if (path.extname(file) === `.js`)
  {
    if (file.includes(`.disabled`))
    {
      logger.info(`Did not load disabled trigger: ${file}`);
    }
    else
    {
      logger.info(`Loaded trigger: ${file}`);
      cachedTriggers.push(require(`./Triggers/${file}`));
    }
  }
});

data.readWarnings();
data.readBans();

if (config.clientLoginToken)
{
  client.login(config.clientLoginToken);
  logger.info(`Startup completed. Established connection to Discord.`);
}
else
{
  logger.error(`Cannot establish connection to Discord. Client login token is not defined.`);
  throw (`MISSING_CLIENT_LOGIN_TOKEN`);
}