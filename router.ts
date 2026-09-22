// @ts-nocheck
const {AttachmentBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder, PermissionFlagsBits}=require('discord.js');
const banking=require('./services/banking.ts'),marriage=require('./services/marriage.ts'),antiMention=require('./services/antimention.ts'),store=require('./services/store.ts'),ui=require('./services/ui.ts'),ownerService=require('./services/owner.ts'),privacy=require('./services/privacy.ts'),fun=require('./services/fun.ts'),adventure=require('./services/adventure.ts'),econ=require('./services/economy.ts'),progress=require('./services/progress.ts'),jobs=require('./services/jobs.ts'),shop=require('./services/shop.ts'),premium=require('./services/premium.ts'),topgg=require('./services/topgg.ts'),ai=require('./services/ai.ts'),music=require('./services/music.ts'),recording=require('./services/recording.ts'),moderation=require('./services/moderation.ts'),moderationExtra=require('./services/moderationExtra.ts'),moderationUpgrade=require('./services/moderation-upgrade.ts'),roles=require('./services/roles.ts'),security=require('./services/security.ts'),tickets=require('./services/tickets.ts'),cards=require('./services/cards.ts'),invites=require('./services/invites.ts'),settings=require('./services/settings.ts'),giveaway=require('./services/giveaway.ts'),prefix=require('./services/prefix.ts'),autorespond=require('./services/autorespond.ts'),tips=require('./services/tips.ts'),robService=require('./services/rob.ts'),legacy=require('./services/legacy.ts'),economyUpgrade=require('./services/economy-upgrade.ts');
const { specs, buildCommands, LEGACY_COMMAND_NAMES }=require('./commands.ts');
const { buildExtendedCommands }=require('./extendedCommands.ts');
const legacyNames=LEGACY_COMMAND_NAMES;
const crates=require('./services/crates.ts');
const helpCenter=require('./services/help-center.ts');
const auditLogs=require('./services/logging.ts'),status=require('./services/status.ts');
const ASTRIX_VERSION=require('./package.json').version || '8.6.0';
const MOD=new Set(['ban','unban','kick','timeout','untimeout','mute','unmute','jail','unjail','warn','warnings','clearwarns','purge','lock','unlock','slowmode','nickname','role','nick','hide','unhide','clonechannel','deletechannel','voiceban','voiceunban','massban','masskick']);
const ROLECMDS=new Set(['reactionrole','buttonrole','rolemenu','autorole','verify','welcome','goodbye','logs','automod','antilink','antiinvite','antispam','badwords']);
const SECCMDS=new Set(['security','antinuke','recover','backup','nuke','antibot','trust','untrust','antiraid','lockdown','unlockdown','antinsfw','securitystatus']);
const OWNER=new Set(['owner','givecoins','setbalance','giveitem','givepremium','removepremium','shoprefresh','setcredit','announce']);
const MUSIC=new Set(['play','pause','resume','skip','queue','nowplaying','loop','volume','stop','disconnect','music247','filter']);
const HELP_CATEGORY_ORDER=['Economy','Career','Banking','Marriage','Shop','AI','Music','Tickets','Moderation','Roles','Security','Progress','Premium','Extended','Owner','Utility','Fun'];
const HELP_META={Economy:['💰','Economy'],Career:['💼','Career'],Banking:['🏦','Banking'],Marriage:['💍','Marriage'],Shop:['🛒','Shop'],AI:['✨','AI'],Music:['🎵','Music'],Tickets:['🎫','Tickets'],Moderation:['🛡️','Moderation'],Roles:['🎭','Roles'],Security:['🔐','Security'],Progress:['⭐','XP & Levels'],Premium:['💎','Premium'],Extended:['🧩','Extended'],Owner:['👑','Owner'],Utility:['🧰','Utility'],Fun:['🎮','Fun']};
const HELP_GROUPS={
 Economy:new Set(['balance','wallet','daily','weekly','deposit','withdraw','pay','bank','autopay','leaderboard','inventory','use','sell']),
 Career:new Set(['work']),
 Banking:new Set(['bank','loan','credit','repay','autopay']),
 Marriage:new Set(['marry']),
 Shop:new Set(['shop','buy','sell','inventory','use']),
 AI:new Set(['ai','ask','translate','rewrite','summarize','generate','aiusage']),
 Music:new Set(['play','pause','resume','skip','queue','nowplaying','loop','volume','stop','disconnect','music247','record']),
 Tickets:new Set(['ticket']),
 Moderation:new Set([...MOD,'antimention','muterole','quarantine']),
 Roles:ROLECMDS,
 Security:SECCMDS,
 
 Premium:new Set(['premium','premiumtiers','premiumcurrency','earlyaccess']),
 Utility:new Set(['help','ping','uptime','users','servers','botinfo','serverinfo','liveleaderboard','membercount']),
 Owner:OWNER,
 Fun:new Set(['rps','trivia','coinflip','dice','eightball','choose','rate','iq','joke','fact','reverse','mock','randomnumber','ship','hunt','fish','dig','beg','search','zoo','collection','quests','achievements','action']),
  Extended:new Set(['giveaway','prefix','noprefix','autorespond','adventure','hug','kiss','slap','punch','fuck'])
};
function liveHelpCommands(i){
  const commands=i?.client?.astrixHelpCommands;
  return Array.isArray(commands)&&commands.length?commands:null;
}
function allRegisteredHelpCommands(i){
  const map=new Map();
  const source=liveHelpCommands(i)||[...buildCommands(),...buildExtendedCommands()];
  for(const c of source) if(c?.name&&!map.has(c.name)) map.set(c.name,c);
  return [...map.values()];
}
function dynamicHelpCats(i){
  const registered=allRegisteredHelpCommands(i);
  const out=Object.fromEntries(HELP_CATEGORY_ORDER.map(c=>[c,[]]));
  for(const command of registered){
    const n=command.name;
    let cat='Extended';
    for(const candidate of HELP_CATEGORY_ORDER) if(HELP_GROUPS[candidate]?.has(n)){cat=candidate;break;}
    if(cat==='Owner'&&!premium.isOwner(i.user.id)) continue;
    out[cat].push(command);
  }
  for(const cat of HELP_CATEGORY_ORDER){
    const unique=new Map(out[cat].map(command=>[command.name,command]));
    out[cat]=[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }
  return out;
}
function helpCategories(i){const cats=dynamicHelpCats(i);return HELP_CATEGORY_ORDER.filter(c=>cats[c].length);}
const EXT_DESC={adventure:'Hunt, fish, dig, collect, quest and unlock achievements.',action:'Send random SFW reaction GIFs such as hug, slap, punch, pat, wave and more.',giveaway:'Create and manage free-entry giveaways.',prefix:'View or change the server prefix.',noprefix:'Grant or revoke server-scoped no-prefix text command access (Premium server feature).',muterole:'Create a Muted role, apply channel permissions, and mute or unmute members.',premiumcurrency:'View or manage Astrix Gems.',earlyaccess:'View or manage Early Access.',premiumtiers:'View Premium tiers and Gems bundles.',serverinfo:'View complete server information, server Premium tier, and the installed Astrix version.',autorespond:'Configure automatic text responses.',coinflip:'Flip a coin for fun.',dice:'Roll a six-sided dice.',eightball:'Ask the Astrix magic 8-ball.',choose:'Let Astrix choose between options.',rate:'Get a random fun rating.',iq:'Generate a joke IQ score.',joke:'Get a family-friendly joke.',fact:'Get an interesting fact.',reverse:'Reverse your text.',mock:'Alternate the case of your text.',randomnumber:'Generate a random number.',ship:'Generate a lighthearted compatibility score.'};
function spec(n,i){
  const live=liveHelpCommands(i)?.find(command=>command.name===n);
  return live||specs.find(x=>x.name===n)||{name:n,description:EXT_DESC[n]||''};
}
function helpModuleMenu(i,selected=''){
  const cats=helpCategories(i);
  const menu=new StringSelectMenuBuilder()
    .setCustomId(`helpmodule:${i.user.id}`)
    .setPlaceholder('↪ Select a module to see')
    .addOptions(cats.map(cat=>{const [emoji,label]=HELP_META[cat]||['📁',cat];return{label,value:cat,emoji,description:`View ${label} commands`.slice(0,100),default:cat===selected};}));
  return new ActionRowBuilder().addComponents(menu);
}
const HELP_TIPS=[
  '🛡️ Moderation — use AutoMod and moderation tools to protect your server.',
  '⭐ XP & Levels — keep conversations active to earn XP and level up.',
  '💎 Premium — server Premium unlocks no-prefix commands and all Premium features for everyone.',
  '🎟️ Invites — use invite tracking to see which members bring in new people.',
  '🎙️ Voice — recording and voice activity tools are available from the Music module.',
  '🧰 Utility — check /serverinfo for the full server snapshot and Astrix version.'
];
function helpTip(i){
  const index=(Math.floor(Date.now()/86400000)+String(i.guildId||'').length+i.user.id.length)%HELP_TIPS.length;
  return HELP_TIPS[index];
}
function helpButtonRows(i){
  const cats=helpCategories(i);
  const rows=[];
  for(let start=0;start<cats.length;start+=5){
    rows.push(new ActionRowBuilder().addComponents(cats.slice(start,start+5).map(cat=>{
      const [emoji,label]=HELP_META[cat]||['📁',cat];
      return new ButtonBuilder().setCustomId(`help:cat:${i.user.id}:${cat}`).setLabel(label.slice(0,80)).setEmoji(emoji).setStyle(ButtonStyle.Secondary);
    })));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help:select:${i.user.id}`).setLabel('Use Module Selector').setEmoji('↪').setStyle(ButtonStyle.Primary)
  ));
  return rows;
}
function helpHome(i){
  const bot=i.client.user,cats=helpCategories(i),dynamicCats=dynamicHelpCats(i),total=cats.reduce((n,c)=>n+(dynamicCats[c]?.length||0),0);
  const lines=cats.map(cat=>{const [emoji,label]=HELP_META[cat]||['📁',cat];return `${emoji}  » **${label}**`;}).join('\n');
  const prefixValue=store.guild(i.guildId)?.prefix||'/';
  const e=ui.embed(`✨ ${bot.username} • Help Center`,`Welcome **${i.user.username}** 👋\n\n• Prefix: \`${prefixValue}\`\n• Explore commands with the menu below.\n• **${total}** registered commands are currently listed.\n\n${lines}\n\n**⭐ Tip for today**\n${helpTip(i)}`)
    .setThumbnail(bot.displayAvatarURL({size:256}))
    .setAuthor({name:`${bot.username} • Help Center`,iconURL:bot.displayAvatarURL({size:128})});
  const rows=[helpModuleMenu(i),new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help:buttons:${i.user.id}`).setLabel('Change to Buttons').setEmoji('🔘').setStyle(ButtonStyle.Secondary)
  )];
  const support=ui.supportUrl();
  if(support)rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('💎 Get Premium').setStyle(ButtonStyle.Link).setURL(support),
    new ButtonBuilder().setLabel('🛟 Support').setStyle(ButtonStyle.Link).setURL(support)
  ));
  return{embeds:[e],components:rows};
}
function helpButtonHome(i){
  const home=helpHome(i);
  return {embeds:home.embeds,components:helpButtonRows(i)};
}
async function helpCommand(i){
  await i.deferReply();
  const logo=i.client.user?.displayAvatarURL?.({size:256});
  await i.editReply({embeds:[ui.embed('⏳ Loading Astrix Help','Preparing the command center…\n\n`[■■□□□□]`').setThumbnail(logo)],components:[]});
  await new Promise(resolve=>setTimeout(resolve,450));
  await i.editReply({embeds:[ui.embed('✨ Loading Astrix Help','Syncing categories, Premium recommendations and utilities…\n\n`[■■■■□□]`').setThumbnail(logo)],components:[]});
  await new Promise(resolve=>setTimeout(resolve,450));
  // Read Discord's current global and guild command collections so Help stays
  // accurate after a command is added, removed, or moved between registries.
  // The source builders remain the fallback when Discord is temporarily
  // unavailable.
  try{
    const results=await Promise.allSettled([
      i.client.application?.commands?.fetch(),
      i.guild?.commands?.fetch()
    ]);
    const live=new Map();
    for(const result of results) for(const command of result.status==='fulfilled'
      ? [...(result.value?.values?.()||[])]
      : []) {
      if(command?.name&&!live.has(command.name)) live.set(command.name,typeof command.toJSON==='function'?command.toJSON():command);
    }
    if(live.size)i.client.astrixHelpCommands=[...live.values()];
  }catch(error){
    console.warn('Help command registry refresh failed; using local definitions:',error.message);
  }
  return i.editReply(helpHome(i));
}

function helpCategory(i,cat,page=0){
  const cats=helpCategories(i);if(!cats.includes(cat))cat=cats[0]||'Utility';
  const dynamicCats=dynamicHelpCats(i),commands=dynamicCats[cat]||[],perPage=8,pages=Math.max(1,Math.ceil(commands.length/perPage));page=Math.max(0,Math.min(Number(page)||0,pages-1));
  const slice=commands.slice(page*perPage,(page+1)*perPage);
  const bot=i.client.user,[emoji,label]=HELP_META[cat]||['📁',cat];
  const list=slice.map(command=>{const n=command.name,x=spec(n,i),mark=OWNER.has(n)?' 👑':(n==='premiumtiers'||n==='premiumcurrency'||n==='earlyaccess'?' 💎':'');return `**/${n}**${mark}\n└ ${x?.description||EXT_DESC[n]||'Astrix command.'}`;}).join('\n\n');
  const e=ui.embed(`${emoji} ${label}`,`${list||'No commands in this module.'}\n\n**Page ${page+1} of ${pages}**`)
    .setThumbnail(bot.displayAvatarURL({size:256}))
    .setAuthor({name:`${bot.username} • Help Center`,iconURL:bot.displayAvatarURL({size:128})});
  // Every component in a Discord message must have a unique custom_id, even when disabled.
  // Include the navigation action in the id so first/previous and next/last never collide.
  const nav=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help:first:${i.user.id}:${cat}:0`).setEmoji('⏪').setStyle(ButtonStyle.Primary).setDisabled(page===0),
    new ButtonBuilder().setCustomId(`help:prev:${i.user.id}:${cat}:${Math.max(0,page-1)}`).setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(page===0),
    new ButtonBuilder().setCustomId(`help:home:${i.user.id}`).setEmoji('🏠').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`help:next:${i.user.id}:${cat}:${Math.min(pages-1,page+1)}`).setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(page>=pages-1),
    new ButtonBuilder().setCustomId(`help:last:${i.user.id}:${cat}:${pages-1}`).setEmoji('⏩').setStyle(ButtonStyle.Primary).setDisabled(page>=pages-1)
  );
  return{embeds:[e],components:[nav,helpModuleMenu(i,cat),new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help:buttons:${i.user.id}`).setLabel('Change to Buttons').setEmoji('🔘').setStyle(ButtonStyle.Secondary)
  )]};
}
function requireGuild(i){if(!i.guildId)throw new Error('This command only works inside a server.');}
function rewardCapacityNote(got){const notes=[];if(got.bankAdded>0)notes.push(`**${econ.fmt(got.bankAdded)}** overflow was stored in your bank.`);if(got.uncredited>0)notes.push(`⚠️ **${econ.fmt(got.uncredited)}** could not be stored because your wallet and bank are full.`);return notes.length?`\n${notes.join('\n')}`:'';}

function overflowCommandName(i) {
  if (i.commandName !== 'extras') return null;
  const group = i.options.getSubcommandGroup?.();
  if (['lootbox', 'weaponcrate', 'autorespond', 'adventure'].includes(group)) return group;
  return i.options.getSubcommand?.() || null;
}

async function pingCommand(i, client) {
  const samples = client.astrixPingSamples || (client.astrixPingSamples = []);
  samples.push(Math.max(0, client.ws.ping));
  while (samples.length > 18) samples.shift();
  const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const rest = Math.max(0, Math.round(client.rest?.latency || client.ws.ping));
  const rating = client.ws.ping < 80 ? 'Excellent' : client.ws.ping < 150 ? 'Good' : 'Slow';

  return i.reply({
    embeds: [ui.success('Astrix Ping', `Gateway: **${client.ws.ping} ms**\nREST: **${rest} ms**\nMemory: **${mem} MB**\nUptime: **${ui.formatDuration(process.uptime() * 1000)}**\nStatus: **${rating}**`)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ping:refresh:${i.user.id}`).setLabel('Refresh').setStyle(ButtonStyle.Primary)
    )]
  });
}

