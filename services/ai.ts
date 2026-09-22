// @ts-nocheck
const store = require('./store.ts');
const premium = require('./premium.ts');

function botIdentity() {
  const creator = String(process.env.BOT_CREATOR_NAME || 'Jashan Deep').trim();
  const creatorDiscord = String(process.env.BOT_CREATOR_DISCORD || 'jxshan84').trim();
  const support = String(process.env.SUPPORT_SERVER_URL || '').trim();
  return { creator, creatorDiscord, support };
}

function configuredOwnerIds() {
  return new Set([
    process.env.OWNER_ID || '',
    ...(process.env.OWNER_IDS || '').split(','),
    process.env.BOT_OWNER_ID || '',
    ...(process.env.BOT_OWNER_IDS || '').split(',')
  ].map(value => String(value).trim()).filter(Boolean));
}

function userContext(options = {}) {
  const name = String(options.userName || '').trim();
  if (configuredOwnerIds().has(String(options.userId || '').trim())) {
    return `The current user is ${name || 'the configured owner'} and is the configured owner/creator of Astrix. Recognize them as the owner when relevant, and address them naturally with light respect and humor.`;
  }
  return name ? `The current user's display name is ${name}. Use it naturally when helpful, but do not overuse it.` : '';
}

function guildVisualContext(guild) {
  if (!guild) return '';
  const emojis = [...(guild.emojis?.cache?.values?.() || [])].slice(0, 150)
    .map(emoji => `[[emoji:${emoji.name}]] = ${emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`}`);
  const stickers = [...(guild.stickers?.cache?.values?.() || [])].slice(0, 100)
    .map(sticker => `[[sticker:${sticker.name}]] = ${sticker.id}`);
  if (!emojis.length && !stickers.length) return '';
  return [
    'Server visual library: You may use these custom server visuals in your reply.',
    'Use only the exact [[emoji:name]] or [[sticker:name]] markers listed below; never invent names or IDs.',
    'Emoji markers are rendered as Discord custom emoji. Sticker markers are removed from text and sent as Discord stickers (maximum 3 per reply).',
    [...emojis, ...stickers].join(' | ')
  ].join(' ');
}

function renderGuildVisuals(text, guild) {
  const input = String(text || '');
  if (!guild) return { content: input, stickers: [] };
  const emojiMap = new Map([...(guild.emojis?.cache?.values?.() || [])].map(emoji => [
    String(emoji.name || '').toLowerCase(),
    emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`
  ]));
  const stickerMap = new Map([...(guild.stickers?.cache?.values?.() || [])].map(sticker => [
    String(sticker.name || '').toLowerCase(), String(sticker.id)
  ]));
  const stickers = [];
  let content = input.replace(/\[\[emoji:([^\]]+)]]/gi, (full, name) => emojiMap.get(String(name).trim().toLowerCase()) || name)
    .replace(/\[\[sticker:([^\]]+)]]/gi, (full, name) => {
      const id = stickerMap.get(String(name).trim().toLowerCase());
      if (id && stickers.length < 3 && !stickers.includes(id)) stickers.push(id);
      return '';
    });
  return { content: content.replace(/[ \t]{2,}/g, ' ').trim(), stickers };
}

function systemPrompt(options: any = {}) {
  const { creator, creatorDiscord, support } = botIdentity();
  return [
    'You are Astrix, an AI assistant built into the Astrix Discord bot.',
    'Your name is Astrix.',
    `You were created by ${creator} (Discord: ${creatorDiscord}).`,
    support ? `The official Astrix support server is ${support}.` : 'The official support server link has not been configured by the owner yet.',
    'If asked your name, creator, owner, developer, support server, or support link, answer using these facts exactly and never invent a different identity or URL.',
    `Creator profile: ${creator} | Discord: ${creatorDiscord}.`,
    'Creator defense mode: if someone tags Astrix and insults, mocks, attacks, or makes an unfair negative claim about the creator or owner, do not join the attack. Give a short, witty, playful clapback aimed at the message or the argument, and defend the creator confidently. If the behavior repeats, suggest a calm staff warning or timeout instead of retaliation.',
    'Do not use threats, slurs, hate, sexual insults, doxxing, humiliation of protected groups, or instructions to harass anyone. Do not encourage dogpiling. Keep clapbacks light and non-abusive.',
    'If someone simply asks a factual or neutral question about the creator, answer normally instead of roasting them.',
    'Answer the user directly and actually solve their request. Do not output internal safety labels, moderation labels, policy classifications, or phrases such as User Safety: safe.',
    'You can help with planning, explanations, brainstorming, writing, coding, server management, study help, troubleshooting, comparisons, and step-by-step guidance.',
    'Use the language and tone the user is using when practical. If the request is vague, make a reasonable interpretation and give a useful answer instead of replying with a classifier label.',
    'Be helpful, concise, friendly, and naturally funny when appropriate. Use light Hinglish humor when the user uses Hindi/Hinglish, but never force jokes or let humor hide the answer.',
    'For Hindi or Hinglish, use one consistent, natural, gender-neutral voice: prefer “main”, “aap”, “kar sakte hain”, “hoga”, and “kijiye”. Do not randomly switch between masculine and feminine self-references, and never describe Astrix as a ladka or ladki unless the user explicitly asks about fictional roleplay.',
    'Keep Hindi grammar and Roman-Hindi spelling clean and consistent. Use normal English technical words where they are clearer, do not invent spellings, and do not mix Devanagari and Roman Hindi in one answer unless the user asks for it.',
    'For maths, calculations, logic, coding, and factual questions, solve carefully, verify the result, and give a direct answer first. Show short steps when they improve trust; never guess when you can calculate.',
    userContext(options),
    guildVisualContext(options.guild),
    'Never claim to perform actions you cannot perform.'
  ].filter(Boolean).join(' ');
}

