// @ts-nocheck
let canvasLib = null;
function canvas(){ if(!canvasLib) canvasLib = require('@napi-rs/canvas'); return canvasLib; }
async function avatarImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const { loadImage } = canvas();
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    return await loadImage(Buffer.from(await r.arrayBuffer()));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
async function profileCard(member, u, spouseName = null) {
  const { createCanvas } = canvas(); const c=createCanvas(1100,620),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,1100,560);g.addColorStop(0,'#111827');g.addColorStop(1,'#312e81');x.fillStyle=g;x.fillRect(0,0,1100,620);
  x.fillStyle='rgba(255,255,255,.08)';roundRect(x,40,40,1020,480,28);
  const av=await avatarImage(member.user.displayAvatarURL({extension:'png',size:256})); if(av){x.save();x.beginPath();x.arc(165,180,100,0,Math.PI*2);x.clip();x.drawImage(av,65,80,200,200);x.restore();}
  x.fillStyle='#fff';x.font='bold 42px sans-serif';x.fillText(member.displayName.slice(0,24),300,125);
  x.font='24px sans-serif';x.fillStyle='#c7d2fe';x.fillText(`Level ${u.level}  •  ${u.xp} XP  •  Credit ${u.creditScore}`,300,175);
  const net=(u.wallet||0)+(u.bank||0);x.fillStyle='#fff';x.font='bold 30px sans-serif';x.fillText(`Wallet  ${u.wallet.toLocaleString()} / ${u.walletLimit.toLocaleString()}`,300,245);x.fillText(`Bank    ${u.bank.toLocaleString()} / ${u.bankLimit.toLocaleString()}`,300,290);x.fillText(`Net Worth  ${net.toLocaleString()} coins`,300,335);
  x.fillText(`📦 Crates  ${Number(u.crates || 0).toLocaleString()}`,300,370);
  x.fillStyle='#c7d2fe';x.font='24px sans-serif';x.fillText(`Job: ${u.job || 'None'}   •   Completed shifts: ${u.shifts || 0}`,300,405);
  x.fillText(`Badges: ${(u.badges||[]).slice(0,3).join(', ') || 'None yet'}`,300,450);
  x.fillStyle='#a5b4fc';x.font='20px sans-serif';x.fillText('ASTRIX ECONOMY PROFILE',65,495);
  return c.toBuffer('image/png');
}
async function levelCard(member, level, reward = 0) {
  const { createCanvas } = canvas();
  const c = createCanvas(1200, 520);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 520);
  g.addColorStop(0, '#140b2e');
  g.addColorStop(0.55, '#4c1d95');
  g.addColorStop(1, '#be185d');
  x.fillStyle = g;
  x.fillRect(0, 0, 1200, 520);

  x.fillStyle = 'rgba(255,255,255,.11)';
  roundRect(x, 42, 42, 1116, 436, 30);
  const av = await avatarImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
  if (av) {
    x.save();
    x.beginPath();
    x.arc(188, 260, 112, 0, Math.PI * 2);
    x.clip();
    x.drawImage(av, 76, 148, 224, 224);
    x.restore();
  } else {
    x.fillStyle = 'rgba(255,255,255,.18)';
    x.beginPath();
    x.arc(188, 260, 112, 0, Math.PI * 2);
    x.fill();
  }

  x.fillStyle = '#fef3c7';
  x.font = 'bold 22px sans-serif';
  x.fillText('ASTRIX • ACHIEVEMENT UNLOCKED', 370, 112);
  x.fillStyle = '#fff';
  x.font = 'bold 72px sans-serif';
  x.fillText('LEVEL UP!', 370, 198);
  x.font = 'bold 48px sans-serif';
  x.fillText(`Level ${level}`, 370, 260);
  x.fillStyle = '#fce7f3';
  x.font = '26px sans-serif';
  x.fillText(`${String(member.displayName || member.user.username).slice(0, 28)} advanced in Astrix.`, 370, 312);
  x.fillStyle = '#fde68a';
  x.font = 'bold 30px sans-serif';
  x.fillText(`+${Number(reward || 0).toLocaleString()} coins   •   +1 📦 crate`, 370, 382);
  x.fillStyle = 'rgba(255,255,255,.72)';
  x.font = '20px sans-serif';
  x.fillText('Keep chatting to earn more XP and surprise rewards.', 370, 425);
  return c.toBuffer('image/png');
}