async function botStatusCommand(i, client) {
  requireGuild(i);
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new Error('You need the **Manage Server** permission to configure the live bot status.');
  }

  const sub = i.options.getSubcommand();
  if (sub === 'enable') {
    const message = await status.enable(client, i);
    return i.reply({ embeds: [ui.success('Live Bot Status Enabled', message)] });
  }
  if (sub === 'refresh') {
    const updated = await status.updateGuild(client, i.guild);
    if (!updated) throw new Error('No live status channel is configured, or the saved channel is no longer available. Run `/botstatus enable` in the target channel.');
    return i.reply({ embeds: [ui.success('Live Bot Status Refreshed', status.view(i.guildId))], ephemeral: true });
  }
  if (sub === 'off') {
    status.disable(i.guildId);
    return i.reply({ embeds: [ui.success('Live Bot Status Disabled', 'The live status message will no longer be updated.') ] });
  }
  return i.reply({ embeds: [ui.embed('Live Bot Status', status.view(i.guildId))], ephemeral: true });
}

async function classicCommand(i) {
  requireGuild(i);
  const sub = i.options.getSubcommand();
  const user = store.user(i.guildId, i.user.id);

  if (sub === 'afk') {
    const message = i.options.getString('message');
    if (!message) {
      user.afk = null;
      user.afkSince = null;
      store.save();
      return i.reply({ embeds: [ui.success('AFK Cleared', 'Your AFK status has been removed.')] });
    }
    user.afk = message.slice(0, 300);
    user.afkSince = Date.now();
    store.save();
    return i.reply({ embeds: [ui.success('AFK Enabled', `I will show this message when people check on you:\n\n> ${user.afk}`)] });
  }
  if (sub === 'birthday') {
    const date = i.options.getString('date', true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new Error('Use a real date in `YYYY-MM-DD` format.');
    }
    user.birthday = date;
    store.save();
    return i.reply({ embeds: [ui.success('Birthday Saved', `Your birthday is saved as **${date}**.`)] });
  }
  if (sub === 'birthday-view') {
    return i.reply({ embeds: [ui.embed('Birthday', user.birthday ? `Saved birthday: **${user.birthday}**` : 'No birthday is saved yet. Use `/classic birthday`.')] });
  }
  if (sub === 'serverstats') {
    const g = i.guild;
    return i.reply({ embeds: [ui.embed('Server Statistics', `Members: **${g.memberCount.toLocaleString()}**\nChannels: **${g.channels.cache.size.toLocaleString()}**\nRoles: **${Math.max(0, g.roles.cache.size - 1).toLocaleString()}**\nEmojis: **${g.emojis.cache.size.toLocaleString()}**\nBoost level: **${g.premiumTier}**`)] });
  }
  if (sub === 'channelinfo') {
    const channel = i.options.getChannel('channel') || i.channel;
    return i.reply({ embeds: [ui.embed('Channel Information', `Name: **#${channel.name || 'unknown'}**\nID: \`${channel.id}\`\nType: **${channel.type}**\nCategory: **${channel.parent?.name || 'None'}**`)] });
  }
  if (sub === 'members') {
    const members = await i.guild.members.fetch();
    const bots = members.filter(member => member.user.bot).size;
    return i.reply({ embeds: [ui.embed('Member Breakdown', `Total: **${members.size.toLocaleString()}**\nHumans: **${(members.size - bots).toLocaleString()}**\nBots: **${bots.toLocaleString()}**\nOnline cache: **${members.filter(member => member.presence?.status && member.presence.status !== 'offline').size.toLocaleString()}**`)] });
  }
  if (sub === 'avatar') {
    const target = i.options.getUser('user') || i.user;
    return i.reply({ embeds: [ui.embed(`${target.username}'s Avatar`, `[PNG](${target.displayAvatarURL({ extension: 'png', size: 4096 })}) • [JPG](${target.displayAvatarURL({ extension: 'jpg', size: 4096 })})`).setImage(target.displayAvatarURL({ extension: 'png', size: 1024 }))] });
  }
  if (sub === 'roll') {
    const max = i.options.getInteger('max') || 100;
    return i.reply({ embeds: [ui.embed('Dice Roll', `You rolled **${1 + Math.floor(Math.random() * max)}** out of **${max}**.`)] });
  }
  if (sub === 'reverse') {
    const text = i.options.getString('text', true);
    return i.reply({ embeds: [ui.embed('Reverse', text.split('').reverse().join(''))] });
  }
  if (sub === 'calculator') {
    const expression = i.options.getString('expression', true).replace(/\s+/g, '');
    if (!/^[0-9+\-*/%.()]+$/.test(expression)) throw new Error('Only basic arithmetic characters are allowed.');
    const result = Function(`"use strict"; return (${expression})`)();
    if (!Number.isFinite(result)) throw new Error('That expression does not produce a finite number.');
    return i.reply({ embeds: [ui.embed('Calculator', `\`${expression}\` = **${Number(result).toLocaleString()}**`)] });
  }
  if (sub === 'casino') {
    const bet = i.options.getInteger('bet', true);
    const game = i.options.getString('game', true);
    if (user.wallet < bet) throw new Error(`You need ${econ.fmt(bet)} in your wallet.`);
    user.wallet -= bet;
    const roll = Math.random();
    const multiplier = game === 'slots' ? (roll < 0.08 ? 5 : roll < 0.42 ? 2 : 0) : (roll < 0.48 ? 2 : 0);
    const payout = multiplier ? econ.creditGamePayout(user, bet * multiplier).credited : 0;
    store.save();
    return i.reply({ embeds: [multiplier ? ui.success(`${game} Win`, `You wagered **${econ.fmt(bet)}** and received **${econ.fmt(payout)}**.`) : ui.error(`${game} Loss`, `You lost **${econ.fmt(bet)}**. Better luck next time.`)] });
  }
}

async function xpCommand(i) {
  const target = i.options.getUser('user') || i.user;
  const t = store.user(i.guildId, target.id);
  const p = progress.xpProgress(t);
  return i.reply({
    embeds: [ui.embed(`⭐ ${target.username} • XP Progress`,
      `Level: **${p.level}**\nXP: **${p.xp.toLocaleString()} / ${p.required.toLocaleString()}** (**${p.percent}%**)\nNext level: **${p.needed.toLocaleString()} XP needed**\nCash: **${econ.fmt(t.wallet)}** • Bank: **${econ.fmt(t.bank)}**`)]
  });
}