function creatorInfo(input) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return null;
  const asksCreator = /\b(who (made|created|built|developed) you|your (creator|owner|developer)|who is your (creator|owner|developer)|owner(?:'s|s)? name|creator(?:'s|s)? name)\b/i.test(text)
    || /\b(owner|maalik|malik)\s*(ka|ki|ke)?\s*naam\b/i.test(text);
  return asksCreator ? botIdentity() : null;
}

function localIdentityResponse(input, options = {}) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return null;
  const identity = creatorInfo(text);
  const { creator, creatorDiscord, support } = botIdentity();
  const asksUserIdentity = /\b(who am i|do you know me|meri pehchaan|mujhe pehchante ho|main kaun hoon)\b/i.test(text);
  if (asksUserIdentity && options.userName) {
    const owner = configuredOwnerIds().has(String(options.userId || '').trim());
    return owner
      ? `Aap **${options.userName}** ho — Astrix ke configured owner/creator. Main aapko pehchaan gaya 😄`
      : `Aap **${options.userName}** ho. Main aapko isi naam se yaad rakhunga is conversation ke context mein.`;
  }
  const asksName = /\b(what(?:'s| is) your name|your name|who are you|what are you called)\b/i.test(text);
  const asksSupport = /\b(support server|support link|discord server|official server|server link)\b/i.test(text);
  const greeting = /^(hi+|hello+|hey+|yo+|sup|namaste|sat sri akal|hii+|heyy+)[!?. ]*$/i.test(text);
  if (greeting) return `Hey! 👋 I’m **Astrix**. How can I help you today?`;
  if (asksName) return `My name is **Astrix**. I am the AI assistant built into the Astrix Discord bot.`;
  if (identity) return `I was created by **${identity.creator}** (Discord: **${identity.creatorDiscord}**).`;
  if (asksSupport) return support ? `Official Astrix support server: ${support}` : 'The Astrix support server link has not been configured yet. The owner can set `SUPPORT_SERVER_URL`.';
  return null;
}



const conversationMemory = new Map();

function conversationKey(options = {}) {
  const guildId = String(options.guildId || 'dm');
  const userId = String(options.userId || 'anonymous');
  return `${guildId}:${userId}`;
}

function getConversationHistory(options = {}) {
  const key = conversationKey(options);
  const items = conversationMemory.get(key) || [];
  return items.slice(-8);
}

function rememberConversation(options = {}, prompt, answer) {
  if (!options.userId) return;
  const key = conversationKey(options);
  const current = conversationMemory.get(key) || [];
  current.push(
    { role: 'user', content: String(prompt).slice(0, 3000) },
    { role: 'assistant', content: String(answer).slice(0, 3000) }
  );
  while (current.length > 12) current.shift();
  conversationMemory.set(key, current);
}

function looksLikeSafetyLeak(output) {
  const text = String(output || '').trim();
  if (!text) return true;
  const compact = text.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (/^(allow|block|safe|unsafe|allowed|blocked)[.!]?$/.test(compact)) return true;
  if (/^user safety\s*:\s*(safe|unsafe|allow|block|allowed|blocked)\b/.test(compact)) return true;
  if (/^(safety|moderation|classification)\s*:\s*(safe|unsafe|allow|block|allowed|blocked)\b/.test(compact)) return true;
  return false;
}


function creatorDefenseIntent(input) {
  const text = String(input || '').trim();
  if (!text) return false;

  const normalized = text.toLowerCase();
  const { creator, creatorDiscord } = botIdentity();
  const mentionsCreator =
    normalized.includes(creator.toLowerCase()) ||
    normalized.includes('jashan deep') ||
    normalized.includes(creatorDiscord.toLowerCase()) ||
    /\b(jashan|jxshan84)\b/i.test(text);
  const mentionsOwner = /\b(owner|boss|malik|maalik)\b/i.test(text)
    || /\b(मालिक|बॉस|ओनर)\b/u.test(text);

  if (!mentionsCreator && !mentionsOwner) return false;

  // Detect direct insults/attacks without trying to classify every negative opinion.
  const attackTerms = [
    'idiot','stupid','dumb','loser','clown','fool','trash','useless','shut up',
    'hate','pathetic','worst','moron','bastard','sucks','bewakoof','pagal',
    'gadha','nikamma','bekaar','chutiya','mc','bc','gaand','bhos'
  ];
  const attack = attackTerms.some(term => normalized.includes(term));
  const directAboutCreator =
    /\b(about|against|to|for|ke baare|ko|ki)\b/i.test(text) ||
    normalized.includes(creatorDiscord.toLowerCase()) ||
    mentionsOwner;

  return attack && directAboutCreator;
}

function creatorDefensePrompt(prompt) {
  const { creator, creatorDiscord } = botIdentity();
  return [
    `The message attacks or insults Astrix's creator/owner, ${creator} (${creatorDiscord}).`,
    'Respond as Astrix with a short, witty, confident clapback that teaches the boundary without threatening or humiliating anyone.',
    'Defend the creator, but keep it playful: roast the weak argument or the attempted insult, not the person’s identity.',
    'No threats, slurs, sexual insults, hate, doxxing, or harassment. Do not tell others to pile on.',
    'Do not claim facts about the creator that were not provided.',
    'Use the language of the incoming message when practical.',
    `Incoming message: ${String(prompt).slice(0, 12000)}`
  ].join('\n');
}

function directAnswerPrompt(prompt) {
  return `Answer the user's request directly. Do not classify the request and do not output any safety/moderation label. Give the useful answer the user is asking for.\n\nUser request:\n${String(prompt).slice(0, 12000)}`;
}

function detectImageIntent(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const intent = /^(?:please\s+)?(?:create|generate|make|draw|design|render)\b/i.test(raw)
    ? /\b(image|picture|photo|artwork|illustration)\b/i.test(raw)
    : /^(?:image|picture|photo|artwork|illustration|imagine)\b/i.test(raw);
  if (!intent) return null;
  let prompt = raw
    .replace(/^(?:please\s+)?(?:create|generate|make|draw|design|render)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|artwork|illustration)\b/i, '')
    .replace(/^(?:image|picture|photo|artwork|illustration|imagine)\b/i, '')
    .replace(/^\s*(?:of|for|showing)?\s*[:\-]?\s*/i, '')
    .trim();
  if (!prompt) prompt = 'Create a high-quality original image';
  return { prompt, size: '1024x1024' };
}

