require('./utils/ensureDependencies.cjs')();
require('./utils/loadEnv.ts').loadEnv();

const http = require('http');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  AuditLogEvent,
  AttachmentBuilder
} = require('discord.js');

const router = require('./router.ts');
const roles = require('./services/roles.ts');
const security = require('./services/security.ts');
const shop = require('./services/shop.ts');
const store = require('./services/store.ts');
const ai = require('./services/ai.ts');
const music = require('./services/music.ts');
const helpCenter = require('./services/help-center.ts');
const recording = require('./services/recording.ts');
const giveaway = require('./services/giveaway.ts');
const prefix = require('./services/prefix.ts');
const antiMention = require('./services/antimention.ts');
const autorespond = require('./services/autorespond.ts');
const jobs = require('./services/jobs.ts');
const banking = require('./services/banking.ts');
const progress = require('./services/progress.ts');
const cards = require('./services/cards.ts');
const invites = require('./services/invites.ts');
const settings = require('./services/settings.ts');

// Existing live status system
const liveStatus = require('./services/status.ts');

// Discord profile activity/presence rotation
const botStatusService = require('./services/botStatusService.ts');

const auditLogs = require('./services/logging.ts');
const moderation = require('./services/moderation.ts');
const dashboardConfig = require('./services/guildConfigService.ts');
const dashboardConfigSync = require('./services/dashboardConfigSync.ts');
const ui = require('./services/ui.ts');
const ownerService = require('./services/owner.ts');
const premium = require('./services/premium.ts');
const topgg = require('./services/topgg.ts');
const owo = require('./services/owo.ts');

const {
  registerGlobalCommands,
  registerExtendedCommands,
  registerExtendedForGuild
} = require('./register.ts');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN.');
  process.exit(1);
}

try {
  const ffmpegPath = require('ffmpeg-static');

  if (ffmpegPath && !process.env.FFMPEG_PATH) {
    process.env.FFMPEG_PATH = ffmpegPath;
  }
} catch {}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ],

  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

client.astrixPingSamples = [];
client.astrixPresenceIndex = -1;

// Lavalink/LavaShark needs both VOICE_STATE_UPDATE and
// VOICE_SERVER_UPDATE gateway packets.
if (!client.astrixLavalinkRawListener) {
  client.astrixLavalinkRawListener = packet => {
    try {
      if (
        client.lavashark &&
        typeof client.lavashark.handleVoiceUpdate === 'function'
      ) {
        return client.lavashark.handleVoiceUpdate(packet);
      }

      if (
        client.manager &&
        typeof client.manager.updateVoiceState === 'function'
      ) {
        return client.manager.updateVoiceState(packet);
      }
    } catch (error) {
      console.error(
        'Lavalink voice packet forwarding failed:',
        error?.message || error
      );
    }
  };

  client.on('raw', client.astrixLavalinkRawListener);
}

async function maybeAutoBackup() {
  const hours = Math.max(
    1,
    Number(process.env.AUTO_BACKUP_HOURS || 6)
  );

  const windowMs = hours * 3600000;

  for (const guild of client.guilds.cache.values()) {
    try {
      const guildData = store.guild(guild.id);
      const sec = guildData.security || {};

      if (!sec.antinuke?.enabled || sec.lockdown?.active) {
        continue;
      }

      if (
        Date.now() - Number(sec.lastBackupAt || 0) <
        windowMs
      ) {
        continue;
      }

      security.createBackup(guild);

      sec.lastBackupAt = Date.now();

      store.save();

      console.log(
        `Auto backup created for ${guild.name}.`
      );
    } catch (error) {
      console.error(
        'Auto backup:',
        error.message
      );
    }
  }
}

