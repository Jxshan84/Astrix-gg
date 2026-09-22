const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const guildConfigService = require("./guildConfigService.ts");
const premiumService = require("./premium.ts");

// Discord can animate a real GIF URL, but it cannot animate a static photo.
// Each Premium scenery has its own real hosted GIF so the selected/random
// choice is not replaced by one generic animation.
const HOSTED_MOTION_GIFS = [
  "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
  "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif",
  "https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif",
  "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif",
];

const SCENERIES = [
  ["astrix-galaxy", "space", false, "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["purple-nebula", "space", false, "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["midnight-metropolis", "city", false, "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["neon-city", "city", false, "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["emerald-forest", "nature", false, "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["sunset-valley", "nature", false, "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["ocean-night", "ocean", false, "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["tropical-sea", "ocean", false, "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["rainy-window", "rain", false, "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["snow-mountain", "snow", false, "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["aurora-night", "sky", false, "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["sunset-clouds", "sky", false, "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["enchanted-grove", "fantasy", false, "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["sakura-dream", "anime", false, "https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["astrix-energy-static", "abstract", false, "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["cyber-grid", "cyberpunk", true, "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["cyber-city", "cyberpunk", true, "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["moving-galaxy", "space", true, "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["storm-rain", "rain", true, "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["snowfall-motion", "snow", true, "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["ocean-current", "ocean", true, "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["animated-aurora", "sky", true, "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["fantasy-rift", "fantasy", true, "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["sakura-motion", "anime", true, "https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1400&h=700&q=86"],
  ["astrix-energy-motion", "abstract", true, "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&h=700&q=86"],
].map(([id, category, premium, imageUrl], index) => ({
  id,
  category,
  premium,
  animatedUrl: premium ? HOSTED_MOTION_GIFS[index % HOSTED_MOTION_GIFS.length] : null,
  imageUrl,
}));

function safeUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function welcomeMediaName(media) {
  let name = String(media?.name || "welcome-media").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const isGif = String(media?.contentType || "").toLowerCase() === "image/gif"
    || /\.gif$/i.test(name)
    || /\.gif(?:[?#]|$)/i.test(String(media?.url || ""));
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += isGif ? ".gif" : ".png";
  return name;
}

function cachedWelcomeMedia(media) {
  if (!media?.data) return null;
  try {
    const name = welcomeMediaName(media);
    const buffer = Buffer.from(String(media.data), "base64");
    if (!buffer.length) return null;
    return { name, file: { attachment: buffer, name } };
  } catch {
    return null;
  }
}

function ensureBranding(value) {
  const trimmed = String(value || "").trim();
  if (/powered\s+by\s+astrix/i.test(trimmed)) return trimmed;
  return trimmed ? `${trimmed} • Powered by Astrix` : "Powered by Astrix";
}

function selectedProfile(welcome) {
  const profiles = Array.isArray(welcome?.profiles) ? welcome.profiles : [];
  return (
    profiles.find(profile => profile?.id === welcome?.activeProfileId) ||
    profiles[0] ||
    null
  );
}

function avatarUrl(member) {
  return member.user.displayAvatarURL({ extension: "png", size: 256 });
}

function freeSceneryUrl(category = "all") {
  const pool = SCENERIES.filter(item =>
    !item.premium &&
    (!category || category === "all" || item.category === category)
  );
  const item = pool[Math.floor(Math.random() * pool.length)] || SCENERIES.find(item => !item.premium);
  return item?.imageUrl || null;
}

function replaceVariables(value, member, mentionUser = true) {
  const displayName = member.displayName || member.user.globalName || member.user.username;
  return String(value || "")
    .replaceAll("{user}", mentionUser ? `${member}` : `@${displayName}`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{displayName}", displayName)
    .replaceAll("{userId}", member.id)
    .replaceAll("{userAvatar}", avatarUrl(member))
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{serverId}", member.guild.id)
    .replaceAll("{memberCount}", member.guild.memberCount.toLocaleString("en-US"));
}

function sceneryUrl(profile, premiumEnabled) {
  const scenery = profile?.scenery;
  if (!scenery?.enabled || scenery.mode === "none") return null;

  if (scenery.mode === "custom") {
    const customUrl = safeUrl(scenery.customUrl) ? scenery.customUrl : null;
    const customIsGif = scenery.mediaType === "animated" || /\.gif(?:$|[?#])/i.test(customUrl || "");
    // Free Welcome Studio is image-only. A custom GIF must never bypass the
    // Premium gate simply because its URL was saved by an older dashboard.
    if (customIsGif && !premiumEnabled) return freeSceneryUrl(scenery.category);
    return customUrl;
  }

  // The dashboard may retain a Premium selection after a server downgrades.
  // Treat that selection as image-only instead of allowing an animated asset
  // to leak into a Free welcome message.
  const mediaType = premiumEnabled
    ? (["image", "animated", "both"].includes(scenery.mediaType) ? scenery.mediaType : "both")
    : "image";
  const compatible = item =>
    (premiumEnabled || !item.premium) &&
    (mediaType === "both" ||
      (mediaType === "animated" && item.premium) ||
      (mediaType === "image" && !item.premium));

  if (scenery.mode === "random") {
    const pool = SCENERIES.filter(item => {
      return compatible(item) &&
        (!scenery.category || scenery.category === "all" || item.category === scenery.category);
    });
    if (!pool.length) return null;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return item.animatedUrl || item.imageUrl;
  }

  let item = SCENERIES.find(entry => entry.id === scenery.selectedId);
  if (!item || !compatible(item)) item = SCENERIES.find(compatible);
  return item?.animatedUrl || item?.imageUrl || null;
}

function randomContent(profile) {
  if (profile?.randomMessagesEnabled && Array.isArray(profile.randomMessages)) {
    const available = profile.randomMessages.filter(value => String(value || "").trim());
    if (available.length) return available[Math.floor(Math.random() * available.length)];
  }
  return profile?.content || "";
}

function colorNumber(value) {
  const normalized = String(value || "").trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : 0x7c5cff;
}

function createButtonRows(profile) {
  const buttons = (Array.isArray(profile?.buttons) ? profile.buttons : [])
    .filter(button => button?.enabled && button?.label && safeUrl(button?.url))
    .slice(0, 5);

  if (!buttons.length) return [];

  const row = new ActionRowBuilder();
  for (const data of buttons) {
    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(String(data.label).slice(0, 80))
      .setURL(data.url);

    if (data.emoji) {
      try {
        button.setEmoji(data.emoji);
      } catch {}
    }

    row.addComponents(button);
  }
  return [row];
}

async function addDashboardRoles(member, profile) {
  const roleIds = Array.isArray(profile?.autoRoleIds) ? profile.autoRoleIds : [];
  for (const roleId of roleIds) {
    await member.roles.add(String(roleId), "Astrix Welcome Studio auto role").catch(() => {});
  }
}

async function memberAdd(member) {
  const guildConfig = await guildConfigService.getGuildConfig(member.guild.id);
  const welcome = guildConfig?.welcome;
  const managed = guildConfig?.dashboardManaged?.welcome === true;

  // false means Welcome Studio has never been saved for this guild, allowing
  // the legacy Discord /welcome configuration to remain a safe fallback.
  if (!managed || !welcome) return false;

  if (welcome.enabled === false) return true;

  const profile = selectedProfile(welcome);
  if (!profile || profile.enabled === false) return true;
  if (profile.ignoreBots !== false && member.user.bot) return true;

  await addDashboardRoles(member, profile);

  const channel = profile.channelId
    ? member.guild.channels.cache.get(profile.channelId) ||
      (await member.guild.channels.fetch(profile.channelId).catch(() => null))
    : null;

  if (channel?.isTextBased?.() && channel?.isSendable?.()) {
    const serverTier = await premiumService.syncServerFromDashboard(member.guild.id).catch(error => {
      console.error(`Welcome Premium sync failed in guild ${member.guild.id}:`, error.message);
      return "free";
    });
    // A dashboard flag controls whether the feature is enabled for the
    // welcome profile, but the server's real Premium entitlement is the
    // authority. Free servers can only receive built-in/static scenery.
    const premiumEnabled = serverTier !== "free" && welcome.premiumMediaEnabled !== false;
    const mode = ["message", "embed", "both"].includes(profile.mode)
      ? profile.mode
      : "embed";
    const includeContent = mode === "message" || mode === "both";
    const includeEmbed = mode === "embed" || mode === "both";
    const mentionUser = profile.mentionUser !== false;

    const payload = Object.assign(/** @type {any} */ ({}), {
      allowedMentions: mentionUser
        ? { users: [member.id], parse: [] }
        : { parse: [] },
      components: createButtonRows(profile),
    });
    const savedWelcomeMedia = cachedWelcomeMedia(welcome.media);
    if (!includeEmbed && savedWelcomeMedia) Reflect.set(payload, "files", [savedWelcomeMedia.file]);

    if (includeContent) {
      Reflect.set(payload, "content", replaceVariables(randomContent(profile), member, mentionUser).slice(0, 2000));
    }

    if (includeEmbed) {
      const data = profile.embed || {};
      const embed = new EmbedBuilder()
        .setColor(colorNumber(data.color))
        .setTitle(replaceVariables(data.title || "Welcome!", member, mentionUser).slice(0, 256))
        .setDescription(replaceVariables(data.description || "", member, mentionUser).slice(0, 4096));

      if (data.authorName) {
        const icon = replaceVariables(data.authorIconUrl || "", member, false);
        embed.setAuthor({
          name: replaceVariables(data.authorName, member, false).slice(0, 256),
          ...(safeUrl(icon) ? { iconURL: icon } : {}),
        });
      }

      const thumbnail = replaceVariables(data.thumbnailUrl || "", member, false);
      if (safeUrl(thumbnail)) embed.setThumbnail(thumbnail);

      const explicitImage = replaceVariables(data.imageUrl || "", member, false);
      // A Premium Motion scenery must win over the legacy/static embed image;
      // otherwise a saved image URL (for example a Friday cat) silently
      // replaces the animated Welcome GIF.
      const customMode = profile?.scenery?.mode === "custom";
      const hasScenery = profile?.scenery?.enabled && profile?.scenery?.mode !== "none";
      let image = customMode
        ? sceneryUrl(profile, premiumEnabled)
        : (hasScenery
          ? sceneryUrl(profile, premiumEnabled)
          : (premiumEnabled && safeUrl(explicitImage) ? explicitImage : null));
      // Legacy /welcome uploads are cached at configuration time so Discord
      // attachment URLs do not expire before the next member joins. An
      // explicitly uploaded welcome GIF takes priority over scenery so the
      // media the owner selected is actually sent.
      if (savedWelcomeMedia) {
        Reflect.set(payload, "files", [savedWelcomeMedia.file]);
        image = `attachment://${savedWelcomeMedia.name}`;
      } else if (!image && safeUrl(welcome.media?.url)) {
        image = welcome.media.url;
      }
      if (safeUrl(image) || String(image || "").startsWith("attachment://")) embed.setImage(image);

      let footerText = String(data.footerText || "");
      if (!premiumEnabled) footerText = ensureBranding(footerText);
      if (footerText) {
        const footerIcon = replaceVariables(data.footerIconUrl || "", member, false);
        embed.setFooter({
          text: footerText.slice(0, 2048),
          ...(safeUrl(footerIcon) ? { iconURL: footerIcon } : {}),
        });
      }

      if (data.timestamp) embed.setTimestamp();
      Reflect.set(payload, "embeds", [embed]);
    }

    const sent = await channel.send(payload).catch(error => {
      console.error(`Dashboard welcome send failed in guild ${member.guild.id}:`, error.message);
      return null;
    });

    const deleteAfterSeconds = Math.max(0, Number(profile.deleteAfterSeconds || 0));
    if (sent && deleteAfterSeconds > 0) {
      const timer = setTimeout(() => sent.delete().catch(() => {}), deleteAfterSeconds * 1000);
      timer.unref?.();
    }
  }

  if (profile.dmEnabled && profile.dmMessage) {
    await member
      .send(replaceVariables(profile.dmMessage, member, false).slice(0, 2000))
      .catch(() => {});
  }

  if (welcome.logChannelId) {
    const logChannel = member.guild.channels.cache.get(welcome.logChannelId)
      || (await member.guild.channels.fetch(welcome.logChannelId).catch(() => null));
    if (logChannel?.isTextBased?.() && logChannel?.isSendable?.()) {
      const accountAgeDays = Math.max(0, Math.floor((Date.now() - member.user.createdTimestamp) / 86400000));
      const minimumDays = Math.max(0, Number(welcome.minimumAccountAgeDays || 0));
      const newAccount = welcome.accountAgeCheckEnabled === true && accountAgeDays < minimumDays;
      const logEmbed = new EmbedBuilder()
        .setColor(newAccount ? 0xffb020 : 0x7c5cff)
        .setTitle('Astrix Welcome Log')
        .setDescription([
          `${member} joined **${member.guild.name}**.`,
          `Account age: **${accountAgeDays} day(s)**`,
          welcome.accountAgeCheckEnabled === true
            ? `Minimum configured age: **${minimumDays} day(s)**${newAccount ? ' • Very new account' : ' • Passed'}`
            : null,
        ].filter(Boolean).join('\n'))
        .setThumbnail(avatarUrl(member))
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed], allowedMentions: { parse: [] } }).catch(() => {});
    }
  }

  return true;
}

module.exports = { memberAdd };