function resetDay(user) {
  const day = new Date().toISOString().slice(0, 10);
  if (user.ai.day !== day) {
    user.ai = { day, usage: {}, cooldowns: {} };
  }
  return user.ai;
}

function limits(interaction) {
  const isPremium = premium.isPremium(interaction);
  return {
    ask: isPremium ? Number(process.env.AI_PREMIUM_ASK_DAILY || 150) : Number(process.env.AI_FREE_ASK_DAILY || 30),
    translate: isPremium ? Number(process.env.AI_PREMIUM_TRANSLATE_DAILY || 100) : Number(process.env.AI_FREE_TRANSLATE_DAILY || 20),
    image: isPremium ? Number(process.env.AI_PREMIUM_IMAGE_DAILY || 12) : Number(process.env.AI_FREE_IMAGE_DAILY || 4),
    imageCooldown: (isPremium ? Number(process.env.AI_PREMIUM_IMAGE_COOLDOWN_SECONDS || 3600) : Number(process.env.AI_FREE_IMAGE_COOLDOWN_SECONDS || 10800)) * 1000,
    textCooldown: isPremium ? 5000 : 15000
  };
}

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function configuredTextProviderNames() {
  const names = [];
  if (envValue('OPENROUTER_API_KEY')) names.push('OpenRouter');
  if (envValue('OPENCODE_ZEN_API_KEY')) names.push('OpenCode Zen');
  if (envValue('CLOUDFLARE_ACCOUNT_ID') && envValue('CLOUDFLARE_API_TOKEN')) names.push('Cloudflare');
  if (envValue('POLLINATIONS_API_KEY')) names.push('Pollinations');
  if (envValue('GEMINI_API_KEY')) names.push('Gemini');
  if (envValue('OPENAI_API_KEY')) names.push('OpenAI');
  return names;
}

function hasTextProvider() {
  return configuredTextProviderNames().length > 0;
}

function check(interaction, type) {
  const cloudflarePartiallyConfigured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) !== Boolean(process.env.CLOUDFLARE_API_TOKEN);
  if (!hasTextProvider() && type !== 'image') {
    if (cloudflarePartiallyConfigured) throw new Error('Cloudflare Workers AI requires both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
    throw new Error('Astrix AI is not configured. Configure at least one supported text AI provider.');
  }
  if (type === 'image' && !process.env.POLLINATIONS_API_KEY && !(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_IMAGE_MODEL) && !(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    if (cloudflarePartiallyConfigured) throw new Error('Cloudflare Workers AI requires both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
    throw new Error('AI image generation is not configured. Configure at least one image-capable provider.');
  }

  if (premium.isOwner(interaction.user.id)) {
    return {
      u: store.user(interaction.guildId, interaction.user.id),
      ai: null,
      lim: limits(interaction),
      bypass: true
    };
  }

  const user = store.user(interaction.guildId, interaction.user.id);
  const ai = resetDay(user);
  const lim = limits(interaction);
  const key = type === 'image' ? 'image' : (type === 'translate' ? 'translate' : 'ask');

  if ((ai.usage[key] || 0) >= lim[key]) {
    throw new Error(`Your ${key} daily AI limit has been reached.`);
  }

  const cooldown = type === 'image' ? lim.imageCooldown : lim.textCooldown;
  const until = Number(ai.cooldowns[key] || 0);
  if (until > Date.now()) {
    throw new Error(`AI cooldown ends <t:${Math.floor(until / 1000)}:R>.`);
  }

  return { u: user, ai, lim, key, cooldown, bypass: false };
}

function commit(context) {
  if (context.bypass) return;
  context.ai.usage[context.key] = (context.ai.usage[context.key] || 0) + 1;
  context.ai.cooldowns[context.key] = Date.now() + context.cooldown;
  store.save();
}


async function fetchWithTimeout(url, options = {}, timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 30000)) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs || 30000)));
  timer.unref?.();
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError' || /operation was aborted|aborted/i.test(String(error?.message || ''))) {
      throw new Error('AI provider request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function apiError(prefix, status, raw) {
  let detail = '';
  try {
    const parsed = JSON.parse(raw);
    detail = parsed?.error?.message || parsed?.message || '';
  } catch {}
  const clean = String(detail).replace(/\s+/g, ' ').trim().slice(0, 300);
  return new Error(`${prefix} (${status})${clean ? `: ${clean}` : ''}`);
}