function loanApr(creditScore, type='personal'){
  const base=banking.loanTypeInfo(type).apr;
  const score=Math.max(300,Math.min(850,Number(creditScore||650)));
  const discount=score>=800?4:score>=740?3:score>=680?2:score>=620?1:0;
  return Math.max(3,base-discount);
}
function loanLimit(u,type='personal'){
  const score=Math.max(300,Math.min(850,Number(u.creditScore||650)));
  const level=Math.max(1,Number(u.level||1));
  const info=banking.loanTypeInfo(type);
  const base=Math.max(500,Math.min(500000,Math.floor(10000+level*7500+Math.max(0,score-600)*750)));
  return Math.max(500,Math.floor(base*info.maxMultiplier));
}
function calcLoan(u,amount,months,type='personal'){
  amount=Math.floor(Number(amount||0));months=Math.floor(Number(months||0));
  if(![1,3,6,12].includes(months))throw new Error('Choose a valid loan tenure: 1, 3, 6 or 12 virtual months.');
  const info=banking.loanTypeInfo(type);
  if(amount<500)throw new Error('Minimum virtual loan amount is 500 coins.');
  if(amount>500000)throw new Error('Maximum virtual loan amount is 500,000 coins.');
  if(Number(u.creditScore||650)<info.minScore)throw new Error(`Your Astrix credit score must be at least ${info.minScore} for a ${info.label.toLowerCase()} loan.`);
  const limit=loanLimit(u,type);if(amount>limit)throw new Error(`Your current ${info.label.toLowerCase()} loan eligibility limit is ${econ.fmt(limit)}.`);
  const apr=loanApr(u.creditScore,type),interest=Math.ceil(amount*(apr/100)*(months/12)),total=amount+interest,emi=Math.ceil(total/months);
  return{amount,months,type,apr,interest,total,emi,limit};
}
function creditEmbed(u){
  const score=Math.max(300,Math.min(850,Number(u.creditScore||650))),grade=score>=800?'Excellent':score>=740?'Very Good':score>=680?'Good':score>=620?'Fair':score>=550?'Building':'Limited';
  const loan=u.loan?`Active loan: **${econ.fmt(u.loan.remaining)} remaining**\nType: **${banking.loanTypeInfo(u.loan.type).label}**\nEMI: **${econ.fmt(u.loan.emi)}**\nAutoPay: **${u.loan.autopay?'Enabled':'Disabled'}**\nNext virtual due: **${banking.virtualDueText(u.loan.nextDue)}**`:'Active loan: **None**';
  return ui.embed('💳 Astrix Credit Report',`Credit score: **${score} / 850** • **${grade}**\nPersonal limit: **${econ.fmt(loanLimit(u,'personal'))}**\nBusiness limit: **${econ.fmt(loanLimit(u,'business'))}**\nEmergency limit: **${econ.fmt(loanLimit(u,'emergency'))}**\n\n${loan}\n\n**Virtual banking:** 1 month is an accelerated Astrix cycle, not a real calendar month.`);
}
function bankCommand(i,u){
  const sub=i.options.getSubcommand();
  if(sub==='overview'){
    const b=banking.bankSummary(u);
    return i.reply({embeds:[ui.embed('🏦 Astrix Bank',`Wallet: **${econ.fmt(b.wallet)} / ${econ.fmt(b.walletLimit)}**\nBank: **${econ.fmt(b.bank)} / ${econ.fmt(b.bankLimit)}**\nNet worth: **${econ.fmt(b.netWorth)}**\nTier: **${banking.bankTierInfo(u.bankTier).label}**\nInterest: **${u.bankInterestEnabled?'Enabled':'Disabled'}**\nLoan: **${b.loan?`${banking.loanTypeInfo(b.loan.type).label} • ${econ.fmt(b.loan.remaining)} remaining`:'None'}`)]});
  }
  if(sub==='interest'){
    u.bankInterestEnabled=i.options.getBoolean('enabled',true);store.save();
    return i.reply({embeds:[ui.success('Bank Interest',`Virtual bank interest is now **${u.bankInterestEnabled?'enabled':'disabled'}**.`)]});
  }
  if(sub==='upgrade'){const tier=i.options.getString('tier',true);const r=banking.bankTierUpgrade(u,tier);return i.reply({embeds:[ui.success('🏦 Bank Tier Upgraded',`Tier: **${banking.bankTierInfo(r.tier).label}**
Paid: **${econ.fmt(r.cost)}**
Limit bonus: **+${econ.fmt(r.bonus)}**
Interest rate: **${r.interest}% per virtual month**`)]});}
  const rows=(u.bankLedger||[]).slice(-10).reverse().map(x=>`${x.type==='in'?'🟢':'🔴'} **${x.label}** • ${econ.fmt(x.amount)} • <t:${Math.floor(x.at/1000)}:R>`);return i.reply({embeds:[ui.embed('🧾 Bank Statement',`Tier: **${banking.bankTierInfo(u.bankTier).label}**\nWallet: **${econ.fmt(u.wallet)}**\nBank: **${econ.fmt(u.bank)}**\nNet worth: **${econ.fmt(Number(u.wallet||0)+Number(u.bank||0))}**\n\n**Recent activity**\n${rows.join('\n')||'No transactions recorded yet.'}`)]});
}
function autopayCommand(i,u){
  const sub=i.options.getSubcommand();
  if(sub==='status'){
    if(!u.loan)return i.reply({embeds:[ui.embed('🤖 Loan AutoPay','You do not have an active virtual loan.')]});
    return i.reply({embeds:[ui.embed('🤖 Loan AutoPay',`Status: **${u.loan.autopay?'Enabled':'Disabled'}**\nLoan: **${banking.loanTypeInfo(u.loan.type).label}**\nEMI: **${econ.fmt(u.loan.emi)}**\nNext virtual cycle: **${banking.virtualDueText(u.loan.nextDue)}\n\nAutoPay uses Astrix virtual cycles, not real calendar months.`)]});
  }
  if(sub==='enable'){banking.enableAutopay(u);store.save();return i.reply({embeds:[ui.success('AutoPay Enabled','Your next virtual loan EMI will be processed automatically.') ]});}
  banking.disableAutopay(u);store.save();return i.reply({embeds:[ui.success('AutoPay Disabled','Automatic loan EMI payments are now disabled.') ]});
}
function loan(i,u){
  if(u.loan)return i.reply({embeds:[creditEmbed(u)]});
  const amount=i.options.getInteger('amount'),months=i.options.getInteger('tenure')||3,type=i.options.getString('type')||'personal';
  if(!amount)return i.reply({embeds:[ui.embed('🏦 Astrix Virtual Loan Center',`Credit score: **${Number(u.creditScore||650)}**\nPersonal limit: **${econ.fmt(loanLimit(u,'personal'))}**\nBusiness limit: **${econ.fmt(loanLimit(u,'business'))}**\nEmergency limit: **${econ.fmt(loanLimit(u,'emergency'))}**\n\nLoan types: **Personal • Business • Emergency**\nTenures: **1 • 3 • 6 • 12 virtual months**\n\nVirtual months are accelerated Astrix cycles, not real calendar months.`)]});
  const q=calcLoan(u,amount,months,type);
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`loan:accept:${i.user.id}:${q.amount}:${q.months}:${q.type}`).setLabel('Accept Loan').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`loan:cancel:${i.user.id}:${q.amount}:${q.months}:${q.type}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
  return i.reply({embeds:[ui.embed('🏦 Virtual Loan Offer',`Type: **${banking.loanTypeInfo(q.type).label}**\nPrincipal: **${econ.fmt(q.amount)}**\nAPR: **${q.apr}%**\nTenure: **${q.months} virtual month(s)**\nInterest: **${econ.fmt(q.interest)}**\nTotal repayment: **${econ.fmt(q.total)}**\nVirtual EMI: **${econ.fmt(q.emi)}**\n\n⏱️ **1 virtual month = ${Math.round(banking.virtualMonthMs()/1000)} seconds by default.**\nYour bank needs enough free capacity to receive the principal.`)],components:[row]});
}
function debitForRepayment(u,amount){return banking.applyLoanPayment(u,amount);}
function repay(i,u){
  if(!u.loan)throw new Error('You do not have an active virtual loan.');
  const full=i.options.getBoolean('full')===true;
  let amount=full?Number(u.loan.remaining||0):Number(i.options.getInteger('amount')||u.loan.emi||0);
  amount=Math.max(1,Math.min(Math.floor(amount),Math.floor(Number(u.loan.remaining||0))));
  const debit=debitForRepayment(u,amount);if(!debit.ok)throw new Error(`You do not have enough wallet + bank coins. Shortfall: ${econ.fmt(debit.shortfall)}.`);
  u.loan.remaining=Math.max(0,Math.floor(Number(u.loan.remaining||0)-amount));u.loan.payments=Number(u.loan.payments||0)+1;
  if(u.loan.remaining<=0){u.loan=null;u.creditScore=Math.min(850,Number(u.creditScore||650)+12);}else{u.loan.nextDue=Date.now()+banking.virtualMonthMs();u.creditScore=Math.min(850,Number(u.creditScore||650)+2);}
  store.save();
  return i.reply({embeds:[ui.success('Loan Repayment',`Paid **${econ.fmt(amount)}**.\nWallet used: **${econ.fmt(debit.walletSpent)}** • Bank used: **${econ.fmt(debit.bankSpent)}**\n${u.loan?`Remaining: **${econ.fmt(u.loan.remaining)}**\nNext virtual due: **${banking.virtualDueText(u.loan.nextDue)}**`:'✅ Your virtual loan is fully repaid.'}`)]});
}
async function marriageCommand(i,u){
  const sub=i.options.getSubcommand();

  if(sub==='status'){
    const s=marriage.status(i.guildId,i.user.id);
    if(!s.married)return i.reply({embeds:[ui.embed('💍 Marriage Status','You are currently **single**.\n\nBuy a marriage ring from `/shop` and propose to someone.') ]});
    const ring=s.ring;
    return i.reply({embeds:[ui.embed('💍 Marriage Status',
      `You are married to <@${s.partnerId}>.\n`+
      `Status: **💍 Married**\n`+
      `Ring: **${ring?.emoji||'💍'} ${ring?.name||'Marriage Ring'}** • ${ring?.rarity||'Unknown'} • ${Number(ring?.value||0).toLocaleString()} coins\n`+
      `Married: <t:${Math.floor(Number(s.marriedAt)/1000)}:D>\n`+
      `Next anniversary: <t:${Math.floor(Number(s.nextAnniversary)/1000)}:R>\n`+
      `Gifts: **${Number(s.stats?.giftsSent||0)} sent** • **${Number(s.stats?.giftsReceived||0)} received**\n`+
      `Achievements: **${(s.achievements||[]).length}**\n\n`+
      `Use **/marry gift**, **/marry achievements** or **/marry divorce confirm:true**.`)]});
  }

  if(sub==='anniversary'){
    const s=marriage.status(i.guildId,i.user.id);
    if(!s.married)throw new Error('You are not married.');
    const years=Math.max(0,Math.floor((Date.now()-Number(s.marriedAt||Date.now()))/31557600000));
    return i.reply({embeds:[ui.embed('📅 Marriage Anniversary',
      `Spouse: <@${s.partnerId}>\nMarried: <t:${Math.floor(Number(s.marriedAt)/1000)}:D>\n`+
      `Years completed: **${years}**\nNext anniversary: <t:${Math.floor(Number(s.nextAnniversary)/1000)}:F>`)]});
  }

  if(sub==='achievements'){
    const target=i.options.getUser('user')||i.user;
    const list=marriage.achievements(i.guildId,target.id);
    return i.reply({embeds:[ui.embed('🏆 Marriage Achievements',
      `<@${target.id}> has unlocked **${list.length}** marriage achievement(s).\n\n${list.length?list.map(x=>`• ${x}`).join('\n'):'No achievements yet.'}`)]});
  }

  if(sub==='leaderboard'){
    const rows=marriage.leaderboard(i.guildId,10);
    if(!rows.length)return i.reply({embeds:[ui.embed('🏆 Married Couples Leaderboard','No married couples yet.')]});
    const lines=rows.map((x,n)=>`${n+1}. <@${x.a}> 💍 <@${x.b}> — **${x.days} days** — ${marriage.ringInfo(x.ringId)?.emoji||'💍'}`);
    return i.reply({embeds:[ui.embed('🏆 Married Couples Leaderboard',lines.join('\n'))]});
  }

  if(sub==='gift'){
    const target=i.options.getUser('user');
    const amount=i.options.getInteger('amount',true);
    if(!target||target.bot)throw new Error('Choose your married partner.');
    const result=marriage.gift(i.guildId,i.user.id,target.id,amount);
    return i.reply({embeds:[ui.success('🎁 Couple Gift',`You sent **${result.amount.toLocaleString()} coins** to <@${target.id}>. 💝`)]});
  }

  const target=i.options.getUser('user');
  if(sub==='propose'){
    if(!target||target.bot)throw new Error('Choose a real server member.');
    const ringId=i.options.getString('ring')||marriage.DEFAULT_RING_ID;
    const p=marriage.propose(i.guildId,i.user.id,target.id,ringId);
    const ring=marriage.ringInfo(p.ringId);
    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`marry:accept:${target.id}:${i.user.id}`).setLabel('💍 Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`marry:decline:${target.id}:${i.user.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
    );
    await i.deferReply();
    const frames=[
      ui.embed('💌 Preparing a Marriage Proposal','💍 · · ·\n\nA special moment is being prepared…'),
      ui.embed('💌 Preparing a Marriage Proposal','💍 💖 💍\n\nThe ring is ready…'),
      ui.embed('💌 Marriage Proposal',`<@${i.user.id}> is proposing to <@${target.id}> with **${ring?.emoji||'💍'} ${ring?.name||'Marriage Ring'}**…`)
    ];
    for(const frame of frames){
      await i.editReply({content:`💍 <@${target.id}>`,embeds:[frame],components:[]});
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    return i.editReply({
      content:`💍 <@${target.id}>`,
      embeds:[ui.embed('💌 Marriage Proposal',`<@${i.user.id}> proposed with **${ring?.emoji||'💍'} ${ring?.name||'Marriage Ring'}**.\n\n✨ This proposal expires in **10 minutes**.`)],
      components:[row]
    });
  }

  if(sub==='accept'){
    const result=marriage.accept(i.guildId,i.user.id,target.id);
    const ring=marriage.ringInfo(result.ringId);
    await i.deferReply();
    const frames=[
      ui.embed('💍 Joining Hearts','💗 · · ·\n\nThe vows are being prepared…'),
      ui.embed('💍 Joining Hearts','💗 💍 💗\n\nThe ring has been exchanged…'),
      ui.embed('🎉 Almost Official','💖 💍 💖\n\nOne last sparkle…')
    ];
    for(const frame of frames){
      await i.editReply({embeds:[frame],components:[]});
      await new Promise(resolve=>setTimeout(resolve,300));
    }
    return i.editReply({embeds:[ui.success('💍 Married!',`🎉✨💍✨🎉\n\nCongratulations <@${i.user.id}> and <@${target.id}>!\n\n${ring?.emoji||'💍'} **${ring?.name||'Marriage Ring'}** • ${ring?.rarity||'Special'}\n💰 Couple bonus: **${Number(result.bonus||0).toLocaleString()} coins each**\n📅 Anniversary tracking has started.`)]});
  }

  if(sub==='decline'){
    marriage.decline(i.guildId,i.user.id,target.id);
    return i.reply({embeds:[ui.embed('💔 Proposal Declined','The marriage proposal was declined.')]});
  }

  if(sub==='divorce'){
    if(!i.options.getBoolean('confirm',true))throw new Error('Set **confirm:true** to continue.');
    const result=marriage.divorce(i.guildId,i.user.id);
    return i.reply({embeds:[ui.embed('💔 Divorce Complete',`Your Astrix marriage with <@${result.partnerId}> has ended.\nDivorce fee paid: **${result.fee.toLocaleString()} coins**.`)]});
  }
}

async function invitesCommand(i){
  const sub=i.options.getSubcommand();
  if(sub==='view'){
    const target=i.options.getUser('user')||i.user;
    const s=invites.get(i.guildId,target.id);
    const attribution=invites.invitedBy(i.guildId,target.id);
     const invitedByText=attribution.inviterId
       ? `<@${attribution.inviterId}>${attribution.inviterTag ? ` (${attribution.inviterTag})` : ''}`
       : 'Unknown / not tracked';
    return i.reply({embeds:[ui.embed('🎟️ Invite Tracker',
      `<@${target.id}>\n\n`+
      `Invites: **${s.total}**\n`+
      `Joins credited: **${s.joins}**\n`+
      `Leaves: **${s.leaves}**\n`+
      `Active invites: **${s.regular}**\n`+
      `Invited by: ${invitedByText}`)]});
  }
  if(sub==='inviter'){
    const target=i.options.getUser('user')||i.user;
    const attribution=invites.invitedBy(i.guildId,target.id);
    if(!attribution.inviterId){
      return i.reply({embeds:[ui.embed('🔎 Invite Attribution',
        `<@${target.id}> does not have a recorded inviter.\n\n`+
        `This can happen when the bot joined after the member, invite tracking was unavailable, or the join used a vanity URL.`)]});
    }
    const joinedText=attribution.invitedAt
      ? `<t:${Math.floor(attribution.invitedAt/1000)}:F> (<t:${Math.floor(attribution.invitedAt/1000)}:R>)`
      : 'Unknown';
    return i.reply({embeds:[ui.embed('🔎 Invite Attribution',
      `Member: <@${target.id}>\n`+
       `Invited by: <@${attribution.inviterId}>${attribution.inviterTag ? ` (${attribution.inviterTag})` : ''}\n`+
      `Invite code: ${attribution.inviteCode ? `\`${attribution.inviteCode}\`` : 'Unknown'}\n`+
      `Joined: ${joinedText}`)]});
  }
  if(sub==='recent'){
    const rows=invites.recent(i.guildId,i.options.getInteger('limit')||10);
    if(!rows.length)return i.reply({embeds:[ui.embed('🕘 Recent Invites','No join history has been tracked yet.')]});
    const lines=rows.map((entry,n)=>{
       const inviter=entry.inviterId
         ? `<@${entry.inviterId}>${entry.inviterTag ? ` (${entry.inviterTag})` : ''}`
         : 'Unknown inviter';
      const code=entry.inviteCode ? ` • \`${entry.inviteCode}\`` : '';
      const joined=entry.joinedAt ? `<t:${Math.floor(entry.joinedAt/1000)}:R>` : 'unknown time';
      return `${n+1}. <@${entry.memberId}> ← ${inviter}${code} • ${joined}`;
    });
    return i.reply({embeds:[ui.embed('🕘 Recent Invite Activity',lines.join('\n'))]});
  }
  if(sub==='stats'){
    const stats=invites.serverStats(i.guildId);
    return i.reply({embeds:[ui.embed('📊 Server Invite Stats',
      `Tracked inviters: **${stats.trackedInviters}**\n`+
      `Total credited joins: **${stats.totalJoins}**\n`+
      `Tracked leaves: **${stats.totalLeaves}**\n`+
      `Active invites: **${stats.activeInvites}**\n`+
      `Recent join records: **${stats.recentEntries}**`)]});
  }
  if(['channel-set','channel-off','channel-view'].includes(sub)){
    if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))throw new Error('Manage Server permission is required to manage invite report channels.');
    if(sub==='channel-set'){
      const channel=i.options.getChannel('channel',true);
      if(!channel?.isTextBased?.())throw new Error('Choose a text or announcement channel.');
      settings.setInviteLogChannel(i.guildId,channel.id);
      return i.reply({embeds:[ui.success('🎟️ Invite Report Channel',`Automatic inviter reports will now be posted in ${channel}.`)]});
    }
    if(sub==='channel-off'){
      settings.clearInviteLogChannel(i.guildId);
      return i.reply({embeds:[ui.success('🎟️ Invite Report Channel','Automatic invite reports have been disabled. Existing tracking data is preserved.')]});
    }
    const id=settings.get(i.guildId).inviteLogChannelId;
    return i.reply({embeds:[ui.embed('🎟️ Invite Report Channel',id?`Current channel: <#${id}>`:'No invite report channel is configured.')]});
  }
  const rows=invites.leaderboard(i.guildId,10);
  if(!rows.length)return i.reply({embeds:[ui.embed('🏆 Invite Leaderboard','No tracked invites yet.')]});
  const lines=rows.map((x,n)=>`${n+1}. <@${x.userId}> — **${x.invites}** active invites • ${x.joins} joins`);
  return i.reply({embeds:[ui.embed('🏆 Invite Leaderboard',lines.join('\n'))]});
}