async function xpCard(member, progress, u) {
  const { createCanvas } = canvas();
  const c = createCanvas(1200, 520);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1200, 520);
  g.addColorStop(0, '#07152d');
  g.addColorStop(0.6, '#123c67');
  g.addColorStop(1, '#0f766e');
  x.fillStyle = g;
  x.fillRect(0, 0, 1200, 520);

  x.fillStyle = 'rgba(255,255,255,.10)';
  roundRect(x, 42, 42, 1116, 436, 30);
  const av = await avatarImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
  if (av) {
    x.save();
    x.beginPath();
    x.arc(180, 190, 108, 0, Math.PI * 2);
    x.clip();
    x.drawImage(av, 72, 82, 216, 216);
    x.restore();
  }

  x.fillStyle = '#ccfbf1';
  x.font = 'bold 22px sans-serif';
  x.fillText('ASTRIX XP PROFILE', 360, 112);
  x.fillStyle = '#fff';
  x.font = 'bold 50px sans-serif';
  x.fillText(String(member.displayName || member.user.username).slice(0, 26), 360, 176);
  x.fillStyle = '#99f6e4';
  x.font = 'bold 36px sans-serif';
  x.fillText(`Level ${progress.level}`, 360, 232);
  x.fillStyle = '#e0f2fe';
  x.font = '24px sans-serif';
  x.fillText(`${progress.xp.toLocaleString()} / ${progress.required.toLocaleString()} XP`, 360, 276);

  const barX = 360;
  const barY = 318;
  const barW = 735;
  x.fillStyle = 'rgba(255,255,255,.16)';
  roundRect(x, barX, barY, barW, 28, 14);
  x.fillStyle = '#5eead4';
  roundRect(x, barX, barY, barW * (progress.percent / 100), 28, 14);
  x.fillStyle = '#ccfbf1';
  x.font = '20px sans-serif';
  x.fillText(`${progress.percent}% • ${progress.needed.toLocaleString()} XP to Level ${progress.nextLevel}`, barX, 382);
  x.fillStyle = '#fff';
  x.font = 'bold 24px sans-serif';
  x.fillText(`Cash: ${Number(u.wallet || 0).toLocaleString()} coins`, 360, 430);
  x.fillText(`Bank: ${Number(u.bank || 0).toLocaleString()} coins`, 700, 430);
  return c.toBuffer('image/png');
}
function panel(ctx, x, y, w, h, accent) {
  ctx.fillStyle = '#12131d';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.13)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(x + 10, y, w - 20, 4, 3);
  ctx.fill();
}