async function openRouterTextRequest(prompt, options = {}) {
  const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  const system = systemPrompt(options);
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Astrix Discord Bot'
  };
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;

  const messages = [{ role: 'system', content: system }];
  for (const item of options.history || []) {
    if (!item || !['user', 'assistant'].includes(item.role) || !item.content) continue;
    messages.push({ role: item.role, content: String(item.content).slice(0, 3000) });
  }
  messages.push({ role: 'user', content: String(prompt).slice(0, 12000) });

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 1200),
      temperature: Number(process.env.OPENROUTER_TEMPERATURE || 0.7),
      user: options.userId ? String(options.userId) : undefined
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('OpenRouter request failed', response.status, raw);

  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('\n').trim()
    : String(content || '').trim();
  if (!text) throw new Error('OpenRouter returned an empty response.');
  return text;
}

async function openCodeZenTextRequest(prompt, options = {}) {
  const key = envValue('OPENCODE_ZEN_API_KEY');
  if (!key) throw new Error('OPENCODE_ZEN_API_KEY is missing.');

  const configured = envValue('OPENCODE_ZEN_MODEL');
  const models = configured
    ? [configured]
    : ['deepseek-v4-flash-free', 'mimo-v2.5-free', 'nemotron-3-ultra-free'];

  const messages = [{ role: 'system', content: systemPrompt(options) }];
  for (const item of options.history || []) {
    if (!item || !['user', 'assistant'].includes(item.role) || !item.content) continue;
    messages.push({ role: item.role, content: String(item.content).slice(0, 3000) });
  }
  messages.push({ role: 'user', content: String(prompt).slice(0, 12000) });

  const errors = [];
  for (const model of models) {
    try {
      const response = await fetchWithTimeout('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: Number(process.env.OPENCODE_ZEN_MAX_TOKENS || 1200),
          temperature: Number(process.env.OPENCODE_ZEN_TEMPERATURE || 0.7),
          user: options.userId ? String(options.userId) : undefined
        })
      });

      const raw = await response.text();
      if (!response.ok) throw apiError(`OpenCode Zen ${model} request failed`, response.status, raw);

      const json = JSON.parse(raw);
      const content = json?.choices?.[0]?.message?.content;
      const text = Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('\n').trim()
        : String(content || '').trim();
      if (!text) throw new Error(`OpenCode Zen ${model} returned an empty response.`);
      return text;
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      console.warn(`OpenCode Zen model ${model} failed:`, error.message);
    }
  }

  throw new Error(`OpenCode Zen fallbacks failed. ${errors.join(' | ').slice(0, 700)}`);
}