async function crateCommand(i,n){
  const sub=i.options.getSubcommand();
  if(n==='lootbox'){
    if(sub==='open'){
      const result=crates.open(i.guildId,i.user.id,i.options.getInteger('amount')||1);
      return i.reply({embeds:[ui.success('📦 Astrix Lootbox Opened',`${crates.formatResults(result.results)}\n\n📦 Lootboxes remaining: **${result.crates}**`)]});
    }
    if(sub==='catalog')return i.reply({embeds:[ui.embed('📦 Astrix Lootbox Catalog',crates.catalogText())]});
    const data=crates.view(i.guildId,i.user.id);
    return i.reply({embeds:[ui.embed('📦 Astrix Lootbox Inventory',`Lootboxes available: **${data.crates}**\n\n${crates.catalogText()}`)]});
  }
  if(sub==='grant'){
    if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild))throw new Error('Manage Server permission is required to grant Weapon Crates.');
    const target=i.options.getUser('user',true);
    const raw=String(i.options.getString('amount',true)).trim().toLowerCase();
    const amount=raw==='all'?100:Math.floor(Number(raw));
    if(!Number.isInteger(amount)||amount<1||amount>1000)throw new Error('Amount must be a whole number from 1 to 1,000, or **all** for 100 crates.');
    const user=store.user(i.guildId,target.id);
    crates.grant(user,'weapon',amount);
    store.save();
    return i.reply({embeds:[ui.success('🧰 Weapon Crates Granted',`${target} received **${amount} Weapon Crate${amount===1?'':'s'}**.\nTheir balance is now **${user.weaponCrates}**.`)]});
  }
  if(sub==='open'){
    const result=crates.openWeapon(i.guildId,i.user.id,i.options.getInteger('amount')||1);
    return i.reply({embeds:[ui.success('🧰 Weapon Crate Opened',`${crates.formatWeaponResults(result.results)}\n\n🧰 Weapon Crates remaining: **${result.weaponCrates}**`)]});
  }
  if(sub==='catalog')return i.reply({embeds:[ui.embed('🧰 Weapon Crate Catalog',crates.weaponCatalogText())]});
  const data=crates.view(i.guildId,i.user.id);
  const owned=(crates.WEAPON_LOOT||[]).map(item=>`${item.emoji} **${item.name}** × ${Number(data.weapons[item.id]||0)} • Power ${item.power}`).join('\n');
  return i.reply({embeds:[ui.embed('🧰 Hunt Weapon Inventory',`Weapon Crates available: **${data.weaponCrates}**\n\n${owned}`)]});
}


