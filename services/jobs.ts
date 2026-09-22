const crypto=require('crypto');
const jobs=require('../data/jobs.json');
const miniJobs=require('../data/work-mini-jobs.json');
const store=require('./store.ts');
const economy=require('./economy.ts');

const COOLDOWN_MS=15*60*1000;
const TASK_TTL_MS=2*60*1000;
function getJob(id){return jobs.find(j=>j.id===id)||null}
function eligible(u,j){return (u.shifts||0)>=Number(j.minShifts||0)&&(u.level||1)>=Number(j.minLevel||1)}
function todayKey(){return new Date().toISOString().slice(0,10)}
function normalizeDaily(u){const d=todayKey();if(u.workDay!==d){u.workDay=d;u.shiftsToday=0;}return u}
function randomBetween(a,b){a=Math.floor(Number(a||0));b=Math.floor(Number(b||a));return a+Math.floor(Math.random()*(Math.max(a,b)-a+1))}
function fmtCooldown(ms){const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60),r=s%60;return m?`${m}m ${r}s`:`${r}s`}
function chooseTask(job){
  const types=new Set(job.miniGames||[]);
  let pool=miniJobs.filter(t=>types.has(t.type));
  if(!pool.length)pool=miniJobs;
  const task=pool[Math.floor(Math.random()*pool.length)];
  return {...task,prompt:`**${job.emoji} ${job.name}** • ${task.prompt}`};
}
function ensureJob(u){
  const current=getJob(u.job);
  if(current&&eligible(u,current))return current;
  const next=jobs.find(j=>eligible(u,j));
  if(!next)return null;
  u.job=next.id;
  u.workStreak=0;
  store.save();
  return next;
}
function start(u){
  normalizeDaily(u);
  if(u.shift)throw new Error('You already have an active work mini-job. Finish it before starting another shift.');
  const remaining=Number(u.shiftCooldownUntil||0)-Date.now();
  if(remaining>0)throw new Error(`Your next shift is ready <t:${Math.floor(u.shiftCooldownUntil/1000)}:R> (**${fmtCooldown(remaining)}**).`);
  const job=ensureJob(u);if(!job)throw new Error('No unlocked job is available at your current level.');
  const task=chooseTask(job),token=crypto.randomBytes(5).toString('hex');
  u.shift={token,startedAt:Date.now(),job:job.id,task};u.workNotifyPending=false;u.workNotifyAt=0;store.save();
  return{job,shift:u.shift};
}
async function complete(interaction,u,token,answer){
  if(!u.shift)throw new Error('You do not have an active work mini-job.');
  if(String(u.shift.token)!==String(token))throw new Error('That work challenge is no longer active. Start a new shift.');
  const job=getJob(u.shift.job);if(!job){u.shift=null;store.save();throw new Error('This career is no longer available.');}
  const task=u.shift.task,elapsed=Date.now()-Number(u.shift.startedAt||0);
  if(elapsed>TASK_TTL_MS){u.shift=null;store.save();throw new Error('That work mini-job expired. Use **/work shift** to start again.');}
  const correct=Number(answer)===Number(task.correct);
  let grade='Failed',factor=.30,xpFactor=.35,rep=-1;
  if(correct&&elapsed<=12000){grade='Perfect';factor=1.15;xpFactor=1.2;rep=3;}
  else if(correct&&elapsed<=30000){grade='Good';factor=1;xpFactor=1;rep=2;}
  else if(correct){grade='Average';factor=.8;xpFactor=.85;rep=1;}
  const baseSalary=randomBetween(job.salaryMin||job.salary,job.salaryMax||job.salary),baseXp=randomBetween(job.xpMin||job.xp,job.xpMax||job.xp);
  let salary=Math.max(1,Math.floor(baseSalary*factor)),xp=Math.max(1,Math.floor(baseXp*xpFactor));
  const boost=Number(u.boosts?.nextWork||1);salary=Math.floor(salary*boost);if(u.boosts)delete u.boosts.nextWork;
  normalizeDaily(u);u.shifts=(u.shifts||0)+1;u.shiftsToday=(u.shiftsToday||0)+1;u.totalWorkMinutes=(u.totalWorkMinutes||0)+Math.max(1,Math.ceil(elapsed/60000));u.workXp=(u.workXp||0)+xp;u.workReputation=(u.workReputation||0)+rep;
  if(correct){u.successfulShifts=(u.successfulShifts||0)+1;u.workStreak=(u.workStreak||0)+1;u.bestWorkStreak=Math.max(u.bestWorkStreak||0,u.workStreak);}else{u.failedShifts=(u.failedShifts||0)+1;u.workStreak=0;}
  u.shift=null;u.shiftCooldownUntil=Date.now()+COOLDOWN_MS;u.workNotifyAt=u.shiftCooldownUntil;u.workNotifyPending=true;
  const got=await economy.reward(interaction,salary,xp);u.totalWorkEarnings=(u.totalWorkEarnings||0)+Number(got.coins||0);
  u.workHistory.unshift({at:Date.now(),jobId:job.id,jobName:job.name,grade,correct,coins:got.coins,xp:got.xp,taskId:task.id});u.workHistory=u.workHistory.slice(0,50);store.save();
  return{job,task,grade,correct,elapsed,baseSalary,...got,cooldownMinutes:15,nextShiftAt:u.shiftCooldownUntil,reputation:rep};
}
function cancel(u){if(!u.shift)throw new Error('No active work mini-job.');u.shift=null;store.save();}
function apply(u,id){const j=getJob(id);if(!j)throw new Error('Job not found. Use **/work list** to browse careers.');if(!eligible(u,j))throw new Error(`🔒 **${j.name}** requires Level **${j.minLevel}** and **${j.minShifts}** completed shifts.`);if(u.shift)throw new Error('Finish your active work mini-job first.');u.job=id;u.workStreak=0;store.save();return j;}
function resign(u){if(!u.job)throw new Error('You do not currently have a job.');if(u.shift)throw new Error('Finish your active work mini-job before resigning.');const old=getJob(u.job);u.job=null;u.workStreak=0;store.save();return old;}
function list(u,page=1,perPage=4){const pages=Math.max(1,Math.ceil(jobs.length/perPage));page=Math.max(1,Math.min(pages,Number(page)||1));return{page,pages,items:jobs.slice((page-1)*perPage,page*perPage)};}
function autocomplete(u,input){const q=String(input||'').toLowerCase().trim();return jobs.filter(j=>!q||j.name.toLowerCase().includes(q)||j.id.toLowerCase().includes(q)).sort((a,b)=>Number(eligible(u,b))-Number(eligible(u,a))||a.minShifts-b.minShifts).slice(0,25);}
function upcoming(u,count=5){return jobs.filter(j=>!eligible(u,j)).sort((a,b)=>a.minShifts-b.minShifts||a.minLevel-b.minLevel).slice(0,count)}
function history(u,page=1,perPage=8){const all=u.workHistory||[],pages=Math.max(1,Math.ceil(all.length/perPage));page=Math.max(1,Math.min(pages,Number(page)||1));return{page,pages,items:all.slice((page-1)*perPage,page*perPage)}}
async function notifierTick(client){
  const snap=store.snapshot();let dirty=false;const now=Date.now();
  for(const [guildId,users] of Object.entries(snap.users||{}))for(const [userId,data] of Object.entries(users||{})){
    if(!data.workNotifyPending||Number(data.workNotifyAt||0)>now)continue;
    const u=store.user(guildId,userId);u.workNotifyPending=false;u.workLastNotifyAt=now;dirty=true;
    if(u.workDmEnabled===false)continue;
    const job=getJob(u.job),guild=client.guilds.cache.get(guildId);
    try{const user=await client.users.fetch(userId);await user.send({embeds:[require('./ui.ts').premiumEmbed('💼 Your Astrix Shift Is Ready',`Your **15-minute cooldown** is over.\n\nCareer: **${job?`${job.emoji} ${job.name}`:'No active career'}**\nCompleted shifts: **${u.shifts||0}**\nLevel: **${u.level||1}**${job?`\nSalary range: **${Number(job.salaryMin).toLocaleString()}–${Number(job.salaryMax).toLocaleString()} coins**`:''}\nServer: **${guild?.name||'Your Discord server'}**\n\nUse **/work shift** when you are ready.`)]});}catch{}
  }
  if(dirty)store.save();
}
function startNotifier(client){notifierTick(client).catch(()=>{});const timer=setInterval(()=>notifierTick(client).catch(e=>console.error('Work notifier:',e.message)),30000);timer.unref?.();return timer;}
module.exports={jobs,miniJobs,getJob,eligible,ensureJob,start,complete,cancel,apply,resign,list,autocomplete,upcoming,history,normalizeDaily,startNotifier,COOLDOWN_MS};
