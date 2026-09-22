// @ts-nocheck
const store = require('./store.ts');
const premium = require('./premium.ts');
const economy = require('./economy.ts');
const shop = require('./shop.ts');
const giveaway = require('./giveaway.ts');
const security = require('./security.ts');
const ui = require('./ui.ts');
const dashboardConfigSync = require('./dashboardConfigSync.ts');

function requireOwner(i) { premium.requireOwner(i); }
function state() {
  const s = store.load();
  s.meta ||= {};
  s.meta.owner ||= { blacklistedUsers: [], blacklistedGuilds: [] };
  s.meta.owner.blacklistedUsers ||= [];
  s.meta.owner.blacklistedGuilds ||= [];
  return s.meta.owner;
}
function addUnique(arr, id) { if (!arr.includes(id)) arr.push(id); }
function remove(arr, id) { const n=arr.indexOf(id); if (n>=0) arr.splice(n,1); }
function isBlacklisted(guildId, userId) {
  if (premium.isOwner(userId)) return false;
  const s = state();
  return s.blacklistedUsers.includes(String(userId)) || s.blacklistedGuilds.includes(String(guildId));
}
function serverPremium(guildId) {
  const g=store.guild(guildId); g.config ||= {};
  return {
    tier:g.config.serverPremiumTier||'free',
    permanent:Boolean(g.config.serverPremiumPermanent),
    until:Number(g.config.serverPremiumUntil||0)
  };
}
function resolveGuild(client,id){ const g=client.guilds.cache.get(id); if(!g) throw new Error('Astrix is not in that server or the guild ID is invalid.'); return g; }
function defaultTextChannel(guild){
  const cfg=store.guild(guild.id).config||{};
  const configured=cfg.globalAnnouncementChannelId && guild.channels.cache.get(cfg.globalAnnouncementChannelId);
  if(configured?.isTextBased?.()) return configured;
  if(guild.systemChannel?.isTextBased?.()) return guild.systemChannel;
  return guild.channels.cache.find(c=>c.isTextBased?.() && c.permissionsFor(guild.members.me)?.has?.('SendMessages')) || null;
}
function tierText(t){return premium.tierName(t||'free');}