async function settingsCommand(i){
  if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)){
    throw new Error('You need the **Manage Server** permission to change Astrix server settings.');
  }

  const sub=i.options.getSubcommand();
  if(sub==='xp-channel'){
    const channel=i.options.getChannel('channel');
    if(!channel?.isTextBased?.()) throw new Error('Choose a text or announcement channel.');
    settings.setXpChannel(i.guildId,channel.id);
    return i.reply({embeds:[ui.success('⚙️ XP Level-Up Channel',`Level-up cards will now be posted in <#${channel.id}>.\n\nOnly members with **Manage Server** can change this setting.`)]});
  }
  if(sub==='xp-channel-off'){
    settings.clearXpChannel(i.guildId);
    return i.reply({embeds:[ui.success('⚙️ XP Level-Up Channel','The dedicated XP channel has been disabled. Level-up cards will use the activity channel as fallback.')]});
  }
  if(sub==='inviter-channel'){
    const channel=i.options.getChannel('channel');
    if(!channel?.isTextBased?.()) throw new Error('Choose a text or announcement channel.');
    settings.setInviteLogChannel(i.guildId,channel.id);
    return i.reply({embeds:[ui.success('🎟️ Invite Report Channel',`Full inviter and invited-member reports will now be posted in <#${channel.id}> whenever someone joins.`)]});
  }
  if(sub==='inviter-channel-off'){
    settings.clearInviteLogChannel(i.guildId);
    return i.reply({embeds:[ui.success('🎟️ Invite Report Channel','Automatic invite reports have been turned off. Existing invite data is preserved.')]});
  }
  if(sub==='inviter-channel-view'){
    const id=settings.get(i.guildId).inviteLogChannelId;
    return i.reply({embeds:[ui.embed('🎟️ Invite Report Channel',id?`Current channel: <#${id}>`:'No invite report channel is configured.')]});
  }
  if(sub==='log-channel'){
    const channel=i.options.getChannel('channel');
    if(!channel?.isTextBased?.()) throw new Error('Choose a text or announcement channel.');
    settings.setLogChannel(i.guildId, channel.id);
    await auditLogs.ensureDashboard(i.guild);
    return i.reply({embeds:[ui.success('📋 Astrix Server Log Channel',`Server activity, moderation, voice, message, security and backup logs will be posted in ${channel}.`)]});
  }
  if(sub==='log-channel-reset'){
    settings.clearLogChannel(i.guildId);
    const dashboard=await auditLogs.ensureDashboard(i.guild);
    const channel=dashboard?.channel;
    return i.reply({embeds:[ui.success('📋 Astrix Server Log Channel',`No channel was selected. Astrix will use ${channel ? `<#${channel.id}>` : 'an automatic private **#astrix-logs** fallback'} for the single live dashboard.`)]});
  }
  if(sub==='log-channel-view'){
    const id=store.guild(i.guildId).config?.logChannelId;
    return i.reply({embeds:[ui.embed('📋 Astrix Server Log Channel',id?`Current channel: <#${id}>`:'No manual channel is configured.\nFallback: Astrix creates **#astrix-logs** when the live dashboard is first needed.')]});
  }
  if(sub==='news-channel'){
    const channel=i.options.getChannel('channel');
    if(!channel?.isTextBased?.()) throw new Error('Choose a text or announcement channel.');
    settings.setNewsChannel(i.guildId,channel.id);
    return i.reply({embeds:[ui.success('📰 Astrix News Channel',`New command and feature announcements will be posted in ${channel}.`)]});
  }
  if(sub==='news-channel-off'){
    settings.clearNewsChannel(i.guildId);
    return i.reply({embeds:[ui.success('📰 Astrix News Channel','The dedicated news channel is disabled. Astrix will use the server system channel or a suitable text channel automatically.')]});
  }
  if(sub==='news-channel-view'){
    const channelId=settings.get(i.guildId).newsChannelId;
    return i.reply({embeds:[ui.embed('📰 Astrix News Channel',channelId?`Astrix update announcements are posted in <#${channelId}>.`:'No dedicated channel is configured. Astrix will choose a fallback channel automatically.')]});
  }
  const id=settings.get(i.guildId).xpLevelupChannelId;
  return i.reply({embeds:[ui.embed('⚙️ XP Level-Up Channel',id?`Current channel: <#${id}>`:'No dedicated channel is configured.\nFallback: the channel where XP was earned.') ]});
}

async function command(i,client,routeName=null){
  const logicalName=routeName||i.commandName;
  if(routeName&&routeName!==i.commandName){
    i=new Proxy(i,{get(target,key){return key==='commandName'?logicalName:Reflect.get(target,key);}});
  }
  const ownerState=ownerService.state();
  if(ownerService.isBlacklisted(i.guildId,i.user.id))throw new Error('Access to Astrix has been restricted by the bot owner.');
  requireGuild(i);
  const n=logicalName;
  if(await privacy.guardInteraction(i))return;

  // These commands either render images or perform a large registry read.
  // They must acknowledge before the optional dashboard database sync.
  if(n==='help')return helpCenter.command(i);
  if(n==='ping')return pingCommand(i,client);
  if(n==='botstatus')return botStatusCommand(i,client);
  if(n==='classic')return classicCommand(i);
  if(legacyNames.has(n))return legacy.command(i,n);
  if(n==='xp')return xpCommand(i);

  await premium.syncUserFromDashboard(i.guildId,i.user.id);
  const u=store.user(i.guildId,i.user.id);
  if(n==='help')return helpCommand(i);if(n==='bank')return bankCommand(i,u);if(n==='autopay')return autopayCommand(i,u);if(n==='marry')return marriageCommand(i,u);if(n==='invites')return invitesCommand(i);if(n==='settings')return settingsCommand(i);if(n==='antimention')return antiMention.slash(i);if(n==='mod')return moderation.advanced(i);if(n==='warnconfig')return moderationUpgrade.warnConfig(i);if(n==='automod')return moderationUpgrade.automod(i);if(moderationExtra.EXTRA_COMMANDS.has(n))return moderationExtra.command(i,n);if(n==='muterole')return moderation.muteRole(i);if(n==='quarantine')return moderation.action(i,i.options.getSubcommand());if(n==='owner')return ownerService.command(i,client);if(n==='giveaway')return giveaway.command(i,client);if(n==='adventure')return adventure.slash(i);if(n==='prefix')return prefix.slash(i);if(n==='noprefix')return prefix.noPrefixSlash(i);if(n==='autorespond')return autorespond.command(i);if(n==='premiumcurrency')return premiumCurrency(i);if(n==='earlyaccess')return earlyAccess(i);if(n==='premiumtiers')return premiumTiers(i);if(MOD.has(n))return moderation.action(i,n);if(ROLECMDS.has(n))return roles.command(i,n);if(SECCMDS.has(n))return security.command(i,n);if(MUSIC.has(n))return music.action(i,n);if(n==='record')return recording.action(i);if(n==='ticket')return tickets.command(i,n);if(OWNER.has(n))return owner(i,n);
  if(n==='lootbox'||n==='weaponcrate')return crateCommand(i,n);
if(['hunt','fish','dig','beg','search','zoo','collection','quests','achievements'].includes(n)){
  return adventure.run({guildId:i.guildId,user:i.user,reply:p=>i.reply(p)},n==='zoo'?'collection':n);
}
if(n==='action')return fun.slash(i);
if(fun.actionNames().includes(n))return fun.slashAction(i,n);
if(n==='coinflip')return economyUpgrade.coinflipInteraction(i);
if(n==='dice')return i.reply({embeds:[ui.embed('🎲 Dice Roll',`You rolled **${1+Math.floor(Math.random()*6)}**.`)]});
if(n==='eightball'){const a=['Yes.','No.','Maybe.','Very likely.','Probably not.','Ask again later.','Signs point to yes.','I would not count on it.'];return i.reply({embeds:[ui.embed('🎱 Astrix 8-Ball',`**Question:** ${i.options.getString('question',true)}\n**Answer:** ${a[Math.floor(Math.random()*a.length)]}`)]});}
if(n==='choose'){const a=i.options.getString('options',true).split(',').map(x=>x.trim()).filter(Boolean).slice(0,20);if(a.length<2)throw new Error('Give me at least two choices separated by commas.');return i.reply({embeds:[ui.embed('🤔 Astrix Chooses',`I choose: **${a[Math.floor(Math.random()*a.length)]}**`)]});}
if(n==='rate'){const thing=i.options.getString('thing',true),score=Math.floor(Math.random()*101);return i.reply({embeds:[ui.embed('⭐ Astrix Rating',`**${thing}** → **${score}/100**\nJust a random fun rating 😄`)]});}
if(n==='iq'){const t=i.options.getUser('user')||i.user,score=70+Math.floor(Math.random()*91);return i.reply({embeds:[ui.embed('🧠 Fun IQ Generator',`${t} rolled **${score} IQ**.\n*This is only a random joke result, not a real IQ test.*`)]});}
if(n==='joke'){const a=['Why did the computer get cold? It left its Windows open.','Why was the math book worried? It had too many problems.','Why did the robot go on vacation? It needed to recharge.','What do you call a sleeping bull? A bulldozer.'];return i.reply({embeds:[ui.embed('😂 Astrix Joke',a[Math.floor(Math.random()*a.length)])]});}
if(n==='fact'){const a=['Octopuses have three hearts.','A day on Venus is longer than a year on Venus.','Honey can remain edible for a very long time when stored properly.','Bananas are berries botanically, while strawberries are not.'];return i.reply({embeds:[ui.embed('🧩 Random Fact',a[Math.floor(Math.random()*a.length)])]});}
if(n==='reverse'){const x=i.options.getString('text',true);return i.reply({embeds:[ui.embed('🔄 Reversed Text',x.split('').reverse().join('').slice(0,4000))]});}
if(n==='mock'){const x=i.options.getString('text',true);let k=0;const out=[...x].map(c=>/[a-z]/i.test(c)?(k++%2?c.toUpperCase():c.toLowerCase()):c).join('');return i.reply({embeds:[ui.embed('😜 Mock Text',out.slice(0,4000))]});}
if(n==='randomnumber'){const min=i.options.getInteger('min',true),max=i.options.getInteger('max',true);if(min>max)throw new Error('Minimum cannot be greater than maximum.');const x=Math.floor(Math.random()*(max-min+1))+min;return i.reply({embeds:[ui.embed('🔢 Random Number',`Between **${min}** and **${max}** → **${x}**`)]});}
if(n==='ship'){const a=i.options.getUser('user1',true),b=i.options.getUser('user2')||i.user;const key=[a.id,b.id].sort().join('');let h=0;for(const c of key)h=(h*31+c.charCodeAt(0))>>>0;const score=h%101;return i.reply({embeds:[ui.embed('💫 Friendship Compatibility',`${a} + ${b}\n**${score}% compatibility** ✨\n*Just for fun.*`)]});}
if(n==='wallet'){const target=i.options.getUser('user')||i.user,t=store.user(i.guildId,target.id);try{const m=await i.guild.members.fetch(target.id);const buf=await cards.walletCard(m,t);return i.reply({files:[new AttachmentBuilder(buf,{name:'astrix-wallet.png'})]});}catch{const net=Number(t.wallet||0)+Number(t.bank||0);return i.reply({embeds:[ui.embed(`👛 ${target.username}'s Wallet`,`💵 Cash: **${Number(t.wallet||0).toLocaleString()} / ${Number(t.walletLimit||0).toLocaleString()}**
🏦 Bank: **${Number(t.bank||0).toLocaleString()} / ${Number(t.bankLimit||0).toLocaleString()}**
💰 Net Worth: **${net.toLocaleString()} coins**`)]});}}
if(n==='balance'){const target=i.options.getUser('user')||i.user,t=store.user(i.guildId,target.id),net=Number(t.wallet||0)+Number(t.bank||0),bankPct=Math.max(0,Math.min(100,Math.round((Number(t.bank||0)/Math.max(1,Number(t.bankLimit||1)))*100))),filled=Math.round(bankPct/10),bar='▰'.repeat(filled)+'▱'.repeat(10-filled),job=jobs.getJob(t.job);const e=ui.embed(`💳 ${target.username}'s Balance`,`**Wallet**
⏣ **${Number(t.wallet||0).toLocaleString()}**

**Bank**
⏣ **${Number(t.bank||0).toLocaleString()} / ${Number(t.bankLimit||0).toLocaleString()}**
${bar} **${bankPct}%**

**Net Worth**
⏣ **${net.toLocaleString()}**`).setThumbnail(target.displayAvatarURL({size:256})).addFields({name:'💎 Astrix Gems',value:Number(t.premiumGems||0).toLocaleString(),inline:true},{name:'💳 Credit Score',value:String(t.creditScore||650),inline:true},{name:'💼 Career',value:job?`${job.emoji} ${job.name}`:'Unemployed',inline:true}).setFooter({text:'Astrix Economy • Use /deposit, /withdraw, /pay and /shop'});return i.reply({embeds:[e]});}
if(n==='profile'){const target=i.options.getUser('user')||i.user,m=await i.guild.members.fetch(target.id),t=store.user(i.guildId,target.id);try{let spouseName=null;
try{if(t.marriage?.partnerId){const spouse=await i.guild.members.fetch(t.marriage.partnerId);spouseName=spouse.displayName;}}catch{}
const buf=await cards.profileCard(m,t,spouseName);return i.reply({files:[new AttachmentBuilder(buf,{name:'astrix-profile.png'})]});}catch{return i.reply({embeds:[ui.embed(`👤 ${target.username} • Astrix Profile`,`Level: **${t.level}** • XP: **${t.xp}**\nWallet: **${econ.fmt(t.wallet)} / ${econ.fmt(t.walletLimit)}** • Bank: **${econ.fmt(t.bank)} / ${econ.fmt(t.bankLimit)}**\nJob: **${jobs.getJob(t.job)?.name||'None'}** • Shifts: **${t.shifts||0}**\nCredit score: **${t.creditScore}**`).setThumbnail(target.displayAvatarURL())]});}}
if(n==='daily'||n==='weekly'){const ms=n==='daily'?86400000:604800000,rem=econ.cooldown(u,n,ms);if(rem)throw new Error(`Your ${n} reward is ready <t:${Math.floor((Date.now()+rem)/1000)}:R>.`);const got=await econ.reward(i,n==='daily'?1200:8000,n==='daily'?80:400);return i.reply({embeds:[ui.success(`${n==='daily'?'Daily':'Weekly'} Reward`,`You received **${econ.fmt(got.coins)}** and **${got.xp} XP**.${rewardCapacityNote(got)}`)]});}
if(n==='deposit'||n==='withdraw'){const amt=i.options.getInteger('amount',true);if(n==='deposit'){if(u.wallet<amt)throw new Error('Not enough wallet coins.');if(econ.bankSpace(u)<amt)throw new Error(`Your bank only has ${econ.bankSpace(u).toLocaleString()} coins of free capacity. Use a Bank Limit Coupon to increase it.`);u.wallet-=amt;u.bank+=amt;}else{if(u.bank<amt)throw new Error('Not enough bank coins.');if(econ.walletSpace(u)<amt)throw new Error(`Your wallet only has ${econ.walletSpace(u).toLocaleString()} coins of free capacity. Use a Wallet Limit Coupon to increase it.`);u.bank-=amt;u.wallet+=amt;}store.save();return i.reply({embeds:[ui.success('Bank Transfer',`${n==='deposit'?'Deposited':'Withdrew'} **${econ.fmt(amt)}**.\n${econ.limitText(u)}`)]});}
if(n==='pay'){const t=i.options.getUser('user',true),amt=i.options.getInteger('amount',true);if(t.bot||t.id===i.user.id)throw new Error('Choose another non-bot user.');if(u.wallet<amt)throw new Error('Not enough wallet coins.');const target=store.user(i.guildId,t.id);if(econ.walletSpace(target)<amt)throw new Error(`${t.username}'s wallet does not have enough free capacity for this payment.`);u.wallet-=amt;target.wallet+=amt;store.save();return i.reply({embeds:[ui.success('Payment Sent',`Sent **${econ.fmt(amt)}** to ${t}.`)]});}
if(n==='leaderboard'){const rows=Object.entries(store.allUsers(i.guildId)).sort((a,b)=>(b[1].wallet+b[1].bank)-(a[1].wallet+a[1].bank)).slice(0,10).map(([id,x],idx)=>`**${idx+1}.** <@${id}> — ${econ.fmt(x.wallet+x.bank)}`);return i.reply({embeds:[ui.embed('🏆 Economy Leaderboard',rows.join('\n')||'No economy data yet.')]});}
if(n==='inventory'){const t=i.options.getUser('user')||i.user,x=store.user(i.guildId,t.id),rows=Object.entries(x.inventory||{}).filter(([,q])=>Number(q)>0).map(([id,q])=>{const item=shop.catalogItem(id);return `• ${item?.emoji||'📦'} **${item?.name||id}** × ${q}`;});const protection=`🔒 Active Locks: **${Number(x.robLockCharges||0)}/3**${x.robMine?'\\n💣 **Armed Mine:** waiting for the next rob attempt':''}`;const crateText=`📦 **Astrix Crates:** ${Number(x.crates||0)}\nUse \`/use\` to choose an owned item.`;const e=ui.premiumEmbed(`🎒 ${t.username}'s Inventory`,`${crateText}\n${protection}\n\n${rows.join('\n')||'Inventory is empty.'}`);e.addFields({name:'💰 Wallet',value:`⏣ ${econ.fmt(x.wallet)} / ${econ.fmt(x.walletLimit)}`,inline:true},{name:'🏦 Bank',value:`⏣ ${econ.fmt(x.bank)} / ${econ.fmt(x.bankLimit)}`,inline:true},{name:'💎 Gems',value:Number(x.premiumGems||0).toLocaleString(),inline:true});return i.reply({embeds:[e]});}
if(n==='use'){const item=i.options.getString('item'),target=i.options.getUser('target');if(!item){const owned=Object.entries(u.inventory||{}).filter(([,qty])=>Number(qty)>0).map(([id,qty])=>{const item=shop.catalogItem(id);return `• ${item?.emoji||'📦'} **${item?.name||id}** × ${qty}`;}).join('\n');return i.reply({embeds:[ui.embed('🎒 Items You Own',`📦 **Astrix Crates:** ${Number(u.crates||0)}\n${owned||'You do not own any shop items yet.'}\n\nChoose an item from the **item** menu to use it.`)]});}if(item==='astrix_crate'||item==='crate'||item==='crates'){const result=require('./services/crates.ts').open(i.guildId,i.user.id,1);return i.reply({embeds:[ui.success('📦 Astrix Crate Opened',`${require('./services/crates.ts').formatResults(result.results)}\n\n📦 Crates remaining: **${result.crates}**`)]});}const r=shop.use(i,item,target);return i.reply({embeds:[ui.success('Item Used',r.text)]});}
if(n==='rob'){const target=i.options.getUser('user',true);if(target.bot)throw new Error('You cannot rob a bot.');const result=robService.rob(i.guildId,i.user.id,target.id);if(result.protected&&result.protection==='lock')return i.reply({embeds:[ui.error('🔒 Rob Failed',`<@${target.id}> manually activated a **Lock**.\n\nYour robbery was blocked. Active Locks remaining: **${result.locksRemaining}/3**`)]});if(result.protected&&result.protection==='mine')return i.reply({embeds:[ui.error('💣 BOOM! Rob Failed',`The manually planted Mine on <@${target.id}> exploded!\n\nYou paid **${econ.fmt(result.fine)}** to <@${target.id}>. The Mine was consumed.`)]});if(result.success)return i.reply({embeds:[ui.success('💰 Rob Successful',`🕵️‍♂️ You moved like a shadow and stole **${econ.fmt(result.amount)}** from <@${target.id}>.\n\nThe getaway car is already halfway across Astrix.`)]});const jokes=[`🚓 The security guard recognized your shoes. **${econ.fmt(result.fine)}** was transferred to <@${target.id}> as a failed-rob penalty.`,`🦆 You tried to rob <@${target.id}> but a duck witnessed everything. **${econ.fmt(result.fine)}** went to them.`,`🤡 Plot twist: you robbed yourself. **${econ.fmt(result.fine)}** was sent to <@${target.id}>.`];return i.reply({embeds:[ui.error('🚨 Rob Failed',`${jokes[Math.floor(Math.random()*jokes.length)]}\n\n⏱️ Rob cooldown: **15 minutes**.`)]});}
if(n==='sell'){const r=shop.sell(i,i.options.getString('item',true),i.options.getInteger('quantity')||1);return i.reply({embeds:[ui.success('Item Sold',`Sold **${r.qty}× ${r.item.name}** for **${econ.fmt(r.value)}**.`)]});}
if(n==='work')return workCommand(i,u);
if(n==='jobs')return i.reply({embeds:[jobsEmbed(u,1)]});
if(n==='applyjob'){const j=jobs.apply(u,i.options.getString('job',true));return i.reply({embeds:[ui.success('Job Application Approved',`You are now working as **${j.emoji} ${j.name}**.`)]});}
if(n==='shift')return shiftAction(i,'start');
if(n==='career')return i.reply({embeds:[careerEmbed(u)]});
if(n==='loan')return loan(i,u);
if(n==='credit')return i.reply({embeds:[creditEmbed(u)]});
if(n==='repay')return repay(i,u);
 if(n==='shop')return sendShopPanel(i,'buy',0);
if(n==='buy'){const r=shop.buy(i,i.options.getString('item',true),i.options.getInteger('quantity')||1);const extra=r.instant?`\n✨ Instant XP: **+${r.instant.xp.toLocaleString()}**${r.instant.levels.length?`\nLevel ups: **${r.instant.levels.join(', ')}**`:''}`:'';const discount=r.pricing.discount?`\nPremium discount: **${r.pricing.discount}%**`:'';return i.reply({embeds:[ui.success('Purchase Complete',`Bought **${r.qty}× ${r.item.name}** for **${econ.fmt(r.cost)}**.${discount}${extra}\nPaid from wallet: **${econ.fmt(r.debit.walletSpent)}** • bank: **${econ.fmt(r.debit.bankSpent)}**`)]});}
 if(n==='premium')return i.reply(premiumPanel(i));
if(['ai','ask','translate','rewrite','summarize','generate','aiusage'].includes(n))return aiCommand(i,n);
if(n==='liveleaderboard')return liveLeaderboardCommand(i);
if(n==='serverinfo'){
  const g=i.guild,config=store.guild(i.guildId).config||{},tier=premium.tierFor(i.guildId,i.user.id,g);
  const owner=g.ownerId?`<@${g.ownerId}>`:'Unknown';
  const humans=g.members.cache.filter(m=>!m.user.bot).size,bots=g.members.cache.filter(m=>m.user.bot).size;
  const text=`**${g.name}**\n\n**Identity**\nID: \`${g.id}\`\nOwner: ${owner}\nVerification: **${String(g.verificationLevel||'unknown').replace(/_/g,' ')}**\nCreated: <t:${Math.floor(g.createdTimestamp/1000)}:F> (<t:${Math.floor(g.createdTimestamp/1000)}:R>)\n\n**Members**\nTotal: **${g.memberCount||0}** • Humans: **${humans}** • Bots: **${bots}**\n\n**Channels & Roles**\nChannels: **${g.channels.cache.size}**\nText: **${g.channels.cache.filter(c=>c.isTextBased?.()).size}** • Voice: **${g.channels.cache.filter(c=>c.isVoiceBased?.()).size}**\nRoles: **${Math.max(0,g.roles.cache.size-1)}**\nEmojis: **${g.emojis.cache.size}** • Boosts: **${g.premiumSubscriptionCount||0}** (Level ${g.premiumTier||0})\n\n**Astrix**\nServer Premium: **${premium.tierName(config.serverPremiumTier||'free')}**\nYour effective tier: **${premium.tierName(tier)}**\nPrefix: \`${config.prefix||'/'}\`\nAstrix version: **v${ASTRIX_VERSION}**`;
  const e=ui.embed('🖥️ Complete Server Information',text);
  const icon=g.iconURL?.({size:256}); if(icon)e.setThumbnail(icon);
  return i.reply({embeds:[e]});
}
if(n==='userinfo'){const t=i.options.getUser('user')||i.user,m=await i.guild.members.fetch(t.id);return i.reply({embeds:[ui.embed('👤 User Information',`${t}\nID: **${t.id}**\nJoined: <t:${Math.floor(m.joinedTimestamp/1000)}:R>\nCreated: <t:${Math.floor(t.createdTimestamp/1000)}:D>\nRoles: **${Math.max(0,m.roles.cache.size-1)}**`).setThumbnail(t.displayAvatarURL())]});}
if(n==='avatar'){const t=i.options.getUser('user')||i.user;return i.reply({embeds:[ui.embed(`Avatar • ${t.username}`,'').setImage(t.displayAvatarURL({size:1024}))]});}
if(n==='roleinfo'){const r=i.options.getRole('role',true);return i.reply({embeds:[ui.embed(`Role • ${r.name}`,`ID: **${r.id}**\nMembers: **${r.members.size}**\nPosition: **${r.position}**\nMentionable: **${r.mentionable}**`)]});}
if(n==='botinfo')return i.reply({embeds:[ui.embed('🤖 Astrix',`Build: **v${ASTRIX_VERSION}**\nGlobal slash command slots: **100**\nWork careers: **${jobs.jobs.length}**\nWork mini-jobs: **${jobs.miniJobs.length.toLocaleString()}**\nAdvanced moderation actions: **55**\nServers: **${client.guilds.cache.size}**\nNode: **${process.version}**\nMemory: **${Math.round(process.memoryUsage().rss/1024/1024)} MB**`)]});
if(n==='uptime')return i.reply({embeds:[ui.embed('⏱️ Uptime',ui.formatDuration(process.uptime()*1000))]});
if(n==='membercount')return i.reply({embeds:[ui.embed('👥 Member Count',`Total: **${i.guild.memberCount}**\nHumans: **${i.guild.members.cache.filter(m=>!m.user.bot).size}**\nBots: **${i.guild.members.cache.filter(m=>m.user.bot).size}**`)]});
if(n==='rps'){const c=i.options.getString('choice',true),vals=['rock','paper','scissors'],b=vals[Math.floor(Math.random()*3)],win=(c==='rock'&&b==='scissors')||(c==='paper'&&b==='rock')||(c==='scissors'&&b==='paper'),draw=c===b;let got=null;if(win)got=await econ.reward(i,150,15);return i.reply({embeds:[ui.embed('Rock Paper Scissors',`You: **${c}**\nAstrix: **${b}**\nResult: **${draw?'Draw':win?`You win! +${got.coins} coins +${got.xp} XP${rewardCapacityNote(got)}`:'Astrix wins'}**`)]});}
if(n==='trivia')return trivia(i);
if(n==='8ball'){const a=['Yes.','No.','Very likely.','Probably not.','Ask again later.','The signs look good.','I would not count on it.'];return i.reply({embeds:[ui.embed('🎱 Astrix 8-Ball',`**Question:** ${i.options.getString('question',true)}\n**Answer:** ${a[Math.floor(Math.random()*a.length)]}`)]});}
}
function jobsEmbed(u,page=1){
  const x=jobs.list(u,page,4);
  const current=jobs.getJob(u.job);
  const lines=x.items.map(j=>[
    `${jobs.eligible(u,j)?'✅':'❌'} **${j.emoji} ${j.name}**`,
    `╰┈➤ Shifts Required Per Day: \`${j.shiftsRequiredPerDay||0}\``,
    `╰┈➤ Time Between Shifts: \`${Math.round(j.cooldownMinutes||15)}m\``,
    `╰┈➤ Total Shifts Required To Unlock: \`${j.minShifts||0}\``,
    `╰┈➤ Salary: ⏣ \`${Number(j.salary||j.salaryMax||0).toLocaleString()} per shift\``,
    `╰┈➤ Status: ${current?.id===j.id?'**Current career**':jobs.eligible(u,j)?'**Unlocked — ready to apply**':'**Locked**'}`
  ].join('\n')).join('\n\n');
  return ui.embed('Available Jobs',`Jobs with ❌ next to them are locked.\n\n${lines||'No careers are configured yet.'}\n\n**Page ${x.page} of ${x.pages}**\n\n${tips.work()}`)
    .setFooter({text:`${jobs.jobs.length} jobs • Apply with /work apply • Start with /work shift`});
}
function careerEmbed(u){jobs.normalizeDaily(u);const j=jobs.getJob(u.job),up=jobs.upcoming(u,5);return ui.embed('📈 Career Progress',`${j?`Current job: **${j.emoji} ${j.name}**\nDifficulty: **${j.difficulty}**\nSalary: **${Number(j.salaryMin).toLocaleString()}–${Number(j.salaryMax).toLocaleString()} coins**\nDaily shifts: **${u.shiftsToday||0}/${j.shiftsRequiredPerDay}**`:'Current job: **Unemployed** — use **/work apply**'}\n\nCompleted shifts: **${u.shifts||0}**\nWork XP: **${u.workXp||0}**\nReputation: **${u.workReputation||0}**\nStreak: **${u.workStreak||0}** • Best **${u.bestWorkStreak||0}**\n\n**Next career unlocks**\n${up.map(x=>`🔒 ${x.emoji} **${x.name}** — L${x.minLevel}, ${x.minShifts} shifts`).join('\n')||'🏆 All careers unlocked.'}`)}
function workStatsEmbed(target,u){jobs.normalizeDaily(u);const j=jobs.getJob(u.job),total=(u.successfulShifts||0)+(u.failedShifts||0),rate=total?Math.round((u.successfulShifts||0)/total*100):0;return ui.embed(`💼 ${target.username}'s Work Stats`,`${j?`Career: **${j.emoji} ${j.name}**`:'Career: **Unemployed**'}\nCompleted shifts: **${u.shifts||0}**\nSuccessful: **${u.successfulShifts||0}** • Failed: **${u.failedShifts||0}**\nSuccess rate: **${rate}%**\nToday: **${u.shiftsToday||0}${j?`/${j.shiftsRequiredPerDay}`:''} shifts**\nTotal earnings: **${econ.fmt(u.totalWorkEarnings||0)}**\nWork XP: **${u.workXp||0}**\nReputation: **${u.workReputation||0}**\nCurrent streak: **${u.workStreak||0}** • Best: **${u.bestWorkStreak||0}**\nDM ready alerts: **${u.workDmEnabled===false?'Off':'On'}**`)}
function workPanel(i,u){jobs.normalizeDaily(u);const j=jobs.getJob(u.job),remaining=Math.max(0,Number(u.shiftCooldownUntil||0)-Date.now());return{embeds:[ui.premiumEmbed('💼 Astrix Work V3',`${j?`Career: **${j.emoji} ${j.name}**\nSalary: **${Number(j.salaryMin).toLocaleString()}–${Number(j.salaryMax).toLocaleString()} coins**\nDaily shifts: **${u.shiftsToday||0}/${j.shiftsRequiredPerDay}**`:'You are **unemployed**. Use **/work apply** to choose a career.'}\n\nCompleted shifts: **${u.shifts||0}**\n${u.shift?'🟠 **Mini-job active**':remaining?`⏳ Next shift <t:${Math.floor(u.shiftCooldownUntil/1000)}:R>`:'🟢 **Ready for a shift**'}\n\n**${jobs.jobs.length}+ careers • ${jobs.miniJobs.length.toLocaleString()} mini-job challenges • 15m shift cooldown**`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`work:shift:${i.user.id}`).setLabel('Start Shift').setStyle(ButtonStyle.Success).setDisabled(!j||Boolean(remaining)||Boolean(u.shift)),new ButtonBuilder().setCustomId(`work:list:${i.user.id}:1`).setLabel('Jobs').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId(`work:stats:${i.user.id}`).setLabel('Stats').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId(`work:career:${i.user.id}`).setLabel('Career').setStyle(ButtonStyle.Secondary))]};}
function workListPayload(i,u,page=1){
  const x=jobs.list(u,page,4);
  const rows=[];
  const applyOptions=x.items.slice(0,25).map(j=>({
    label:`${jobs.eligible(u,j)?'Apply':'Locked'} • ${j.name}`.slice(0,100),
    value:j.id,
    description:(jobs.eligible(u,j)?'Switch to this unlocked career.':`Level ${j.minLevel}, ${j.minShifts} shifts required.`).slice(0,100),
    emoji:jobs.eligible(u,j)?'✅':'🔒',
    default:u.job===j.id
  }));
  if(applyOptions.length)rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`workapply:${i.user.id}`)
      .setPlaceholder('Select a career to apply')
      .addOptions(applyOptions)
  ));
  const row=new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`worklist:${i.user.id}:1`).setEmoji('⏪').setStyle(ButtonStyle.Primary).setDisabled(x.page<=1),
    new ButtonBuilder().setCustomId(`worklist:${i.user.id}:${Math.max(1,x.page-1)}`).setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(x.page<=1),
    new ButtonBuilder().setCustomId(`worklist:${i.user.id}:${Math.min(x.pages,x.page+1)}`).setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(x.page>=x.pages),
    new ButtonBuilder().setCustomId(`worklist:${i.user.id}:${x.pages}`).setEmoji('⏩').setStyle(ButtonStyle.Primary).setDisabled(x.page>=x.pages)
  );
  rows.push(row);
  return{embeds:[jobsEmbed(u,x.page)],components:rows};
}
async function workCommand(i,u){
  const sub=i.options.getSubcommand();
  if(sub==='list')return i.reply(workListPayload(i,u,i.options.getInteger('page')||1));
  if(sub==='apply'){
    const job=jobs.apply(u,i.options.getString('job',true));
    return i.reply({embeds:[ui.success('Job Application Approved',`You are now working as **${job.emoji} ${job.name}**.\n\nSalary: **${Number(job.salaryMin||job.salary||0).toLocaleString()}–${Number(job.salaryMax||job.salary||0).toLocaleString()} coins per shift\nRequired shifts per day: **${job.shiftsRequiredPerDay||0}**\n\nUse **/work shift** when you are ready.`)]});
  }
  if(sub==='shift')return shiftAction(i,'start');
  if(sub==='resign'){
    if(!i.options.getBoolean('confirm',true))throw new Error('Set **confirm:true** to continue.');
    const old=jobs.resign(u);
    return i.reply({embeds:[ui.embed('📤 Resigned Successfully',`You resigned from **${old?.emoji||'💼'} ${old?.name||'your career'}**.\n\nYour completed shifts, XP, reputation, earnings and history were preserved.\nUse **/work list** to choose another unlocked career.`)]});
  }
  if(sub==='stats'){
    const target=i.options.getUser('user')||i.user;
    const targetUser=store.user(i.guildId,target.id);
    return i.reply({embeds:[workStatsEmbed(target,targetUser)]});
  }
  if(sub==='history'){
    const page=i.options.getInteger('page')||1;
    const h=jobs.history(u,page,8);
    const lines=h.items.map((x,n)=>`${(h.page-1)*8+n+1}. **${x.jobName||x.jobId||'Work shift'}** — ${x.correct?'✅':'❌'} **${x.grade||'Result'}** • ⏣ **${econ.fmt(x.coins||0)}** • ${x.xp||0} XP\n<t:${Math.floor(Number(x.at||Date.now())/1000)}:R>`).join('\n\n');
    return i.reply({embeds:[ui.embed('🧾 Work History',`${lines||'No completed shifts yet.'}\n\n**Page ${h.page} of ${h.pages}**`).setFooter({text:'Use /work stats for your complete performance summary.'})]});
  }
  if(sub==='career')return i.reply({embeds:[careerEmbed(u)]});
  if(sub==='tips')return i.reply({embeds:[ui.embed('💡 Work Tips',tips.workAll().join('\n'))]});
  throw new Error('Use **/work list** to browse jobs or **/work shift** to work.');
}
async function shiftAction(i,a){const u=store.user(i.guildId,i.user.id);if(a==='start'){const x=jobs.start(u),task=x.shift.task,row=new ActionRowBuilder();task.options.forEach((opt,idx)=>row.addComponents(new ButtonBuilder().setCustomId(`worktask:${i.user.id}:${x.shift.token}:${idx}`).setLabel(String(opt).slice(0,80)).setStyle(ButtonStyle.Primary)));return i.reply({embeds:[ui.premiumEmbed('💼 Work Mini-Job',`${task.prompt}\n\nDifficulty: **${x.job.difficulty}**\nPossible salary: **${Number(x.job.salaryMin).toLocaleString()}–${Number(x.job.salaryMax).toLocaleString()} coins**\n\nChoose the correct answer. Faster correct answers can earn a **Perfect** result.`)],components:[row]});}return i.reply({embeds:[careerEmbed(u)]});}
function shopItemPayload(i,view,mode,entry,index){
  const item=entry.item;
  const price=mode==='sell'?entry.sellPrice:entry.price;
  const quantity=mode==='sell'?entry.qty:entry.stock;
  const e=ui.embed(`${item.emoji||'📦'} Astrix Market`,[
    `**${index+1}. ${item.name}**`,
    '',
    `**${mode==='sell'?'Sell for':'Buy for'}** ⏣ **${Number(price||0).toLocaleString()}** each`,
    `**${mode==='sell'?'Owned':'Stock'}:** ${Number(quantity||0).toLocaleString()}`,
    '',
    String(item.description||'').slice(0,500),
    '',
    `Level: **${view.user.level}** • Wallet: **${econ.fmt(view.user.wallet)}** • Bank: **${econ.fmt(view.user.bank)}**`
  ].join('\n')).setFooter({text:`Page ${view.page+1}/${view.pages} • Astrix Market`});
  return {
    embeds:[e],
    components:[new ActionRowBuilder().addComponents(new ButtonBuilder()
      .setCustomId(`shop:item:${mode}:${i.user.id}:${item.id}:${view.page}`)
      .setLabel(mode==='sell'?'Sell':'Accept')
      .setStyle(ButtonStyle.Success)
      .setDisabled(mode==='buy'&&Number(entry.stock||0)<1))]
  };
}
function shopControlPayload(i,view,mode){
  const next=view.nextLocked?`\n🔒 Next unlock: **${view.nextLocked.emoji} ${view.nextLocked.name}** at **Level ${view.nextLocked.minLevel}**.`:'';
  const note=view.discount
    ? `${premium.tierName(view.tier)} benefits detected — automatic discount: **${view.discount}%**.`
    : 'Premium benefits are applied automatically in this shared market.';
  const e=ui.embed('🛍️ Astrix Market',[
    `**${mode==='sell'?'Selling':'Buying'} • Page ${view.page+1}/${view.pages} • ${view.total} items**`,
    `Level: **${view.user.level}** • Wallet: **${econ.fmt(view.user.wallet)}** • Bank: **${econ.fmt(view.user.bank)}**`,
    note,next,'',
    tips.shop()
  ].join('\n')).setFooter({text:`Live stock • Refreshes every ${Number(process.env.SHOP_REFRESH_MINUTES||120)} minutes`});
  return {embeds:[e],components:[
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop:mode:buy:${i.user.id}:0`).setLabel('Buying').setStyle(mode==='buy'?ButtonStyle.Primary:ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop:mode:sell:${i.user.id}:0`).setLabel('Selling').setStyle(mode==='sell'?ButtonStyle.Primary:ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop:fairness:${i.user.id}`).setLabel('Fairness').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop:inventory:${i.user.id}`).setLabel('Inventory').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop:nav:first:${i.user.id}:${mode}:0`).setEmoji('⏪').setStyle(ButtonStyle.Secondary).setDisabled(view.page===0),
      new ButtonBuilder().setCustomId(`shop:nav:prev:${i.user.id}:${mode}:${Math.max(0,view.page-1)}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(view.page===0),
      new ButtonBuilder().setCustomId(`shop:nav:refresh:${i.user.id}:${mode}:${view.page}`).setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop:nav:next:${i.user.id}:${mode}:${Math.min(view.pages-1,view.page+1)}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(view.page>=view.pages-1),
      new ButtonBuilder().setCustomId(`shop:nav:last:${i.user.id}:${mode}:${view.pages-1}`).setEmoji('⏩').setStyle(ButtonStyle.Secondary).setDisabled(view.page>=view.pages-1)
    )
  ]};
}
function shopPayloads(i,mode='buy',page=0){
  const view=shop.browse(i,mode,page,4);
  const payloads=view.items.map((entry,index)=>shopItemPayload(i,view,mode,entry,index));
  if(!payloads.length)payloads.push({embeds:[ui.embed('🛍️ Astrix Market',mode==='sell'?'You have no sellable inventory items.':'No items are unlocked yet.')],components:[]});
  payloads.push(shopControlPayload(i,view,mode));
  return payloads;
}
async function sendShopPanel(i,mode='buy',page=0,update=false,followOnly=false){
  const payloads=shopPayloads(i,mode,page);
  if(followOnly){for(const payload of payloads)await i.followUp(payload);return;}
  if(update)await i.update(payloads.shift());
  else await i.reply(payloads.shift());
  for(const payload of payloads)await i.followUp(payload);
}

