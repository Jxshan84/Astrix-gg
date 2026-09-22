const ui = require('./ui.ts');

const ACTIONS = {
  hug: { emoji: '🤗', verb: 'hugged', apis: ['hug'] },
  kiss: { emoji: '💫', verb: 'sent a friendly kiss to', apis: ['kiss'] },
  slap: { emoji: '🖐️', verb: 'slapped', apis: ['slap'] },
  punch: { emoji: '👊', verb: 'punched', apis: ['punch'] },
  // Nekos.best uses "blowjob" for this adult reaction category; "fuck"
  // returns an invalid/blocked category on current API versions.
  fuck: { emoji: '💥', verb: 'fucked with', apis: ['blowjob'] },
  pat: { emoji: '😊', verb: 'patted', apis: ['pat'] },
  poke: { emoji: '👉', verb: 'poked', apis: ['poke'] },
  bonk: { emoji: '🔨', verb: 'bonked', apis: ['bonk'] },
  wave: { emoji: '👋', verb: 'waved at', apis: ['wave'] },
  highfive: { emoji: '🙌', verb: 'high-fived', apis: ['highfive'] },
  dance: { emoji: '💃', verb: 'danced with', apis: ['dance'] },
  clap: { emoji: '👏', verb: 'clapped for', apis: ['clap'] },
  cheer: { emoji: '🎉', verb: 'cheered for', apis: ['happy'] },
  laugh: { emoji: '😂', verb: 'laughed with', apis: ['laugh'] },
  facepalm: { emoji: '🤦', verb: 'facepalmed at', apis: ['facepalm'] },
  smile: { emoji: '😄', verb: 'smiled at', apis: ['smile'] },
  shrug: { emoji: '🤷', verb: 'shrugged at', apis: ['shrug'] },
  salute: { emoji: '🫡', verb: 'saluted', apis: ['salute'] },
  handshake: { emoji: '🤝', verb: 'shook hands with', apis: ['handshake'] },
  nod: { emoji: '🙂', verb: 'nodded at', apis: ['nod'] },
  stare: { emoji: '👀', verb: 'stared at', apis: ['stare'] },
  wink: { emoji: '😉', verb: 'winked at', apis: ['wink'] },
  thumbsup: { emoji: '👍', verb: 'gave a thumbs-up to', apis: ['thumbsup'] }
};

function actionNames() { return Object.keys(ACTIONS); }

const recentGifsByAction = new Map();
const MAX_RECENT_GIFS = 36;

async function fetchGif(category, contact) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(category)}`, {
      headers: { 'User-Agent': `Astrix (${contact})`, Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.results?.[0]?.url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function randomGif(categories, action) {
  // Keep GIF actions working out of the box. The API asks for a descriptive
  // contact value, but requiring a server-specific env var made every action
  // silently fall back to text on fresh installs.
  const contact = process.env.NEKOSBEST_CONTACT_URL ||
    process.env.SUPPORT_SERVER_URL ||
    process.env.PUBLIC_BOT_URL ||
    'https://github.com/nekos-best/nekos.best';
  // Never fall back to another action's category. A punch must only show a
  // punch GIF, a slap must only show a slap GIF, and so on.
  const choices = [...new Set(Array.isArray(categories) ? categories : [categories])];
  // Keep adult-language actions functional when the upstream provider does
  // not expose the literal category. A server owner may also provide a
  // vetted direct GIF URL without changing the code.
  if (action === 'fuck' && process.env.FUCK_GIF_URL) {
    return String(process.env.FUCK_GIF_URL).trim() || null;
  }
  const recentGifs = recentGifsByAction.get(action) || [];
  let fallback = null;
  // Retry so the same action gets a different animation each time when the
  // upstream category has more than one GIF available.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const gif = await fetchGif(choices[0], contact);
    if (!gif) continue;
    fallback ||= gif;
    if (!recentGifs.includes(gif)) {
      recentGifs.push(gif);
      while (recentGifs.length > MAX_RECENT_GIFS) recentGifs.shift();
      recentGifsByAction.set(action, recentGifs);
      return gif;
    }
  }
  // Do not repeat the previous GIF just to attach an image. A clean text
  // response is better than showing the wrong or repeated action animation.
  return fallback && !recentGifs.includes(fallback) ? fallback : null;
}

async function sendAction({ sourceUser, targetUser, reply, action }) {
  const cfg = ACTIONS[action];
  if (!cfg) throw new Error('Unknown Astrix action.');
  if (!targetUser || targetUser.bot) throw new Error('Choose a non-bot user for this action.');
  const gif = await randomGif(cfg.apis, action);
  const embed = ui.embed(`${cfg.emoji} Astrix Actions`, `${sourceUser} **${cfg.verb}** ${targetUser}!`);
  if (gif) embed.setImage(gif);
  else embed.setDescription(`${sourceUser} **${cfg.verb}** ${targetUser}!\n\n*GIF service is temporarily unavailable, but the action still worked.*`);
  return reply({ embeds: [embed], allowedMentions: { users: [...new Set([sourceUser.id, targetUser.id].filter(Boolean))] } });
}

async function slash(i) {
  return sendAction({
    sourceUser: i.user,
    targetUser: i.options.getUser('user', true),
    action: i.options.getString('type', true),
    reply: payload => i.reply(payload)
  });
}

async function slashAction(i, action) {
  return sendAction({
    sourceUser: i.user,
    targetUser: i.options.getUser('user', true),
    action,
    reply: payload => i.reply(payload)
  });
}

async function prefix(message, action) {
  const target = message.mentions.users.first();
  if (!target) {
    await message.reply(`Mention a user. Example: \`${action} @user\``);
    return true;
  }
  await sendAction({ sourceUser: message.author, targetUser: target, action, reply: payload => message.reply(payload) });
  return true;
}

module.exports = { ACTIONS, actionNames, slash, slashAction, prefix };