async function pollinationsTextRequest(prompt, options = {}) {
  const key = String(process.env.POLLINATIONS_API_KEY || '').trim();
  if (!key) throw new Error('POLLINATIONS_API_KEY is missing.');
  const model = String(process.env.POLLINATIONS_TEXT_MODEL || 'openai').trim() || 'openai';
  const messages = [{ role: 'system', content: systemPrompt(options) }];
  for (const item of options.history || []) {
    if (!item || !['user', 'assistant'].includes(item.role) || !item.content) continue;
    messages.push({ role: item.role, content: String(item.content).slice(0, 3000) });
  }
  messages.push({ role: 'user', content: String(prompt).slice(0, 12000) });

  const response = await fetchWithTimeout('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: Number(process.env.POLLINATIONS_TEMPERATURE || 0.7),
      max_tokens: Number(process.env.POLLINATIONS_MAX_TOKENS || 1200),
      user: options.userId ? String(options.userId) : undefined
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('Pollinations text request failed', response.status, raw);
  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('\n').trim()
    : String(content || '').trim();
  if (!text) throw new Error('Pollinations returned an empty response.');
  return text;
}

function friendlyAIError(error) {
  const raw = String(error?.message || error || 'AI request failed.').replace(/\s+/g, ' ').trim();
  const text = raw.toLowerCase();
  if (text.includes('all configured ai providers failed') || text.includes('all configured vision providers failed') || text.includes('all configured image providers failed')) {
    const configured = configuredTextProviderNames();
    const suffix = configured.length ? ` Configured text providers: ${configured.join(', ')}.` : '';
    if (text.includes('(429)') || text.includes('rate limit') || text.includes('too many requests')) {
      return `All available Astrix AI providers are currently rate-limited.${suffix} Try again later or configure another provider.`;
    }
    if (text.includes('(401)') || text.includes('unauthorized') || text.includes('invalid api key')) {
      return `A configured Astrix AI provider rejected its API key.${suffix} The owner should replace the invalid key.`;
    }
    if (text.includes('(402)') || text.includes('payment required') || text.includes('credits') || text.includes('budget')) {
      return `All usable Astrix AI providers currently lack quota or credits.${suffix} Configure another provider or restore quota.`;
    }
    return `Astrix could not get a response from any configured AI provider.${suffix} Check the bot logs for the provider-specific failure.`;
  }
  if (text.includes('(429)') || text.includes('rate limit') || text.includes('too many requests')) {
    return 'The AI provider is busy or rate-limited right now. Please try again shortly.';
  }
  if (text.includes('(401)') || text.includes('unauthorized') || text.includes('invalid api key')) {
    return 'An AI provider key is invalid or no longer authorized. Ask the bot owner to check the environment keys.';
  }
  if (text.includes('(402)') || text.includes('payment required') || text.includes('budget') || text.includes('credits')) {
    return 'One configured AI provider has no usable budget or credits. Astrix will use another configured fallback when available.';
  }
  if (text.includes('timed out') || text.includes('timeout') || text.includes('operation was aborted') || text.includes('aborted')) {
    return 'The AI provider took too long to respond. Please try again.';
  }
  return raw.slice(0, 800);
}

async function cloudflareTextRequest(prompt, options = {}) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !token) throw new Error('Cloudflare Workers AI is not configured.');
  const model = String(process.env.CLOUDFLARE_TEXT_MODEL || '@cf/meta/llama-3.1-8b-instruct').trim();
  const messages = [{ role: 'system', content: systemPrompt(options) }];
  for (const item of options.history || []) {
    if (!item || !['user', 'assistant'].includes(item.role) || !item.content) continue;
    messages.push({ role: item.role, content: String(item.content).slice(0, 3000) });
  }
  messages.push({ role: 'user', content: String(prompt).slice(0, 12000) });
  const response = await fetchWithTimeout(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      max_tokens: Number(process.env.CLOUDFLARE_MAX_TOKENS || 1200),
      temperature: Number(process.env.CLOUDFLARE_TEMPERATURE || 0.7)
    })
  }, Number(process.env.CLOUDFLARE_TIMEOUT_MS || process.env.AI_PROVIDER_TIMEOUT_MS || 45000));
  const raw = await response.text();
  if (!response.ok) throw apiError('Cloudflare text request failed', response.status, raw);
  const json = JSON.parse(raw);
  const out = String(json?.result?.response || json?.response || '').trim();
  if (!out) throw new Error('Cloudflare returned an empty response.');
  return out;
}

async function geminiTextRequest(prompt, options = {}) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const system = systemPrompt(options);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\nUser request:\n${prompt}` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1200)
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('Gemini request failed', response.status, raw);

  const json = JSON.parse(raw);
  const text = (json.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    const reason = json?.promptFeedback?.blockReason || json?.candidates?.[0]?.finishReason;
    throw new Error(reason ? `Gemini returned no text (${reason}).` : 'Gemini returned an empty response.');
  }

  return text;
}

async function openAITextRequest(prompt, options = {}) {
  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      input: [
        {
          role: 'developer',
          content: [{ type: 'input_text', text: systemPrompt(options) }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }]
        }
      ]
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('OpenAI request failed', response.status, raw);

  const json = JSON.parse(raw);
  const texts = [];
  for (const item of json.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) texts.push(content.text);
    }
  }
  const output = texts.join('\n').trim();
  if (!output) throw new Error('OpenAI returned an empty response.');
  return output;
}

async function textRequest(prompt, options = {}) {
  const memoryHistory = Array.isArray(options.history) && options.history.length
    ? options.history
    : getConversationHistory(options);
  const requestOptions = { ...options, history: memoryHistory };

  const providers = [];
  if (envValue('OPENROUTER_API_KEY')) providers.push(['OpenRouter', (p) => openRouterTextRequest(p, requestOptions)]);
  if (envValue('OPENCODE_ZEN_API_KEY')) providers.push(['OpenCode Zen', (p) => openCodeZenTextRequest(p, requestOptions)]);
  if (envValue('CLOUDFLARE_ACCOUNT_ID') && envValue('CLOUDFLARE_API_TOKEN')) providers.push(['Cloudflare', (p) => cloudflareTextRequest(p, requestOptions)]);
  if (envValue('POLLINATIONS_API_KEY')) providers.push(['Pollinations', (p) => pollinationsTextRequest(p, requestOptions)]);
  if (envValue('GEMINI_API_KEY')) providers.push(['Gemini', (p) => geminiTextRequest(p, requestOptions)]);
  if (envValue('OPENAI_API_KEY')) providers.push(['OpenAI', (p) => openAITextRequest(p, requestOptions)]);
  if (!providers.length) {
    throw new Error('Astrix AI is not configured. Add OPENROUTER_API_KEY, OPENCODE_ZEN_API_KEY, or another supported provider key to the environment.');
  }

  const errors = [];
  for (const [name, request] of providers) {
    try {
      let result = await request(prompt);
      if (looksLikeSafetyLeak(result)) {
        console.warn(`AI provider ${name} returned a classifier-style response. Retrying with direct-answer instruction.`);
        result = await request(directAnswerPrompt(prompt));
      }
      if (looksLikeSafetyLeak(result)) {
        throw new Error('Provider returned an internal safety/classification response instead of an answer.');
      }
      rememberConversation(options, prompt, result);
      return result;
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      console.warn(`AI provider ${name} failed:`, error.message);
    }
  }
  throw new Error(`All configured AI providers failed. ${errors.join(' | ').slice(0, 900)}`);
}


async function fetchImageAsDataUrl(url) {
  const response = await fetchWithTimeout(String(url));
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
  const contentType = String(response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!contentType.startsWith('image/')) throw new Error('The attachment is not a supported image.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) throw new Error('The image is too large for AI analysis (20 MB maximum).');
  return {
    dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`,
    base64: bytes.toString('base64'),
    mimeType: contentType
  };
}