function premiumPanel(i){
  const p=premium.isPremium(i),u=store.user(i.guildId,i.user.id),tier=premium.tierFor(i.guildId,i.user.id,i.guild),discount=shop.discountPercent(i);
  const rows=[...topgg.voteComponents(), new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:mode:buy:${i.user.id}:0`).setLabel('Open Shop').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ai:usage:${i.user.id}`).setLabel('AI Limits').setStyle(ButtonStyle.Secondary)
  )];
  const support=ui.supportUrl();
  if(support)rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('💎 Get Premium').setStyle(ButtonStyle.Link).setURL(support)));
  return{embeds:[ui.premiumEmbed('Astrix Premium',[
    p?'✅ **ACTIVE**':'🔒 **FREE PLAN**',
    `Tier: **${premium.tierName(tier)}**`,
    `Astrix Gems: **💎 ${Number(u.premiumGems||0).toLocaleString()}**`,
    `Early Access: **${u.earlyAccess?'Enabled':'Not enabled'}**`,
    `Economy multiplier: **${premium.multiplier(i)}×**`,
    `AI limits: **${p?'Expanded':'Standard'}**`,
    `Automatic /shop discount: **${discount}%**`,
    '**One shared /shop for every user — Premium benefits are applied automatically.**',
    `Manual premium: **${u.premiumPermanent?'Permanent':u.premiumUntil>Date.now()?`until <t:${Math.floor(u.premiumUntil/1000)}:D>`:'No'}**`
  ].join('\n'))],components:rows};
}