async function handleMentionAI(message) {
  if (
    String(
      process.env.AI_MENTION_ENABLED || 'true'
    ).toLowerCase() === 'false'
  ) {
    return;
  }

  if (
    !message.guild ||
    !client.user ||
    message.author.bot
  ) {
    return;
  }

  if (
    !message.mentions.users.has(
      client.user.id
    )
  ) {
    return;
  }

  const aiChannelId =
    settings.get(message.guild.id).aiChannelId;

  if (
    aiChannelId &&
    message.channel.id !== aiChannelId
  ) {
    await message.reply({
      content:
        `✨ Astrix AI is set to <#${aiChannelId}>. ` +
        `Please use AI there.`,

      allowedMentions: {
        repliedUser: false
      }
    }).catch(() => {});

    return;
  }

  const mentionPattern =
    new RegExp(
      `<@!?${client.user.id}>`,
      'g'
    );

  const prompt =
    message.content
      .replace(mentionPattern, '')
      .trim();

  if (!prompt) {
    await message.reply({
      content:
        'Tag me with a message and I will answer it. ' +
        'Example: `@Astrix explain this topic`.',

      allowedMentions: {
        repliedUser: false
      }
    }).catch(() => {});

    return;
  }

  const context = {
    user: message.author,
    guildId: message.guildId,
    guild: message.guild
  };

  try {
    await premium.syncUserFromDashboard(
      message.guildId,
      message.author.id
    );

    if (
      ai.creatorDefenseIntent(prompt)
    ) {
      const usage =
        ai.check(context, 'ask');

      await message.channel
        .sendTyping()
        .catch(() => {});

      const answer =
        await ai.textRequest(
          ai.creatorDefensePrompt(prompt),
          {
            userId: message.author.id,
            userName:
              message.author.globalName ||
              message.author.username,
            guildId: message.guildId,
            guild: message.guild,
            history: []
          }
        );

      ai.commit(usage);

      await ui.replyLong(
        message,
        answer,
        {
          allowedMentions: {
            repliedUser: false
          }
        }
      );

      return;
    }

    const creator =
      ai.creatorInfo(prompt);

    if (creator) {
      const supportText =
        creator.support
          ? 'Join the official Astrix support server for help, updates and community.'
          : 'Support server link is not configured yet. Set `SUPPORT_SERVER_URL` to enable the join button.';

      const embed =
        ui.ownerEmbed(
          'Astrix • Creator',
          `✨ **${creator.creator}** is the owner and creator of Astrix.\n\n` +
          `📬 **Contact:** @${creator.creatorDiscord}\n` +
          `🛟 ${supportText}\n\n` +
          'Made by ❤️ Astrix developers team'
        )
          .setAuthor({
            name:
              'Astrix Premium Profile',

            iconURL:
              client.user.displayAvatarURL({
                size: 128
              })
          })
          .setThumbnail(
            client.user.displayAvatarURL({
              size: 256
            })
          )
          .setFooter({
            text:
              'Made by ❤️ Astrix developers team • Official Creator Profile'
          });

      return message.reply({
        embeds: [embed],

        components:
          creator.support
            ? ui.supportComponents(
                'Join Support Server'
              )
            : [],

        allowedMentions: {
          repliedUser: false
        }
      });
    }

    const local =
      ai.localIdentityResponse(
        prompt,
        {
          userId:
            message.author.id,

          userName:
            message.author.globalName ||
            message.author.username
        }
      );

    if (local) {
      await message.reply({
        content: local,

        allowedMentions: {
          repliedUser: false
        }
      });

      return;
    }

    const usage =
      ai.check(context, 'ask');

    await message.channel
      .sendTyping()
      .catch(() => {});

    const imageAttachment =
      message.attachments.find(
        att =>
          String(
            att.contentType || ''
          ).startsWith('image/')
      ) || null;

    const history = [];

    if (
      message.reference?.messageId
    ) {
      try {
        const replied =
          await message.channel.messages.fetch(
            message.reference.messageId
          );

        if (replied?.content) {
          history.push({
            role:
              replied.author?.id ===
              client.user.id
                ? 'assistant'
                : 'user',

            content:
              replied.content
          });
        }
      } catch {}
    }

    const aiOptions = {
      userId:
        message.author.id,

      userName:
        message.author.globalName ||
        message.author.username,

      guildId:
        message.guildId,

      guild:
        message.guild,

      history
    };

    const answer =
      imageAttachment
        ? await ai.visionRequest(
            prompt,
            imageAttachment.url,
            aiOptions
          )
        : await ai.textRequest(
            prompt,
            aiOptions
          );

    ai.commit(usage);

    const visual =
      ai.renderGuildVisuals(
        answer,
        message.guild
      );

    await ui.replyLong(
      message,
      visual.content,
      {
        ...(visual.stickers.length
          ? {
              stickers:
                visual.stickers
            }
          }
          : {}),

        allowedMentions: {
          repliedUser: false
        }
      }
    );
  } catch (error) {
    await message.reply({
      embeds: [
        ui.error(
          'AI Request Failed',
          `Reason: ${ai.friendlyAIError(error)}`
        )
      ],

      allowedMentions: {
        repliedUser: false
      }
    }).catch(() => {});
  }
}