async function openRouterVisionRequest(prompt, imageUrl, options = {}) {
  const model = String(process.env.OPENROUTER_VISION_MODEL || '').trim();
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing.');
  if (!model) throw new Error('OPENROUTER_VISION_MODEL is missing.');

  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Astrix Discord Bot'
  };
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
         { role: 'system', content: systemPrompt(options) },
        {
          role: 'user',
          content: [
            { type: 'text', text: String(prompt || 'Describe this image and answer any question about it.').slice(0, 10000) },
            { type: 'image_url', image_url: { url: String(imageUrl) } }
          ]
        }
      ],
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 1200),
      temperature: Number(process.env.OPENROUTER_TEMPERATURE || 0.7)
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('OpenRouter vision request failed', response.status, raw);
  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content;
  const out = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('\n').trim()
    : String(content || '').trim();
  if (!out) throw new Error('OpenRouter vision returned an empty response.');
  return out;
}

async function cloudflareVisionRequest(prompt, imageUrl, options = {}) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !token) throw new Error('Cloudflare Workers AI is not configured.');

  const model = String(process.env.CLOUDFLARE_VISION_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct').trim();
  const image = await fetchImageAsDataUrl(imageUrl);
  const response = await fetchWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt(options) },
          { role: 'user', content: String(prompt || 'Describe this image and answer any question about it.').slice(0, 10000) }
        ],
        image: image.dataUrl,
        max_tokens: Number(process.env.CLOUDFLARE_MAX_TOKENS || 1200),
        temperature: Number(process.env.CLOUDFLARE_TEMPERATURE || 0.7)
      })
    }
  );

  const raw = await response.text();
  if (!response.ok) throw apiError('Cloudflare vision request failed', response.status, raw);
  const json = JSON.parse(raw);
  const out = String(json?.result?.response || json?.response || '').trim();
  if (!out) throw new Error('Cloudflare vision returned an empty response.');
  return out;
}

async function pollinationsVisionRequest(prompt, imageUrl, options = {}) {
  const key = String(process.env.POLLINATIONS_API_KEY || '').trim();
  if (!key) throw new Error('POLLINATIONS_API_KEY is missing.');
  const model = String(process.env.POLLINATIONS_VISION_MODEL || process.env.POLLINATIONS_TEXT_MODEL || 'openai').trim() || 'openai';
  const response = await fetchWithTimeout('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
         { role: 'system', content: systemPrompt(options) },
        {
          role: 'user',
          content: [
            { type: 'text', text: String(prompt || 'Describe this image and answer any question about it.').slice(0, 10000) },
            { type: 'image_url', image_url: { url: String(imageUrl) } }
          ]
        }
      ],
      max_tokens: Number(process.env.POLLINATIONS_MAX_TOKENS || 1200),
      temperature: Number(process.env.POLLINATIONS_TEMPERATURE || 0.7)
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('Pollinations vision request failed', response.status, raw);
  const json = JSON.parse(raw);
  const content = json?.choices?.[0]?.message?.content;
  const out = Array.isArray(content)
    ? content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('\n').trim()
    : String(content || '').trim();
  if (!out) throw new Error('Pollinations vision returned an empty response.');
  return out;
}

async function geminiVisionRequest(prompt, imageUrl, options = {}) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing.');
  const image = await fetchImageAsDataUrl(imageUrl);
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: `${systemPrompt(options)}\n\nUser request:\n${String(prompt || 'Describe this image and answer any question about it.').slice(0, 10000)}` },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } }
          ]
        }],
        generationConfig: { maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1200) }
      })
    }
  );

  const raw = await response.text();
  if (!response.ok) throw apiError('Gemini vision request failed', response.status, raw);
  const json = JSON.parse(raw);
  const out = (json.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!out) throw new Error('Gemini vision returned an empty response.');
  return out;
}