async function command(i, client) {
  requireOwner(i);
  const group=i.options.getSubcommandGroup();
  const sub=i.options.getSubcommand();

  if(group==='premium'){
    if(sub==='usergrant'){
      const user=i.options.getUser('user',true), tier=i.options.getString('tier')||'premium', days=i.options.getInteger('days'), ea=i.options.getBoolean('early_access')||false;
      const r=premium.grantGlobalMembership(user.id,{tier,days,earlyAccess:ea,activatedBy:i.user.id});
      return i.reply({embeds:[ui.ownerEmbed('Owner • Premium Granted',`${user} → **${tierText(r.tier)}** ${days?`for ${days} day(s)`:'permanently'}\nGems added: **💎 ${r.award.toLocaleString()}**\nEarly Access: **${r.record.earlyAccess?'Yes':'No'}**\n\nThis Premium applies automatically wherever the user uses Astrix.`)],ephemeral:true});
    }
    if(sub==='userrevoke'){
      const user=i.options.getUser('user',true); premium.removeGlobalMembership(user.id);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Premium Revoked',`Removed manual Premium from ${user}.`)],ephemeral:true});
    }
    if(sub==='userstatus'){
      const user=i.options.getUser('user',true); await premium.syncUserFromDashboard(i.guildId,user.id);
      const u=store.user(i.guildId,user.id), global=premium.globalPremium(user.id), tier=premium.tierFor(i.guildId,user.id,i.guild);
      return i.reply({embeds:[ui.ownerEmbed('Owner • User Premium',`${user}\nTier: **${tierText(tier)}**\nPermanent: **${u.premiumPermanent?'Yes':'No'}**\nExpires: **${u.premiumUntil>Date.now()?`<t:${Math.floor(u.premiumUntil/1000)}:R>`:'—'}**\nGems: **💎 ${u.premiumGems.toLocaleString()}**\nEarly Access: **${u.earlyAccess?'Yes':'No'}**`)],ephemeral:true});
    }
    const gid=i.options.getString('guild_id',true), g=resolveGuild(client,gid), cfg=store.guild(gid).config;
    if(sub==='servergrant' || sub==='server'){
      const tier=premium.normalizeTier(i.options.getString('tier')||'premium'), days=i.options.getInteger('days');
      cfg.serverPremiumTier=tier; cfg.serverPremiumPermanent=!days; cfg.serverPremiumUntil=days?Date.now()+days*86400000:0; store.save();
      await dashboardConfigSync.upsertPremiumRecord({ userId: 'SERVER', guildId: gid, tier, permanent: !days, until: cfg.serverPremiumUntil, activatedBy: i.user.id });
      return i.reply({embeds:[ui.ownerEmbed('Owner • Server Premium Granted',`**${g.name}** → **${tierText(tier)}** ${days?`for ${days} day(s)`:'permanently'}.`)],ephemeral:true});
    }
    if(sub==='serverrevoke'){
      cfg.serverPremiumTier='free'; cfg.serverPremiumPermanent=false; cfg.serverPremiumUntil=0; store.save();
      await dashboardConfigSync.deactivatePremiumRecord('SERVER', gid);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Server Premium Revoked',`Removed server Premium from **${g.name}**.`)],ephemeral:true});
    }
    if(sub==='serverstatus'){
      const p=serverPremium(gid);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Server Premium',`**${g.name}** (\`${g.id}\`)\nTier: **${tierText(p.tier)}**\nPermanent: **${p.permanent?'Yes':'No'}**\nExpires: **${p.until>Date.now()?`<t:${Math.floor(p.until/1000)}:R>`:'—'}**`)],ephemeral:true});
    }
  }

  if(group==='currency'){
    const user=i.options.getUser('user',true), u=store.user(i.guildId,user.id), amount=i.options.getInteger('amount',true);
    if(sub==='gemsgrant') u.premiumGems+=amount;
    if(sub==='gemsremove') u.premiumGems=Math.max(0,u.premiumGems-amount);
    if(sub==='gemsset') u.premiumGems=Math.max(0,amount);
    if(sub==='coinsgrant') economy.creditCoins(u,amount);
    if(sub==='coinsremove') { let left=amount; const w=Math.min(u.wallet,left);u.wallet-=w;left-=w;const b=Math.min(u.bank,left);u.bank-=b; }
    if(sub==='coinsset') { u.wallet=Math.min(amount,u.walletLimit); }
    store.save();
    return i.reply({embeds:[ui.ownerEmbed('Owner • Currency Updated',`${user}\nWallet: **${economy.fmt(u.wallet)}**\nBank: **${economy.fmt(u.bank)}**\nAstrix Gems: **💎 ${u.premiumGems.toLocaleString()}**`)],ephemeral:true});
  }

  if(group==='economy'){
    const user=i.options.getUser('user',true), u=store.user(i.guildId,user.id);
    if(sub==='itemgrant'||sub==='itemremove'){
      const id=i.options.getString('item',true), qty=i.options.getInteger('quantity')||1;
      if(!shop.catalogItem(id)) throw new Error('Unknown item ID.');
      shop.addItem(u,id,sub==='itemgrant'?qty:-qty); store.save();
      return i.reply({embeds:[ui.ownerEmbed('Owner • Inventory Updated',`${user} • **${sub==='itemgrant'?'+':'-'}${qty}× ${id}**`)],ephemeral:true});
    }
    if(sub==='walletlimit') u.walletLimit=Math.max(u.wallet,i.options.getInteger('amount',true));
    if(sub==='banklimit') u.bankLimit=Math.max(u.bank,i.options.getInteger('amount',true));
    if(sub==='creditset') u.creditScore=i.options.getInteger('score',true);
    if(sub==='loanwipe') u.loan=null;
    if(sub==='loanstatus') return i.reply({embeds:[ui.ownerEmbed('Owner • Loan Status',`${user}\n${u.loan?`Remaining: **${economy.fmt(u.loan.remaining||0)}**\nOriginal: **${economy.fmt(u.loan.principal||u.loan.amount||0)}**`:'No active virtual loan.'}`)],ephemeral:true});
    store.save();
    return i.reply({embeds:[ui.ownerEmbed('Owner • Economy Updated',`${user}\nWallet limit: **${economy.fmt(u.walletLimit)}**\nBank limit: **${economy.fmt(u.bankLimit)}**\nCredit score: **${u.creditScore}**\nLoan: **${u.loan?'Active':'None'}**`)],ephemeral:true});
  }

  if(group==='access'){
    const st=state();
    if(['earlygrant','earlyrevoke'].includes(sub)){
      const user=i.options.getUser('user',true),u=store.user(i.guildId,user.id);u.earlyAccess=sub==='earlygrant';store.save();
      return i.reply({embeds:[ui.ownerEmbed('Owner • Early Access',`${user} → **${u.earlyAccess?'Enabled':'Disabled'}**`)],ephemeral:true});
    }
    if(['blacklistuser','unblacklistuser'].includes(sub)){
      const user=i.options.getUser('user',true); sub==='blacklistuser'?addUnique(st.blacklistedUsers,user.id):remove(st.blacklistedUsers,user.id);store.save();
      return i.reply({embeds:[ui.ownerEmbed('Owner • User Access',`${user} → **${sub==='blacklistuser'?'Blacklisted':'Removed from blacklist'}**`)],ephemeral:true});
    }
    const gid=i.options.getString('guild_id',true); resolveGuild(client,gid); sub==='blacklistserver'?addUnique(st.blacklistedGuilds,gid):remove(st.blacklistedGuilds,gid);store.save();
    return i.reply({embeds:[ui.ownerEmbed('Owner • Server Access',`Guild \`${gid}\` → **${sub==='blacklistserver'?'Blacklisted':'Removed from blacklist'}**`)],ephemeral:true});
  }

  if(group==='broadcast'){
    if(sub==='announce'){
      const ch=i.options.getChannel('channel',true), title=i.options.getString('title',true), message=i.options.getString('message',true);
      await ch.send({embeds:[ui.premiumEmbed(title,message)]});
      return i.reply({embeds:[ui.ownerEmbed('Owner • Announcement Sent',`Posted in ${ch}.`)],ephemeral:true});
    }
    if(!i.options.getBoolean('confirm',true)) throw new Error('Set confirm to True to run a global broadcast.');
    if(sub==='globalannounce'){
      const title=i.options.getString('title',true), message=i.options.getString('message',true); let sent=0,failed=0;
      await i.deferReply({ephemeral:true});
      for(const g of client.guilds.cache.values()){
        if(state().blacklistedGuilds.includes(g.id)) continue;
        const ch=defaultTextChannel(g); if(!ch){failed++;continue;}
        try{await ch.send({embeds:[ui.premiumEmbed(title,message)]});sent++;}catch{failed++;}
      }
      return i.editReply({embeds:[ui.ownerEmbed('Owner • Global Announcement',`Sent: **${sent}** server(s)\nFailed/skipped: **${failed}**`)]});
    }
    if(sub==='globalgiveaway'){
      const duration=i.options.getString('duration',true), prize=i.options.getString('prize',true), winners=i.options.getInteger('winners')||1; let sent=0,failed=0;
      await i.deferReply({ephemeral:true});
      for(const g of client.guilds.cache.values()){
        if(state().blacklistedGuilds.includes(g.id)) continue;
        const ch=defaultTextChannel(g); if(!ch){failed++;continue;}
        try{await giveaway.startInChannel(g,ch,i.user.id,duration,prize,winners,client);sent++;}catch{failed++;}
      }
      return i.editReply({embeds:[ui.ownerEmbed('Owner • Global Giveaway',`Started in **${sent}** server(s).\nFailed/skipped: **${failed}**`)]});
    }
  }

  if(group==='bot'){
    if(sub==='animatedavatar'){
      const avatar=i.options.getAttachment('avatar',true);
      const contentType=String(avatar.contentType||'').toLowerCase();
      const fileName=String(avatar.name||'').toLowerCase();
      const isGif=contentType==='image/gif'||fileName.endsWith('.gif');
      if(!isGif) throw new Error('Please upload a GIF file for the animated avatar.');
      if(Number(avatar.size||0)>10*1024*1024) throw new Error('The avatar GIF must be 10 MB or smaller.');
      if(!client.user) throw new Error('Astrix bot user is not ready yet. Please try again in a moment.');

      await i.deferReply({ephemeral:true});
      try{
        await client.user.setAvatar(avatar.url);
        return i.editReply({embeds:[ui.ownerEmbed('Owner • Animated Avatar Updated',`Astrix's avatar was updated successfully.\nFile: **${avatar.name||'avatar.gif'}**`)]});
      }catch(error){
        const code=error?.code?` (Discord code: ${error.code})`:'';
        const message=String(error?.message||'Discord rejected the avatar update.').slice(0,900);
        throw new Error(`Could not update the Astrix avatar${code}: ${message}`);
      }
    }

    if(sub==='banner'){
      const banner=i.options.getAttachment('banner',true);
      const contentType=String(banner.contentType||'').toLowerCase();
      const fileName=String(banner.name||'').toLowerCase();
      const allowedTypes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
      const allowedExtension=/\.(png|jpe?g|webp|gif)$/i.test(fileName);
      if(!allowedTypes.has(contentType)&&!allowedExtension){
        throw new Error('Please upload a PNG, JPG, WebP, or GIF image for the bot banner.');
      }
      if(Number(banner.size||0)>10*1024*1024) throw new Error('The banner image must be 10 MB or smaller.');
      if(!client.user) throw new Error('Astrix bot user is not ready yet. Please try again in a moment.');

      await i.deferReply({ephemeral:true});
      try{
        const response=await fetch(banner.url);
        if(!response.ok) throw new Error(`Could not download the uploaded banner (HTTP ${response.status}).`);
        const data=Buffer.from(await response.arrayBuffer());
        if(!data.length) throw new Error('The uploaded banner file was empty.');
        await client.user.setBanner(data);
        const animated=contentType==='image/gif'||fileName.endsWith('.gif');
        return i.editReply({embeds:[ui.ownerEmbed('Owner • Bot Banner Updated',`Astrix's ${animated?'animated ':''}banner was updated successfully.\nFile: **${banner.name||'banner'}**`)]});
      }catch(error){
        const code=error?.code?` (Discord code: ${error.code})`:'';
        const message=String(error?.message||'Discord rejected the banner update.').slice(0,900);
        throw new Error(`Could not update the Astrix banner${code}: ${message}`);
      }
    }
  }

  if(group==='system'){
    if(sub==='stats'){
      const users=Object.values(store.snapshot().users||{}).reduce((n,g)=>n+Object.keys(g).length,0);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Astrix Stats',`Servers: **${client.guilds.cache.size}**\nStored users: **${users}**\nUptime: **${Math.floor(process.uptime())}s**\nPing: **${client.ws.ping}ms**`)],ephemeral:true});
    }
    if(sub==='guilds'){
      const rows=[...client.guilds.cache.values()].slice(0,25).map(g=>`• **${g.name}** • \`${g.id}\` • ${g.memberCount} members`);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Servers',rows.join('\n')||'No servers.')],ephemeral:true});
    }
    if(sub==='users'){
      const users=Object.values(store.snapshot().users||{}).reduce((n,g)=>n+Object.keys(g).length,0);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Users',`Stored economy/profile users: **${users.toLocaleString()}**`)],ephemeral:true});
    }
    if(sub==='reloadshop'){
      const gid=i.options.getString('guild_id')||i.guildId; resolveGuild(client,gid); shop.rotate(gid,'all');
      return i.reply({embeds:[ui.ownerEmbed('Owner • Shop Reloaded',`Rotated unified Astrix Market stock for guild \`${gid}\`.`)],ephemeral:true});
    }
    if(sub==='backup'){
      const gid=i.options.getString('guild_id')||i.guildId, g=resolveGuild(client,gid); security.createBackup(g);
      return i.reply({embeds:[ui.ownerEmbed('Owner • Backup Created',`Security snapshot created for **${g.name}**.`)],ephemeral:true});
    }
    if(sub==='logs'){
      const configured=store.load().meta?.ownerLog||{};
      const channelId=String(configured.channelId||process.env.ASTRIX_GLOBAL_LOG_CHANNEL_ID||process.env.BOT_LOG_CHANNEL_ID||'').trim();
      const guildId=String(configured.guildId||process.env.ASTRIX_SUPPORT_GUILD_ID||process.env.SUPPORT_GUILD_ID||'').trim();
      return i.reply({embeds:[ui.ownerEmbed('Owner • Bot Logs',channelId
        ? `Global owner logs are configured for <#${channelId}>${guildId?`\nGuild ID: \`${guildId}\``:''}.\n\nUse **/owner system logchannel** to change the destination.`
        : 'No owner-only bot log channel is configured yet.\n\nUse **/owner system logchannel** to set one.')],ephemeral:true});
    }
    if(sub==='logchannel'){
      const channel=i.options.getChannel('channel',true);
      if(!channel.isTextBased?.()) throw new Error('Choose a text channel for owner bot logs.');
      const data=store.load();
      data.meta ||= {};
      data.meta.ownerLog = { guildId: i.guildId, channelId: channel.id };
      store.save();
      return i.reply({embeds:[ui.ownerEmbed('Owner • Global Logs Updated',`All owner bot logs will now be sent to ${channel} in **${i.guild.name}**.\n\nThis includes technical errors, AI failures/limits, backup results, Anti-Nuke incidents, safety actions and moderation activity.`)],ephemeral:true});
    }
  }
  throw new Error('Unknown owner command.');
}

module.exports={ command, state, serverPremium, isBlacklisted };