client.once(
  Events.ClientReady,
  async readyClient => {
    auditLogs.start(
      readyClient
    );

    console.log(
      `Logged in as ${readyClient.user.tag}`
    );

    console.log(
      `Astrix v8.6.0 ready in ${readyClient.guilds.cache.size} server(s).`
    );

    await dashboardConfig.init();

    await invites
      .init(readyClient)
      .catch(error =>
        console.error(
          'Invite tracker init:',
          error.message
        )
      );

    console.log(
      'XP level-up channel settings: per-server Management permission'
    );

    await dashboardConfigSync
      .migrateLocalPremiumStore()
      .catch(error =>
        console.error(
          'Dashboard Premium migration:',
          error.message
        )
      );

    for (
      const guild of
      readyClient.guilds.cache.values()
    ) {
      await dashboardConfigSync
        .syncGuild(guild.id)
        .catch(error =>
          console.error(
            `Dashboard config sync for ${guild.id}:`,
            error.message
          )
        );
    }

    await music.init(
      readyClient
    );

    if (
      !readyClient.astrixMusic247Interval
    ) {
      readyClient.astrixMusic247Interval =
        setInterval(
          () =>
            music
              .tick(readyClient)
              .catch(error =>
                console.error(
                  'Music 24/7 maintenance:',
                  error.message
                )
              ),
          60000
        );

      readyClient
        .astrixMusic247Interval
        .unref();
    }

    await registerExtendedCommands(
      readyClient
    );

    for (
      const guild of
      readyClient.guilds.cache.values()
    ) {
      try {
        shop.state(
          guild.id,
          'free'
        );

        shop.state(
          guild.id,
          'premium'
        );
      } catch (error) {
        console.error(
          'Shop init:',
          error.message
        );
      }
    }

    jobs.startNotifier(
      readyClient
    );

    await moderation
      .tick(readyClient)
      .catch(error =>
        console.error(
          'Moderation expiry tick:',
          error.message
        )
      );

    setInterval(
      () =>
        moderation
          .tick(readyClient)
          .catch(error =>
            console.error(
              'Moderation expiry tick:',
              error.message
            )
          ),
      60000
    ).unref();

    setInterval(
      () =>
        banking.tick(readyClient),
      10000
    ).unref();

    setInterval(
      () =>
        owo
          .tick(readyClient)
          .catch(error =>
            console.error(
              'AutoHunt tick:',
              error.message
            )
          ),
      10000
    ).unref();

    await maybeAutoBackup();

    setInterval(
      maybeAutoBackup,
      15 * 60 * 1000
    ).unref();

    // Recover overdue giveaways immediately
    // after a restart.
    await giveaway
      .tick(readyClient)
      .catch(error =>
        console.error(
          'Giveaway startup tick:',
          error.message
        )
      );

    const giveawayTickMs =
      Math.max(
        5000,
        Number(
          process.env.GIVEAWAY_TICK_MS ||
          10000
        )
      );

    setInterval(
      () =>
        giveaway
          .tick(readyClient)
          .catch(error =>
            console.error(
              'Giveaway tick:',
              error.message
            )
          ),
      giveawayTickMs
    ).unref();

    // ==================================================
    // ASTRIX DISCORD PROFILE ACTIVITY / PRESENCE
    // services/status.ts
    // ==================================================

    botStatusService.start(
      readyClient
    );

    // ==================================================
    // ASTRIX LIVE STATUS PANEL
    // services/botStatusService.ts
    // ==================================================

    const liveStatusSeconds =
      Math.max(
        15,
        Number(
          process.env
            .LIVE_STATUS_UPDATE_SECONDS ||
          30
        )
      );

    await liveStatus.updateAll(
      readyClient
    );

    setInterval(
      () =>
        liveStatus.updateAll(
          readyClient
        ),
      liveStatusSeconds * 1000
    ).unref();
  }
);

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {
      if (
        interaction.isAutocomplete()
      ) {
        return await router.autocomplete(
          interaction
        );
      }

      if (
        interaction.isChatInputCommand()
      ) {
        return await router.command(
          interaction,
          client
        );
      }

      if (
        interaction.isButton()
      ) {
        if (
          interaction.customId.startsWith(
            'owo:mine:'
          )
        ) {
          return await owo.button(
            interaction
          );
        }

        if (
          interaction.customId.startsWith(
            'owo:minecash:'
          )
        ) {
          return await owo.cashout(
            interaction
          );
        }

        if (
          interaction.customId ===
          'help_switch_buttons'
        ) {
          return await helpCenter.button(
            interaction
          );
        }

        return await router.button(
          interaction,
          client
        );
      }

      if (
        interaction.isStringSelectMenu()
      ) {
        if (
          interaction.customId ===
          'help_category_select'
        ) {
          return await helpCenter.select(
            interaction
          );
        }

        return await router.select(
          interaction
        );
      }

      if (
        interaction.isModalSubmit()
      ) {
        return await router.modal(
          interaction
        );
      }
    } catch (error) {
      console.error(
        'Interaction error:',
        error
      );

      auditLogs.error(
        client,
        'Interaction',
        error,
        {
          guildName:
            interaction.guild?.name,

          guildId:
            interaction.guildId,

          command:
            interaction.commandName ||
            interaction.customId ||
            'unknown',

          user:
            interaction.user?.tag ||
            interaction.user?.id
        }
      ).catch(() => {});

      const payload =
        ui.errorPayload(
          'Astrix Error',
          error.message ||
            'Command failed.',
          {
            ephemeral: true
          }
        );

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction
          .followUp(payload)
          .catch(() => {});
      } else {
        await interaction
          .reply(payload)
          .catch(() => {});
      }
    }
  }
);