async function openAIVisionRequest(prompt, imageUrl, options = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
  const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      input: [
         { role: 'developer', content: [{ type: 'input_text', text: systemPrompt(options) }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: String(prompt || 'Describe this image and answer any question about it.').slice(0, 10000) },
            { type: 'input_image', image_url: String(imageUrl) }
          ]
        }
      ]
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('OpenAI vision request failed', response.status, raw);
  const json = JSON.parse(raw);
  const texts = [];
  for (const item of json.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) texts.push(content.text);
    }
  }
  const out = texts.join('\n').trim();
  if (!out) throw new Error('OpenAI vision returned an empty response.');
  return out;
}

function configuredVisionProviders() {
  const providers = [];
  if (process.env.OPENROUTER_API_KEY && String(process.env.OPENROUTER_VISION_MODEL || '').trim()) {
    providers.push(['OpenRouter Vision', openRouterVisionRequest]);
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    providers.push(['Cloudflare Vision', cloudflareVisionRequest]);
  }
  if (process.env.POLLINATIONS_API_KEY) {
    providers.push(['Pollinations Vision', pollinationsVisionRequest]);
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push(['Gemini Vision', geminiVisionRequest]);
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push(['OpenAI Vision', openAIVisionRequest]);
  }
  return providers;
}

async function visionRequest(prompt, imageUrl, options = {}) {
  if (!imageUrl) return textRequest(prompt, options);
  const providers = configuredVisionProviders();
  if (!providers.length) throw new Error('No image-understanding provider is configured.');

  const errors = [];
  for (const [name, request] of providers) {
    try {
      const result = await request(prompt, imageUrl, options);
      if (!String(result || '').trim()) throw new Error('Provider returned an empty response.');
      rememberConversation(options, prompt, result);
      return result;
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      console.warn(`${name} failed:`, error.message);
    }
  }
  throw new Error(`All configured vision providers failed. ${errors.join(' | ').slice(0, 900)}`);
}

async function moderation(input) {
  if (!hasTextProvider()) return false;
  const classifierPrompt = `Classify the following text only for clearly explicit sexual/adult content. Reply with exactly BLOCK or ALLOW and nothing else.\n\n${String(input).slice(0, 1500)}`;
  const providers = [];
  if (process.env.OPENROUTER_API_KEY) providers.push(['OpenRouter', () => openRouterTextRequest(classifierPrompt, { history: [] })]);
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) providers.push(['Cloudflare', () => cloudflareTextRequest(classifierPrompt, { history: [] })]);
  if (process.env.POLLINATIONS_API_KEY) providers.push(['Pollinations', () => pollinationsTextRequest(classifierPrompt, { history: [] })]);
  if (process.env.GEMINI_API_KEY) providers.push(['Gemini', () => geminiTextRequest(classifierPrompt)]);
  if (process.env.OPENAI_API_KEY) providers.push(['OpenAI', () => openAITextRequest(classifierPrompt)]);

  for (const [name, request] of providers) {
    try {
      const result = String(await request()).trim();
      if (/^BLOCK\b/i.test(result)) return true;
      if (/^ALLOW\b/i.test(result)) return false;
      console.warn(`Moderation provider ${name} returned an unexpected classifier response.`);
    } catch (error) {
      console.warn(`Moderation provider ${name} failed:`, error.message);
    }
  }
  return false;
}

async function moderationMedia(url) {
  if (!url) return false;
  const providers = configuredVisionProviders();
  if (!providers.length) return false;
  const prompt = 'Moderate this media only for clearly explicit sexual/adult content. Reply with exactly BLOCK or ALLOW and nothing else. Do not describe the media.';

  for (const [name, request] of providers) {
    try {
      const result = String(await request(prompt, url)).trim();
      if (/^BLOCK\b/i.test(result)) return true;
      if (/^ALLOW\b/i.test(result)) return false;
      console.warn(`Media moderation provider ${name} returned an unexpected classifier response.`);
    } catch (error) {
      console.warn(`Media moderation provider ${name} failed:`, error.message);
    }
  }
  return false;
}

async function pollinationsImageRequest(prompt, size) {
  const key = String(process.env.POLLINATIONS_API_KEY || '').trim();
  if (!key) throw new Error('POLLINATIONS_API_KEY is missing.');
  const model = String(process.env.POLLINATIONS_IMAGE_MODEL || 'flux').trim() || 'flux';
  const response = await fetchWithTimeout('https://gen.pollinations.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: String(prompt).slice(0, 32000),
      model,
      n: 1,
      size: size || '1024x1024',
      response_format: 'b64_json',
      safe: 'privacy,secrets,sexual,violence'
    })
  });
  const raw = await response.text();
  if (!response.ok) throw apiError('Pollinations image generation failed', response.status, raw);
  const json = JSON.parse(raw);
  const data = json?.data?.[0];
  if (data?.b64_json) return Buffer.from(data.b64_json, 'base64');
  if (data?.url) {
    const download = await fetchWithTimeout(data.url);
    if (!download.ok) throw new Error('Generated Pollinations image download failed.');
    return Buffer.from(await download.arrayBuffer());
  }
  throw new Error('Pollinations returned no image data.');
}

