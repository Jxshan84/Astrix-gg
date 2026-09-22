const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('./store.ts');
const ui = require('./ui.ts');
const VERSION = String(process.env.PRIVACY_POLICY_VERSION || '1.0');
const URL = process.env.PRIVACY_POLICY_URL || process.env.DASHBOARD_URL || process.env.SUPPORT_SERVER_URL || 'https://astrix-dashboard.vercel.app/';
const REQUIRED = new Set([
  'balance','daily','weekly','deposit','withdraw','pay','leaderboard','inventory','use','sell','shop','buy','premium',
  'work','jobs','applyjob','shift','career','loan','credit','repay','profile',
  'action','hug','slap','kiss','fuck','pat','poke','bonk','wave','highfive','dance','clap','cheer','laugh','facepalm','smile','shrug','salute','handshake','nod','stare','wink','thumbsup',
'hunt','fish','dig','beg','search','zoo','collection','quests','achievements','adventure','rob'
]);
function hasConsent(guildId,userId){const u=store.user(guildId,userId);return u.privacyAcceptedVersion===VERSION && Number(u.privacyAcceptedAt||0)>0;}
function row(userId){const buttons=[new ButtonBuilder().setCustomId(`privacy:accept:${userId}`).setLabel('Accept & Continue').setEmoji('✅').setStyle(ButtonStyle.Success)];if(/^https?:\/\//i.test(URL))buttons.push(new ButtonBuilder().setLabel('Privacy Policy').setStyle(ButtonStyle.Link).setURL(URL));return new ActionRowBuilder().addComponents(...buttons);}
function payload(userId){return {embeds:[ui.premiumEmbed('🔐 Astrix Privacy Consent',`Before using Astrix economy, career, collection, or social fun features, please review and accept the Privacy Policy.\n\nAstrix stores the minimum account/server data needed for features such as balances, jobs, cooldowns, collections, Premium entitlements and preferences.\n\n**Policy version:** ${VERSION}\nYou can use other non-data features without accepting.`)],components:[row(userId)],ephemeral:true};}
function requires(command){return REQUIRED.has(String(command||'').toLowerCase());}
async function guardInteraction(i){if(!requires(i.commandName)||hasConsent(i.guildId,i.user.id))return false;await i.reply(payload(i.user.id));return true;}
async function promptMessage(message){if(hasConsent(message.guild.id,message.author.id))return false;await message.reply({embeds:payload(message.author.id).embeds,components:payload(message.author.id).components,allowedMentions:{repliedUser:false}});return true;}
async function button(i){const [,action,uid]=i.customId.split(':');if(action!=='accept')return false;if(i.user.id!==uid)return i.reply({content:'This privacy prompt belongs to another user.',ephemeral:true});const u=store.user(i.guildId,i.user.id);u.privacyAcceptedVersion=VERSION;u.privacyAcceptedAt=Date.now();store.save();return i.update({embeds:[ui.success('Privacy Accepted',`Thanks. Privacy Policy **v${VERSION}** is accepted. You can now use Astrix economy, work, collection and fun features.`)],components:[]});}
module.exports={VERSION,URL,REQUIRED,hasConsent,requires,guardInteraction,promptMessage,button};