client.on(
  Events.GuildCreate,
  guild => {
    registerExtendedForGuild(
      guild
    ).catch(error =>
      console.error(
        'Extended guild commands:',
        error.message
      )
    );
  }
);

client.on(
  Events.MessageReactionAdd,
  (reaction, user) =>
    roles.reaction(
      reaction,
      user,
      true
    )
);

client.on(
  Events.MessageReactionRemove,
  (reaction, user) =>
    roles.reaction(
      reaction,
      user,
      false
    )
);

client.on(
  Events.VoiceStateUpdate,
  (oldState, newState) => {
    auditLogs
      .voiceStateUpdate(
        oldState,
        newState
      )
      .catch(error =>
        console.error(
          'Voice activity log:',
          error.message
        )
      );

    recording
      .voiceStateUpdate(
        oldState,
        newState
      )
      .catch(error =>
        console.error(
          'Recording voice state:',
          error.message
        )
      );

    music
      .voiceStateUpdate(
        oldState,
        newState
      )
      .catch(error =>
        console.error(
          'Music voice state:',
          error.message
        )
      );
  }
);

client.on(
  Events.MessageDelete,
  message => {
    auditLogs
      .messageDelete(message)
      .catch(error =>
        console.error(
          'Message delete log:',
          error.message
        )
      );
  }
);

client.on(
  Events.MessageUpdate,
  (oldMessage, newMessage) => {
    auditLogs
      .messageUpdate(
        oldMessage,
        newMessage
      )
      .catch(error =>
        console.error(
          'Message edit log:',
          error.message
        )
      );
  }
);

client.on(
  Events.GuildMemberAdd,
  async member => {
    await roles.memberAdd(
      member
    );

    await security.memberAdd(
      member
    );

    await invites
      .memberAdd(member)
      .catch(error =>
        console.error(
          'Invite tracker member add:',
          error.message
        )
      );
  }
);

client.on(
  Events.GuildMemberRemove,
  async member => {
    await roles.memberRemove(
      member
    );

    await security.memberRemove(
      member
    );

    invites.memberRemove(
      member
    );
  }
);