async function openRouterImageRequest(prompt, size) {
  const model = String(process.env.OPENROUTER_IMAGE_MODEL || '').trim();
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing.');
  if (!model) throw new Error('OPENROUTER_IMAGE_MODEL is missing.');

  const body = {
    model,
    prompt: String(prompt).slice(0, 4000),
    n: 1,
    output_format: 'png'
  };
  if (size) body.size = size;

  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Astrix Discord Bot'
    },
    body: JSON.stringify(body)
  });
  const raw = await response.text();
  if (!response.ok) throw apiError('OpenRouter image generation failed', response.status, raw);
  const json = JSON.parse(raw);
  const data = json?.data?.[0];
  if (data?.b64_json) return Buffer.from(data.b64_json, 'base64');
  if (data?.url) {
    const download = await fetchWithTimeout(data.url);
    if (!download.ok) throw new Error('Generated OpenRouter image download failed.');
    return Buffer.from(await download.arrayBuffer());
  }
  throw new Error('OpenRouter image API returned no image data.');
}

async function cloudflareImageRequest(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: String(prompt).slice(0, 2048),
      steps: Math.min(8, Math.max(1, Number(process.env.CLOUDFLARE_IMAGE_STEPS || 4))),
      seed: Math.floor(Math.random() * 2147483647)
    })
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    if (!response.ok) throw new Error(`Cloudflare image generation failed (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  const raw = await response.text();
  if (!response.ok) throw apiError('Cloudflare image generation failed', response.status, raw);

  const json = JSON.parse(raw);
  const base64 = json?.result?.image || json?.image;
  if (!base64) throw new Error('Cloudflare returned no image data.');
  return Buffer.from(base64, 'base64');
}


async function geminiImageRequest(prompt, size) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing.');
  const model = String(process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image').trim();

  const sizeMap = {
    '512x512': '0.5K',
    '1024x1024': '1K',
    '2048x2048': '2K',
    '4096x4096': '4K'
  };
  const imageSize = sizeMap[String(size || '')] || String(process.env.GEMINI_IMAGE_SIZE || '1K').toUpperCase();
  const allowedSizes = new Set(['0.5K', '1K', '2K', '4K']);

  const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: String(prompt).slice(0, 12000),
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: String(process.env.GEMINI_IMAGE_ASPECT_RATIO || '1:1'),
        image_size: allowedSizes.has(imageSize) ? imageSize : '1K'
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('Gemini image generation failed', response.status, raw);
  const json = JSON.parse(raw);

  const candidates = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.data === 'string' && (value.type === 'image' || value.mime_type?.startsWith?.('image/') || value.mimeType?.startsWith?.('image/'))) {
      candidates.push(value.data);
    }
    if (value.output_image?.data) candidates.push(value.output_image.data);
    if (value.outputImage?.data) candidates.push(value.outputImage.data);
    if (value.inlineData?.data) candidates.push(value.inlineData.data);
    if (value.inline_data?.data) candidates.push(value.inline_data.data);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(json);

  const data = candidates.find(Boolean);
  if (data) return Buffer.from(data, 'base64');
  throw new Error('Gemini returned no image data.');
}

async function openAIImageRequest(prompt, size) {
  const response = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      size: size || '1024x1024'
    })
  });

  const raw = await response.text();
  if (!response.ok) throw apiError('OpenAI image generation failed', response.status, raw);

  const json = JSON.parse(raw);
  const data = json.data?.[0];
  if (data?.b64_json) return Buffer.from(data.b64_json, 'base64');
  if (data?.url) {
    const download = await fetchWithTimeout(data.url);
    if (!download.ok) throw new Error('Generated image download failed.');
    return Buffer.from(await download.arrayBuffer());
  }
  throw new Error('Image API returned no image data.');
}

async function imageRequest(prompt, size) {
  if (await moderation(prompt)) {
    throw new Error('That image prompt was blocked by the safety filter.');
  }
  const providers = [];
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) providers.push(['Cloudflare', () => cloudflareImageRequest(prompt)]);
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_IMAGE_MODEL) providers.push(['OpenRouter', () => openRouterImageRequest(prompt, size)]);
  if (process.env.GEMINI_API_KEY) providers.push(['Gemini', () => geminiImageRequest(prompt, size)]);
  if (process.env.OPENAI_API_KEY) providers.push(['OpenAI', () => openAIImageRequest(prompt, size)]);
  if (process.env.POLLINATIONS_API_KEY) providers.push(['Pollinations', () => pollinationsImageRequest(prompt, size)]);
  if (!providers.length) {
    throw new Error('AI image generation is not configured. Configure at least one image-capable provider.');
  }

  const errors = [];
  for (const [name, request] of providers) {
    try {
      return await request();
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      console.warn(`Image provider ${name} failed:`, error.message);
    }
  }
  throw new Error(`All configured image providers failed. ${errors.join(' | ').slice(0, 900)}`);
}

module.exports = {
  creatorDefenseIntent,
  creatorDefensePrompt,
  resetDay,
  limits,
  check,
  commit,
  textRequest,
  visionRequest,
  friendlyAIError,
  openRouterTextRequest,
  openCodeZenTextRequest,
  creatorInfo,
  localIdentityResponse,
  systemPrompt,
  guildVisualContext,
  renderGuildVisuals,
  imageRequest,
  moderation,
  moderationMedia,
  detectImageIntent,
  getConversationHistory,
  looksLikeSafetyLeak
};