async function aiCommand(i,n){
  if(n==='ai'){
    const sub=i.options.getSubcommand(false);
    if(sub==='set'){
      if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to set the Astrix AI channel.');
      const channel=i.options.getChannel('channel',true);
      if(!channel?.isTextBased?.()) throw new Error('Choose a text or announcement channel.');
      settings.setAiChannel(i.guildId,channel.id);
      return i.reply({embeds:[ui.success('✨ Astrix AI Channel',`Astrix AI will now reply in <#${channel.id}>.\n\nIf someone uses AI in another channel, Astrix will tell them to use <#${channel.id}>.`)]});
    }
    if(sub==='off'){
      if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required to change the Astrix AI channel.');
      settings.clearAiChannel(i.guildId);
      return i.reply({embeds:[ui.success('✨ Astrix AI Channel','The channel restriction is off. Astrix AI can now be used in any server channel.')]});
    }
    const channelId=settings.get(i.guildId).aiChannelId;
    return i.reply({embeds:[ui.embed('✨ Astrix AI Channel',channelId
      ? `Astrix AI is restricted to <#${channelId}>.`
      : 'No AI channel is set. Astrix AI can be used in any server channel.')]});
  }
  const aiChannelId=settings.get(i.guildId).aiChannelId;
  if(aiChannelId && i.channelId!==aiChannelId) throw new Error(`Astrix AI is set to <#${aiChannelId}>. Please use AI there.`);
  if(n==='aiusage'){
    const lim=ai.limits(i),x=ai.resetDay(store.user(i.guildId,i.user.id));
    store.save();
    return i.reply({embeds:[ui.premiumEmbed('AI Usage',`Ask/Text: **${x.usage.ask||0}/${lim.ask}**
Translate: **${x.usage.translate||0}/${lim.translate}**
Images: **${x.usage.image||0}/${lim.image}**
Image cooldown: **${ui.formatDuration(lim.imageCooldown)}**
Daily reset: **00:00 UTC**`)]});
  }

  if(n==='ask'){
    const prompt=i.options.getString('prompt',true);
    const local=ai.localIdentityResponse(prompt,{
      userId:i.user.id,
      userName:i.user.globalName||i.user.username
    });
    if(local) return i.reply({content:local});
  }

  const type=n==='translate'?'translate':'ask';
  const ctx=ai.check(i,type);
  await i.deferReply();
  try{
    let prompt='';
    if(n==='ask')prompt=i.options.getString('prompt',true);
    if(n==='translate')prompt=`Translate the following text into ${i.options.getString('language',true)}. Return only the translation unless a short clarification is necessary:

${i.options.getString('text',true)}`;
    if(n==='rewrite')prompt=`Rewrite the following text${i.options.getString('style')?` in a ${i.options.getString('style')} style`:''}:

${i.options.getString('text',true)}`;
    if(n==='summarize')prompt=`Summarize this text clearly:

${i.options.getString('text',true)}`;
    if(n==='generate')prompt=i.options.getString('prompt',true);
    const imageAttachment=n==='ask'?i.options.getAttachment('image'):null;
    const aiOptions={userId:i.user.id,userName:i.user.globalName||i.user.username,guildId:i.guildId,guild:i.guild};
    const out=imageAttachment&&String(imageAttachment.contentType||'').startsWith('image/')
      ?await ai.visionRequest(prompt,imageAttachment.url,aiOptions)
      :await ai.textRequest(prompt,aiOptions);
    ai.commit(ctx);
    const visual=ai.renderGuildVisuals(out,i.guild);
    return ui.editReplyLong(i,visual.content,{...(visual.stickers.length?{stickers:visual.stickers}:{}),allowedMentions:{parse:[]}});
  }catch(e){
    return i.editReply({content:`Astrix AI could not complete that request.\n${ai.friendlyAIError(e)}`,components:ui.supportComponents('Report Issue')});
  }
}
async function premiumTiers(i){return i.reply({embeds:[ui.premiumEmbed('💎 Astrix Premium Tiers','**Premium** — 500 Astrix Gems grant bundle • premium features\n**Premium+** — 1,500 Astrix Gems grant bundle • stronger economy multiplier\n**Elite** — 3,000 Astrix Gems grant bundle • highest premium tier\n\n**Early Access** is a separate entitlement that unlocks selected new Astrix features before general release.')]});}
async function serverPremiumCommand(i){
  const tier=await premium.syncServerFromDashboard(i.guildId);
  const config=store.guild(i.guildId).config||{};
  const until=Number(config.serverPremiumUntil||0);
  const permanent=Boolean(config.serverPremiumPermanent);
  const status=tier==='free'?'Not active':(permanent?'Permanent':until>Date.now()?`Active until <t:${Math.floor(until/1000)}:F>`:'Expired');
  const unlocked=tier==='free'
    ? 'No server-wide Premium features are active.'
    : 'No-prefix commands • server-wide Premium access • Premium music/voice features • Premium economy limits and multipliers • Premium UI and automation features';
  return i.reply({embeds:[ui.premiumEmbed(`💎 ${i.guild.name} Premium`,`Tier: **${premium.tierName(tier)}**\nStatus: **${status}**\n\n**Unlocked for every member**\n${unlocked}\n\nUse **/serverinfo** for the complete server snapshot.\nAstrix version: **v${ASTRIX_VERSION}**`)]});
}
async function liveLeaderboardCommand(i){
  if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)){
    throw new Error('Manage Server permission is required to manage live log panels.');
  }
  const category=auditLogs.normalizeLiveCategory(i.options.getString('category',true));
  const message=await auditLogs.ensureDashboard(i.guild,category);
  const labels={messages:'Message Leaderboard',voice:'Voice Leaderboard',invites:'Invite Leaderboard',moderation:'Moderation Log',all:'All Live Log Panels'};
  if(!message) throw new Error('Astrix could not create the live log panel. Check View Channel, Send Messages and Embed Links permissions.');
  return i.reply({embeds:[ui.success('Live Log Panel Updated',`${labels[category]||'Live Log Panel'} is now available in ${message.channel}.\n\nThe panel is refreshed automatically and uses the ${ui.LYriEL_DOT_EMOJI} marker.`)],ephemeral:true});
}
async function premiumCurrency(i){const sub=i.options.getSubcommand();if(sub==='balance'){const t=i.options.getUser('user')||i.user,u=store.user(i.guildId,t.id);return i.reply({embeds:[ui.premiumEmbed('💎 Astrix Gems',`${t} has **${Number(u.premiumGems||0).toLocaleString()} Astrix Gems**.`)]});}premium.requireOwner(i);const t=i.options.getUser('user',true),u=store.user(i.guildId,t.id),amount=i.options.getInteger('amount',true);if(sub==='grant')u.premiumGems=Number(u.premiumGems||0)+amount;else if(sub==='remove')u.premiumGems=Math.max(0,Number(u.premiumGems||0)-amount);else u.premiumGems=amount;store.save();return i.reply({embeds:[ui.ownerEmbed('Premium Currency Updated',`${t} now has **💎 ${Number(u.premiumGems||0).toLocaleString()} Astrix Gems**.`)]});}
async function earlyAccess(i){const sub=i.options.getSubcommand();if(sub==='status'){const t=i.options.getUser('user')||i.user,u=store.user(i.guildId,t.id);return i.reply({embeds:[ui.premiumEmbed('🧪 Early Access',`${t}: **${u.earlyAccess?'Enabled':'Not enabled'}**`)]});}premium.requireOwner(i);const t=i.options.getUser('user',true),u=store.user(i.guildId,t.id);u.earlyAccess=sub==='grant';store.save();return i.reply({embeds:[ui.ownerEmbed('Early Access Updated',`${t}: **${u.earlyAccess?'Enabled':'Removed'}**`)]});}
async function owner(i,n){premium.requireOwner(i);if(n==='givecoins'){const t=i.options.getUser('user',true),a=i.options.getInteger('amount',true),tu=store.user(i.guildId,t.id),credit=econ.creditCoins(tu,a);store.save();return i.reply({embeds:[ui.ownerEmbed('Coins Granted',`${t} received **${econ.fmt(credit.credited)}**.${credit.uncredited?`\n${econ.fmt(credit.uncredited)} could not be stored because the account limits are full.`:''}`)]});}if(n==='setbalance'){const t=i.options.getUser('user',true),u=store.user(i.guildId,t.id),wallet=i.options.getInteger('wallet',true),bank=i.options.getInteger('bank',true);if(wallet>u.walletLimit)throw new Error(`Wallet cannot exceed the user's ${u.walletLimit.toLocaleString()} coin limit.`);if(bank>u.bankLimit)throw new Error(`Bank cannot exceed the user's ${u.bankLimit.toLocaleString()} coin limit.`);u.wallet=wallet;u.bank=bank;store.save();return i.reply({embeds:[ui.ownerEmbed('Balance Set',`${t}\nWallet: **${econ.fmt(u.wallet)} / ${econ.fmt(u.walletLimit)}**\nBank: **${econ.fmt(u.bank)} / ${econ.fmt(u.bankLimit)}**`)]});}if(n==='giveitem'){const t=i.options.getUser('user',true),id=i.options.getString('item',true),q=i.options.getInteger('quantity')||1;if(!shop.catalogItem(id))throw new Error('Unknown item ID.');shop.addItem(store.user(i.guildId,t.id),id,q);store.save();return i.reply({embeds:[ui.ownerEmbed('Item Granted',`${t} received **${q}× ${id}**.`)]});}if(n==='givepremium'){const t=i.options.getUser('user',true),d=i.options.getInteger('days'),tier=i.options.getString('tier')||'premium',ea=i.options.getBoolean('early_access')||false,gems=i.options.getInteger('premium_gems');const result=premium.grantMembership(i.guildId,t.id,{tier,days:d,earlyAccess:ea,gems});return i.reply({embeds:[ui.ownerEmbed('Premium Granted',`${t} received **${premium.tierName(result.tier)}** ${d?`for ${d} day(s)`:'permanently'}.\nAstrix Gems granted: **💎 ${result.award.toLocaleString()}**\nEarly Access: **${result.user.earlyAccess?'Enabled':'Not enabled'}**`)]});}if(n==='removepremium'){const t=i.options.getUser('user',true);premium.removeMembership(i.guildId,t.id);return i.reply({embeds:[ui.ownerEmbed('Premium Removed',`Manual premium tier was removed from ${t}. Astrix Gems are preserved; use **/premiumcurrency remove** or **set** if you want to change them.`)]});}if(n==='shoprefresh'){shop.rotate(i.guildId,'all');return i.reply({embeds:[ui.ownerEmbed('Market Refreshed','Unified Astrix Market stock was rotated immediately.')]});}if(n==='setcredit'){const t=i.options.getUser('user',true),score=i.options.getInteger('score',true);store.user(i.guildId,t.id).creditScore=score;store.save();return i.reply({embeds:[ui.ownerEmbed('Credit Score Set',`${t} → **${score}**.`)]});}if(n==='announce'){const ch=i.options.getChannel('channel',true),title=i.options.getString('title',true),message=i.options.getString('message',true),role=i.options.getRole('role');await ch.send({content:role?`${role}`:undefined,allowedMentions:{roles:role?[role.id]:[]},embeds:[ui.premiumEmbed(title,message)]});return i.reply({embeds:[ui.ownerEmbed('Announcement Sent',`Posted in ${ch}.`)],ephemeral:true});}}
const TRIVIA=[{q:'Which planet is known as the Red Planet?',a:['Mars','Venus','Jupiter','Mercury'],c:0},{q:'What does HTTP stand for?',a:['Hypertext Transfer Protocol','High Transfer Text Process','Host Transfer Type Protocol','Hyper Tool Transfer Program'],c:0},{q:'How many bits are in one byte?',a:['4','8','16','32'],c:1}];
async function trivia(i){const q=TRIVIA[Math.floor(Math.random()*TRIVIA.length)],row=new ActionRowBuilder();q.a.forEach((x,idx)=>row.addComponents(new ButtonBuilder().setCustomId(`trivia:${i.user.id}:${q.c}:${idx}`).setLabel(x).setStyle(ButtonStyle.Secondary)));return i.reply({embeds:[ui.embed('🧠 Quick Trivia',q.q)],components:[row]});}
async function button(i,client){const id=i.customId;if(id.startsWith('help:')){const parts=id.split(':');const ownerId=parts[2];if(i.user.id!==ownerId)return i.reply({content:'This help panel belongs to another user.',ephemeral:true});if(parts[1]==='home')return i.update(helpHome(i));if(parts[1]==='buttons')return i.update(helpButtonHome(i));if(parts[1]==='select')return i.update(helpHome(i));if(parts[1]==='cat')return i.update(helpCategory(i,parts.slice(3).join(':'),0));if(['first','prev','next','last','page'].includes(parts[1]))return i.update(helpCategory(i,parts[3],Number(parts[4])||0));return;}if(id.startsWith('ping:refresh:')){const uid=id.split(':')[2];if(i.user.id!==uid)return i.reply({content:'This panel belongs to another user.',ephemeral:true});await i.deferUpdate();const ws=Math.max(0,Math.round(Number(client.ws?.ping||0))),rest=Math.max(0,Math.round(Number(client.rest?.latency||ws))),mem=Math.round(process.memoryUsage().rss/1024/1024),rating=ws<80?'Excellent':ws<150?'Good':'Slow';return i.editReply({embeds:[ui.success('Astrix Ping Refreshed',`Gateway: **${ws} ms**\nREST: **${rest} ms**\nMemory: **${mem} MB**\nUptime: **${ui.formatDuration(process.uptime()*1000)}**\nStatus: **${rating}**`)],components:i.message.components});}if(id.startsWith('work:')){const parts=id.split(':'),act=parts[1],uid=parts[2];if(i.user.id!==uid)return i.reply({content:'This panel belongs to another user.',ephemeral:true});const u=store.user(i.guildId,i.user.id);if(act==='shift')return shiftAction(i,'start');if(act==='list')return i.reply({...workListPayload(i,u,Number(parts[3])||1),ephemeral:true});if(act==='stats')return i.reply({embeds:[workStatsEmbed(i.user,u)],ephemeral:true});if(act==='career')return i.reply({embeds:[careerEmbed(u)],ephemeral:true});}
if(id.startsWith('worklist:')){const[,uid,page]=id.split(':');if(i.user.id!==uid)return i.reply({content:'This job list belongs to another user.',ephemeral:true});return i.update(workListPayload(i,store.user(i.guildId,i.user.id),Number(page)||1));}
if(id.startsWith('worktask:')){const[,uid,token,answer]=id.split(':');if(i.user.id!==uid)return i.reply({content:'This work mini-job belongs to another user.',ephemeral:true});const u=store.user(i.guildId,i.user.id),result=await jobs.complete(i,u,token,Number(answer));return i.update({embeds:[ui.success(`${result.grade} Work!`,`${result.correct?'✅ Challenge completed correctly.':'❌ The answer was incorrect, so the shift paid a reduced amount.'}\n\nCareer: **${result.job.emoji} ${result.job.name}**\nResult: **${result.grade}**\nSalary stored: **${econ.fmt(result.coins)}**\nXP: **${result.xp}**\nReputation: **${result.reputation>=0?'+':''}${result.reputation}**\nNext shift: <t:${Math.floor(result.nextShiftAt/1000)}:R>\n\n📩 Astrix will DM you when the 15-minute cooldown is over if Work DMs are enabled.${rewardCapacityNote(result)}\n\n${tips.work()}`)],components:[]});}
if(id.startsWith('shop:')){
  await premium.syncUserFromDashboard(i.guildId,i.user.id);
  const parts=id.split(':');
  if(parts[1]==='inventory'){
    const uid=parts[2];
    if(i.user.id!==uid)return i.reply({content:'This shop panel belongs to another user.',ephemeral:true});
    const u=store.user(i.guildId,i.user.id);
    const rows=Object.entries(u.inventory||{})
      .filter(([,q])=>Number(q)>0)
      .map(([itemId,q])=>{const item=shop.catalogItem(itemId);return `• ${item?.emoji||'📦'} **${item?.name||itemId}** × ${q} \`${itemId}\``;});
    return i.reply({embeds:[ui.embed('🎒 Your Inventory',rows.join('\n')||'Empty.')],ephemeral:true});
  }
  if(parts[1]==='fairness'){
    const uid=parts[2];
    if(i.user.id!==uid)return i.reply({content:'This shop panel belongs to another user.',ephemeral:true});
    return i.reply({embeds:[ui.embed('⚖️ Market Fairness',[
      '• Item prices and unlocks scale through Astrix career/economy progression.',
      '• Market stock refreshes automatically; purchases reduce available stock.',
      '• Selling values are defined per item and cannot be changed by the buyer.',
      '• Premium discounts are applied automatically in the same /shop.',
      `• XP packs are intentionally expensive and cap Premium discount at **${Number(process.env.SHOP_XP_MAX_DISCOUNT_PERCENT||5)}%**.`,
      '• A purchase can use wallet coins first and then bank coins for the remaining amount.'
    ].join('\n'))],ephemeral:true});
  }
  if(parts[1]==='mode'){
    const mode=parts[2],uid=parts[3],page=Number(parts[4])||0;
    if(i.user.id!==uid)return i.reply({content:'This shop panel belongs to another user.',ephemeral:true});
    return sendShopPanel(i,mode,page,true);
  }
  if(parts[1]==='nav'){
    const uid=parts[3],mode=parts[4],page=Number(parts[5])||0;
    if(i.user.id!==uid)return i.reply({content:'This shop panel belongs to another user.',ephemeral:true});
    return sendShopPanel(i,mode,page,true);
  }
  if(parts[1]==='item'){
    const mode=parts[2],uid=parts[3],itemId=parts[4],page=Number(parts[5])||0;
    if(i.user.id!==uid)return i.reply({content:'This shop panel belongs to another user.',ephemeral:true});
    if(mode==='sell'){
      const r=shop.sell(i,itemId,1);
       await i.deferUpdate();
       await sendShopPanel(i,'sell',page,false,true);
      return i.followUp({embeds:[ui.success('Item Sold',`Sold **1× ${r.item.name}** for **${econ.fmt(r.value)}**.`)],ephemeral:true});
    }
    const r=shop.buy(i,itemId,1);
     await i.deferUpdate();
     await sendShopPanel(i,'buy',page,false,true);
    const extra=r.instant?`\n✨ Instant XP: **+${r.instant.xp.toLocaleString()}**${r.instant.levels.length?`\nLevel ups: **${r.instant.levels.join(', ')}**`:''}`:'';
    const discount=r.pricing.discount?`\nAutomatic Premium discount: **${r.pricing.discount}%**`:'';
    return i.followUp({embeds:[ui.success('Purchase Complete',`Bought **1× ${r.item.name}** for **${econ.fmt(r.cost)}**.${discount}${extra}`)],ephemeral:true});
  }
  return i.reply({content:'Unknown shop action.',ephemeral:true});
}if(id.startsWith('loan:')){const[,act,uid,amount,months,type]=id.split(':');if(i.user.id!==uid)return i.reply({content:'This loan offer belongs to another user.',ephemeral:true});if(act==='cancel')return i.update({content:'Loan offer cancelled.',embeds:[],components:[]});const u=store.user(i.guildId,i.user.id);if(u.loan)return i.reply({content:'You already have an active loan.',ephemeral:true});const q=calcLoan(u,Number(amount),Number(months),type||'personal');if(econ.bankSpace(u)<Number(amount))return i.reply({content:`Your bank only has ${econ.bankSpace(u).toLocaleString()} coins of free capacity. Increase your bank limit first.`,ephemeral:true});u.loan={principal:Number(amount),remaining:q.total,emi:q.emi,apr:q.apr,months:Number(months),type:q.type,autopay:false,payments:0,startedAt:Date.now(),nextDue:Date.now()+banking.virtualMonthMs()};u.bank+=Number(amount);store.save();return i.update({embeds:[ui.success('Loan Approved',`**${econ.fmt(Number(amount))}** was credited to your Astrix bank.\nMonthly EMI: **${econ.fmt(q.emi)}**.`)],components:[]});}if(id.startsWith('marry:')){const[,act,toId,fromId]=id.split(':');if(i.user.id!==toId)return i.reply({content:'This proposal is for another user.',ephemeral:true});if(act==='accept'){const result=marriage.accept(i.guildId,toId,fromId);return i.update({embeds:[ui.success('💍 Married!',`Congratulations <@${toId}> and <@${fromId}>!

💎 Your Astrix marriage is now official.`)],components:[]});}marriage.decline(i.guildId,toId,fromId);return i.update({embeds:[ui.embed('💔 Proposal Declined','The marriage proposal was declined.')],components:[]});}if(id.startsWith('privacy:'))return privacy.button(i);if(id.startsWith('giveaway:'))return giveaway.button(i,client);if(id.startsWith('music:'))return music.button(i,id.split(':')[1]);if(id.startsWith('record:'))return recording.button(i,id);if(id.startsWith('ticket:'))return tickets.button(i);if(id.startsWith('rolebtn:')||id==='verify:member')return roles.button(i);if(id.startsWith('recover:'))return security.button(i);if(id.startsWith('ai:usage:')){const uid=id.split(':')[2];if(i.user.id!==uid)return i.reply({content:'This panel belongs to another user.',ephemeral:true});const lim=ai.limits(i),x=ai.resetDay(store.user(i.guildId,i.user.id));return i.reply({embeds:[ui.premiumEmbed('AI Usage',`Ask/Text: **${x.usage.ask||0}/${lim.ask}**\nTranslate: **${x.usage.translate||0}/${lim.translate}**\nImages: **${x.usage.image||0}/${lim.image}**`)],ephemeral:true});}if(id.startsWith('trivia:')){const[,uid,c,a]=id.split(':');if(i.user.id!==uid)return i.reply({content:'This trivia question belongs to another user.',ephemeral:true});const correct=c===a;let got=null;if(correct)got=await econ.reward(i,200,20);return i.update({embeds:[ui.embed('Trivia Result',correct?`✅ Correct! **+${got.coins} coins +${got.xp} XP**${rewardCapacityNote(got)}`:'❌ Not correct this time.')],components:[]});}}
async function select(i){if(i.customId.startsWith('helpmodule:')){const uid=i.customId.split(':')[1];if(i.user.id!==uid)return i.reply({content:'This help panel belongs to another user.',ephemeral:true});return i.update(helpCategory(i,i.values[0],0));}if(i.customId.startsWith('music:eq:'))return music.select(i);if(i.customId==='rolemenu:toggle')return roles.select(i);if(i.customId.startsWith('workapply:')){const uid=i.customId.split(':')[1];if(i.user.id!==uid)return i.reply({content:'This job menu belongs to another user.',ephemeral:true});const u=store.user(i.guildId,i.user.id);const j=jobs.apply(u,i.values[0]);return i.update({embeds:[ui.success('Job Application Approved',`You are now working as **${j.emoji} ${j.name}**.`)],components:[]});}}