client.on(
  Events.MessageCreate,
  async message => {
    try {
      auditLogs
        .messageCreate(message)
        .catch(error =>
          console.error(
            'Message activity log:',
            error.message
          )
        );

      if (
        message.guild &&
        ownerService.isBlacklisted(
          message.guild.id,
          message.author.id
        )
      ) {
        return;
      }

      const antiMentionTriggered =
        await antiMention.message(
          message
        );

      if (antiMentionTriggered) {
        return;
      }

      const owoHandled =
        await owo.message(
          message
        );

      if (owoHandled) {
        return;
      }

      const fastNoPrefix =
        prefix.isFastNoPrefixMessage(
          message
        );

      if (fastNoPrefix) {
        const handled =
          await prefix.message(
            message
          );

        if (handled) {
          return;
        }
      }

      await roles.message(
        message
      );

      if (message.deleted) {
        return;
      }

      await security.message(
        message
      );

      if (message.deleted) {
        return;
      }

      if (!fastNoPrefix) {
        const usedQuick =
          await prefix.quick(
            message
          );

        if (usedQuick) {
          return;
        }

        const usedPrefix =
          await prefix.message(
            message
          );

        if (usedPrefix) {
          return;
        }
      }

      const autoReplied =
        await autorespond.message(
          message
        );

      if (autoReplied) {
        return;
      }

      if (
        message.guild &&
        !message.author.bot
      ) {
        const authorState =
          store.user(
            message.guild.id,
            message.author.id
          );

        if (authorState.afk) {
          const previous =
            authorState.afk;

          authorState.afk = null;
          authorState.afkSince = null;

          store.save();

          await message.reply({
            content:
              `Welcome back. Your AFK status was cleared. ` +
              `It said: **${previous}**`,

            allowedMentions: {
              repliedUser: false,
              parse: []
            }
          }).catch(() => {});
        }

        const mentioned =
          [
            ...message.mentions.users.values()
          ].filter(
            user =>
              !user.bot &&
              user.id !==
                message.author.id
          );

        for (
          const user of mentioned
        ) {
          const mentionedState =
            store.user(
              message.guild.id,
              user.id
            );

          if (
            !mentionedState.afk
          ) {
            continue;
          }

          const since =
            mentionedState.afkSince
              ? ` <t:${Math.floor(
                  Number(
                    mentionedState.afkSince
                  ) / 1000
                )}:R>`
              : '';

          await message.reply({
            content:
              `**${user.username}** is AFK${since}: ` +
              `${mentionedState.afk}`,

            allowedMentions: {
              repliedUser: false,
              users: [
                message.author.id
              ]
            }
          }).catch(() => {});
        }

        const gained =
          progress.messageXp(
            message.guild.id,
            message.author.id
          );

        if (
          gained.levels.length
        ) {
          try {
            const member =
              await message.guild.members.fetch(
                message.author.id
              );

            const configuredChannelId =
              settings.get(
                message.guild.id
              ).xpLevelupChannelId ||
              String(
                process.env
                  .XP_LEVELUP_CHANNEL_ID ||
                ''
              ).trim() ||
              null;

            let levelChannel =
              message.channel;

            if (
              configuredChannelId
            ) {
              const configured =
                await message.guild.channels
                  .fetch(
                    configuredChannelId
                  )
                  .catch(() => null);

              if (
                configured?.isTextBased?.()
              ) {
                levelChannel =
                  configured;
              }
            }

            for (
              const lvl of
              gained.levels
            ) {
              const reward =
                gained.rewards?.find(
                  item =>
                    item.level === lvl
                )?.cash || 0;

              const mention =
                `<@${member.id || message.author.id}>`;

              const payload = {
                content:
                  `${mention} reached **Level ${lvl}**.\n` +
                  `XP earned: **+${gained.gained || 0} XP** • ` +
                  `Reward: **${reward.toLocaleString()} coins**\n` +
                  `XP total: **${progress.xpProgress(
                    store.user(
                      message.guild.id,
                      message.author.id
                    )
                  ).xp.toLocaleString()} XP**`,

                allowedMentions: {
                  users: [
                    message.author.id
                  ]
                }
              };

              const messagePayload =
                payload;

              try {
                await levelChannel.send(
                  messagePayload
                );
              } catch (
                channelError
              ) {
                if (
                  levelChannel !==
                  message.channel
                ) {
                  console.error(
                    'Configured XP channel send failed, using activity channel:',
                    channelError.message
                  );

                  await message.channel
                    .send(
                      messagePayload
                    );
                } else {
                  throw channelError;
                }
              }
            }
          } catch (error) {
            console.error(
              'Level-up card:',
              error.message
            );

            await message.channel
              .send({
                embeds: [
                  ui.error(
                    'Level-Up Failed',
                    `Reason: ${error.message}\n\n` +
                    `The level reward was already saved; ` +
                    `only the announcement card failed.`
                  )
                ],

                allowedMentions: {
                  parse: []
                }
              })
              .catch(() => {});
          }
        }
      }

      await handleMentionAI(
        message
      );
    } catch (error) {
      console.error(
        'Message handler:',
        error.message
      );

      await message.reply({
        embeds: [
          ui.error(
            'Command Failed',
            `Reason: ${error.message}`
          )
        ],

        allowedMentions: {
          repliedUser: false,
          parse: []
        }
      }).catch(() => {});

      auditLogs
        .error(
          client,
          'Message Handler',
          error,
          {
            guildName:
              message.guild?.name,

            guildId:
              message.guildId,

            channel:
              message.channel?.id,

            user:
              message.author?.tag ||
              message.author?.id
          }
        )
        .catch(() => {});
    }
  }
);