function latencyWave(ctx, x, y, w, h, values, color) {
  const max = Math.max(100, ...values.map(value => Number(value) || 0)) * 1.15;
  ctx.beginPath();
  values.forEach((value, index) => {
    const px = x + (index / Math.max(1, values.length - 1)) * w;
    const py = y + h - ((Number(value) || 0) / max) * h;
    if (index === 0) ctx.moveTo(px, py);
    else {
      const previous = values[index - 1];
      const previousX = x + ((index - 1) / Math.max(1, values.length - 1)) * w;
      const previousY = y + h - ((Number(previous) || 0) / max) * h;
      const middle = (previousX + px) / 2;
      ctx.bezierCurveTo(middle, previousY, middle, py, px, py);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function pingCard(stats, samples) {
  const { createCanvas } = canvas();
  const c = createCanvas(1000, 360);
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 1000, 360);
  bg.addColorStop(0, '#11111b');
  bg.addColorStop(1, '#0b0d15');
  x.fillStyle = bg;
  x.fillRect(0, 0, 1000, 360);

  x.strokeStyle = '#f72585';
  x.lineWidth = 2;
  x.beginPath();
  x.roundRect(3, 3, 994, 354, 17);
  x.stroke();

  x.fillStyle = '#f7f7fb';
  x.font = 'bold 18px sans-serif';
  x.fillText('ASTRIX CORE', 32, 39);
  x.fillStyle = '#f72585';
  x.fillText('• REALTIME SYSTEM METRICS', 145, 39);

  x.fillStyle = '#101b1b';
  x.beginPath();
  x.roundRect(833, 18, 136, 28, 14);
  x.fill();
  x.strokeStyle = '#14e6a2';
  x.lineWidth = 1;
  x.stroke();
  x.fillStyle = '#14e6a2';
  x.beginPath();
  x.arc(848, 32, 4, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#f7f7fb';
  x.font = 'bold 11px sans-serif';
  x.fillText('OPERATIONAL', 860, 36);

  panel(x, 30, 61, 210, 136, '#14e6a2');
  panel(x, 255, 61, 210, 136, '#f72585');
  panel(x, 480, 61, 490, 268, '#f72585');
  panel(x, 30, 210, 210, 119, '#13d8f5');
  panel(x, 255, 210, 210, 119, '#a855f7');

  const label = (text, px, py) => {
    x.fillStyle = '#9b9ca9';
    x.font = 'bold 11px sans-serif';
    x.fillText(text, px, py);
  };
  label('GATEWAY LATENCY', 45, 86);
  label('REST API LATENCY', 270, 86);
  label('SYSTEM UPTIME', 45, 236);
  label('RESOURCE & AUDIO ENGINE', 270, 236);
  label('INVOKED BY USER', 500, 86);

  x.fillStyle = '#f8f8fc';
  x.font = 'bold 45px sans-serif';
  x.fillText(`${Math.max(0, Math.round(stats.ws))}`, 45, 132);
  x.font = 'bold 15px sans-serif';
  x.fillStyle = '#14e6a2';
  x.fillText('ms', 116, 130);
  x.fillStyle = '#f8f8fc';
  x.font = 'bold 45px sans-serif';
  x.fillText(`${Math.max(0, Math.round(stats.rest))}`, 270, 132);
  x.font = 'bold 15px sans-serif';
  x.fillStyle = '#f72585';
  x.fillText('ms', 342, 130);

  latencyWave(x, 45, 149, 180, 34, samples, '#14e6a2');
  latencyWave(x, 270, 149, 180, 34, samples.map(value => Math.max(0, Number(value) + Number(stats.rest || 0) - Number(stats.ws || 0))), '#f72585');

  x.fillStyle = '#f8f8fc';
  x.font = 'bold 16px sans-serif';
  x.fillText(stats.uptime, 45, 267);
  x.fillStyle = '#9b9ca9';
  x.font = '13px sans-serif';
  x.fillText('Continuous Engine Operation', 45, 291);

  x.fillStyle = '#f8f8fc';
  x.font = 'bold 13px sans-serif';
  x.fillText(`RAM: ${stats.memory} MB  |  CPU: ${stats.cpu}%`, 270, 267);
  x.fillStyle = '#14e6a2';
  x.font = '13px sans-serif';
  x.fillText(`Audio Node: ${stats.audio || 'Connected'}`, 270, 291);

  const avatar = null;
  x.save();
  x.beginPath();
  x.arc(552, 159, 45, 0, Math.PI * 2);
  x.clip();
  if (avatar) x.drawImage(avatar, 507, 114, 90, 90);
  else {
    x.fillStyle = '#333447';
    x.fill();
    x.fillStyle = '#f8f8fc';
    x.font = 'bold 28px sans-serif';
    x.fillText(String(stats.userName || 'A').slice(0, 1).toUpperCase(), 542, 169);
  }
  x.restore();
  x.strokeStyle = '#f72585';
  x.lineWidth = 2;
  x.beginPath();
  x.arc(552, 159, 48, 0, Math.PI * 2);
  x.stroke();

  x.fillStyle = '#f8f8fc';
  x.font = 'bold 22px sans-serif';
  x.fillText(String(stats.userName || 'Unknown').slice(0, 23), 640, 126);
  x.fillStyle = '#f72585';
  x.font = '13px sans-serif';
  x.fillText(String(stats.userTag || '').slice(0, 28), 640, 151);
  x.fillStyle = '#9b9ca9';
  x.font = '12px monospace';
  x.fillText(`ID: ${String(stats.userId || 'unknown')}`, 640, 174);
  x.fillStyle = '#f72585';
  x.font = 'bold 12px sans-serif';
  x.fillText('ASTRIX SYSTEM USER', 640, 197);

  x.strokeStyle = 'rgba(255,255,255,.8)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(515, 272);
  x.lineTo(935, 272);
  x.stroke();
  x.fillStyle = '#10d9f0';
  x.font = 'bold 12px monospace';
  x.fillText(`Guilds: ${Number(stats.guilds || 0).toLocaleString()}`, 515, 300);
  x.fillStyle = '#f72585';
  x.fillText(`Users: ${Number(stats.users || 0).toLocaleString()}`, 660, 300);
  x.fillStyle = '#10d9f0';
  x.fillText(`Shards: ${Number(stats.shards || 1).toLocaleString()}`, 810, 300);

  return c.toBuffer('image/png');
}

async function walletCard(member, u) {
  const { createCanvas } = canvas(); const c=createCanvas(1100,620),x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,1100,620);g.addColorStop(0,'#111827');g.addColorStop(0.55,'#1e3a8a');g.addColorStop(1,'#312e81');x.fillStyle=g;x.fillRect(0,0,1100,620);
  x.fillStyle='rgba(255,255,255,.08)';roundRect(x,35,35,1030,550,30);
  const av=await avatarImage(member.user.displayAvatarURL({extension:'png',size:256}));
  if(av){x.save();x.beginPath();x.arc(135,125,72,0,Math.PI*2);x.clip();x.drawImage(av,63,53,144,144);x.restore();}
  x.fillStyle='#fff';x.font='bold 38px sans-serif';x.fillText(member.displayName.slice(0,24),235,105);
  x.font='20px sans-serif';x.fillStyle='#c7d2fe';x.fillText('ASTRIX WALLET',235,138);
  x.fillStyle='#fff';x.font='bold 52px sans-serif';x.fillText(`⏣ ${Number(u.wallet||0).toLocaleString()}`,70,250);
  x.font='22px sans-serif';x.fillStyle='#c7d2fe';x.fillText(`Cash limit: ${Number(u.walletLimit||0).toLocaleString()}`,70,285);
  x.fillStyle='#fff';x.font='bold 40px sans-serif';x.fillText(`🏦 ${Number(u.bank||0).toLocaleString()}`,600,250);
  x.font='22px sans-serif';x.fillStyle='#c7d2fe';x.fillText(`Bank limit: ${Number(u.bankLimit||0).toLocaleString()}`,600,285);
  const net=Number(u.wallet||0)+Number(u.bank||0);x.fillStyle='#fff';x.font='bold 34px sans-serif';x.fillText(`Net Worth  ⏣ ${net.toLocaleString()}`,70,370);
  x.font='22px sans-serif';x.fillStyle='#ddd6fe';x.fillText(`Level ${u.level||1}  •  Credit ${u.creditScore||650}  •  💎 ${Number(u.premiumGems||0).toLocaleString()}`,70,410);
  const pct=Math.max(0,Math.min(100,Math.round((Number(u.wallet||0)/Math.max(1,Number(u.walletLimit||1)))*100)));x.fillStyle='rgba(255,255,255,.12)';roundRect(x,70,465,960,28,14);x.fillStyle='#8b5cf6';roundRect(x,70,465,960*pct/100,28,14);x.fillStyle='#fff';x.font='18px sans-serif';x.fillText(`Wallet capacity ${pct}%`,70,535);
  return c.toBuffer('image/png');
}

module.exports={profileCard,levelCard,xpCard,pingCard,walletCard};

async function modernPingCard(client, latency) {
  const { createCanvas } = canvas();
  const canvas = createCanvas(1200, 500);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, 1200, 500);
  ctx.fillStyle = '#151d33'; ctx.roundRect(45, 45, 1110, 410, 28); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 42px Sans';
  ctx.fillText('ASTRIX  •  NETWORK STATUS', 85, 115);
  ctx.fillStyle = '#aab6d3'; ctx.font = '24px Sans';
  ctx.fillText('Real-time bot connection diagnostics', 85, 155);
  const items = [
    ['LATENCY', `${Math.max(0, Math.round(latency))} ms`],
    ['API', client.ws?.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : 'Connected'],
    ['UPTIME', formatPingUptime(client.uptime || 0)],
    ['STATUS', 'ONLINE']
  ];
  items.forEach((item, i) => {
    const x = 85 + i * 265;
    ctx.fillStyle = '#202a45'; ctx.roundRect(x, 205, 235, 150, 20); ctx.fill();
    ctx.fillStyle = '#8fa0c7'; ctx.font = 'bold 17px Sans'; ctx.fillText(item[0], x + 20, 240);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px Sans'; ctx.fillText(item[1], x + 20, 295);
  });
  ctx.fillStyle = '#7c8cff'; ctx.font = 'bold 18px Sans';
  ctx.fillText('Astrix • Fast • Stable • Connected', 85, 410);
  return canvas.toBuffer('image/png');
}
function formatPingUptime(ms) {
  let s=Math.floor(ms/1000), d=Math.floor(s/86400); s%=86400;
  let h=Math.floor(s/3600); s%=3600; let m=Math.floor(s/60); s%=60;
  return `${d}d ${h}h ${m}m ${s}s`;
}