async function autocomplete(i){if(i.commandName==='work'&&i.options.getSubcommand()==='apply'){const u=store.user(i.guildId,i.user.id),focused=i.options.getFocused();const values=jobs.autocomplete(u,focused).map(j=>({name:`${jobs.eligible(u,j)?'🔓':'🔒'} ${j.name} • L${j.minLevel} • ${j.minShifts} shifts`.slice(0,100),value:j.id}));return i.respond(values);}if(i.commandName==='filter'){const presets=require('./utils/music-presets.ts'),focused=String(i.options.getFocused()||'').toLowerCase();return i.respond(Object.values(presets.presets).filter((preset:any)=>!focused||preset.label.toLowerCase().includes(focused)).slice(0,25).map((preset:any)=>({name:`🎛️ ${preset.label}`.slice(0,100),value:preset.value})));}if(i.commandName==='buy'||i.commandName==='sell'){return i.respond(shop.autocomplete(i,i.commandName,i.options.getFocused()));}if(i.commandName==='use'){const u=store.user(i.guildId,i.user.id),focused=String(i.options.getFocused()||'').toLowerCase();const values=Object.entries(u.inventory||{}).filter(([,qty])=>Number(qty)>0).map(([id])=>shop.catalogItem(id)).filter(Boolean).filter(item=>!focused||item.name.toLowerCase().includes(focused)||item.id.toLowerCase().includes(focused)).slice(0,25).map(item=>({name:`${item.emoji} ${item.name} • Owned ${u.inventory[item.id]}`.slice(0,100),value:item.id}));return i.respond(values);}return i.respond([]);}

async function modal(i){if(i.customId.startsWith('recordnote:'))return recording.modal(i);if(i.customId.startsWith('ticketmodal:'))return tickets.modal(i);}
const baseButton=button;
async function routedButton(i,client){if(String(i.customId||'').startsWith('transfer:'))return economyUpgrade.transferButton(i);return baseButton(i,client);}
const legacyCommand=command;
async function routedCommand(i,client){
  const overflow=overflowCommandName(i);
  return overflow ? legacyCommand(i,client,overflow) : legacyCommand(i,client);
}
module.exports={command:routedCommand,button:routedButton,select,autocomplete,modal};