client.on(
  Events.ChannelDelete,
  channel =>
    security.destructiveEvent(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id,
      'Channel Delete'
    )
);

client.on(
  Events.ChannelCreate,
  channel =>
    security.destructiveEvent(
      channel.guild,
      AuditLogEvent.ChannelCreate,
      channel.id,
      'Channel Create'
    )
);

client.on(
  Events.ChannelUpdate,
  (oldChannel, newChannel) =>
    security.channelUpdate(
      oldChannel,
      newChannel
    )
);

client.on(
  Events.GuildRoleDelete,
  role =>
    security.destructiveEvent(
      role.guild,
      AuditLogEvent.RoleDelete,
      role.id,
      'Role Delete'
    )
);

client.on(
  Events.GuildRoleCreate,
  role =>
    security.destructiveEvent(
      role.guild,
      AuditLogEvent.RoleCreate,
      role.id,
      'Role Create'
    )
);

client.on(
  Events.GuildRoleUpdate,
  (_oldRole, newRole) =>
    security.destructiveEvent(
      newRole.guild,
      AuditLogEvent.RoleUpdate,
      newRole.id,
      'Role Update'
    )
);

client.on(
  Events.GuildBanAdd,
  ban =>
    security.destructiveEvent(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id,
      'Member Ban'
    )
);

client.on(
  Events.GuildMemberUpdate,
  (oldMember, newMember) =>
    security.memberUpdate(
      oldMember,
      newMember
    )
);

client.on(
  Events.WebhooksUpdate,
  channel =>
    security.webhooksUpdate(
      channel
    )
);

client.on(
  Events.GuildUpdate,
  (_oldGuild, newGuild) =>
    security.destructiveEvent(
      newGuild,
      AuditLogEvent.GuildUpdate,
      newGuild.id,
      'Server Settings Update'
    )
);

if (
  String(
    process.env.ASTRIX_EMBEDDED
  ).toLowerCase() !== 'true'
) {
  const port =
    Number(
      process.env.PORT || 10000
    );

  http.createServer(
    (req, res) => {
      if (
        req.method === 'POST' &&
        req.url ===
          '/topgg/webhook'
      ) {
        let body = '';

        req.on(
          'data',
          chunk => {
            body += chunk.toString();

            if (
              body.length >
              1024 * 1024
            ) {
              req.destroy();
            }
          }
        );

        req.on(
          'end',
          async () => {
            try {
              const payload =
                JSON.parse(
                  body || '{}'
                );

              const result =
                await topgg.handleWebhook(
                  req,
                  client,
                  payload
                );

              res.writeHead(
                result.status,
                {
                  'content-type':
                    'application/json'
                }
              );

              res.end(
                JSON.stringify(
                  result.body
                )
              );
            } catch (error) {
              console.error(
                'Top.gg webhook:',
                error.message
              );

              res.writeHead(
                400,
                {
                  'content-type':
                    'application/json'
                }
              );

              res.end(
                JSON.stringify({
                  ok: false,
                  error:
                    'Invalid webhook payload'
                })
              );
            }
          }
        );

        return;
      }

      if (
        req.url === '/' ||
        req.url === '/health'
      ) {
        res.writeHead(
          200,
          {
            'content-type':
              'application/json'
          }
        );

        return res.end(
          JSON.stringify({
            ok: true,
            bot:
              client.user?.tag ||
              'starting',

            guilds:
              client.guilds.cache.size,

            uptime:
              Math.floor(
                process.uptime()
              )
          })
        );
      }

      res.writeHead(404);

      res.end(
        'Not found'
      );
    }
  ).listen(
    port,
    () =>
      console.log(
        `Health server listening on port ${port}`
      )
  );
}

(async () => {
  try {
    if (
      String(
        process.env.AUTO_REGISTER
      ).toLowerCase() !== 'false'
    ) {
      console.log(
        'Registering global direct slash commands...'
      );

      await registerGlobalCommands();
    }

    await client.login(
      process.env.DISCORD_TOKEN
    );
  } catch (error) {
    console.error(
      'Astrix startup failed:',
      error
    );

    process.exit(1);
  }
})();