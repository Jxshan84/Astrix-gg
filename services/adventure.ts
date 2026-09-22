const store = require('./store.ts');
const econ = require('./economy.ts');
const ui = require('./ui.ts');
const crates = require('./crates.ts');

const ANIMAL_SPECIES = [
  'Mouse', 'Rabbit', 'Fox', 'Panda', 'Lion', 'Dragon', 'Wolf', 'Tiger', 'Bear', 'Deer',
  'Elephant', 'Giraffe', 'Zebra', 'Leopard', 'Cheetah', 'Jaguar', 'Panther', 'Koala',
  'Kangaroo', 'Platypus', 'Otter', 'Beaver', 'Badger', 'Raccoon', 'Squirrel', 'Hedgehog',
  'Hamster', 'Chinchilla', 'Guinea Pig', 'Horse', 'Donkey', 'Camel', 'Alpaca', 'Llama',
  'Goat', 'Sheep', 'Pig', 'Cow', 'Buffalo', 'Bison', 'Moose', 'Elk', 'Reindeer', 'Yak',
  'Monkey', 'Gorilla', 'Chimpanzee', 'Orangutan', 'Lemur', 'Sloth', 'Anteater', 'Armadillo',
  'Porcupine', 'Opossum', 'Skunk', 'Mongoose', 'Meerkat', 'Hyena', 'Dingo', 'Coyote',
  'Crocodile', 'Alligator', 'Turtle', 'Tortoise', 'Iguana', 'Gecko', 'Chameleon', 'Python',
  'Cobra', 'Viper', 'Frog', 'Toad', 'Salamander', 'Axolotl', 'Eagle', 'Falcon', 'Hawk',
  'Owl', 'Parrot', 'Macaw', 'Penguin', 'Flamingo', 'Peacock', 'Swan', 'Duck', 'Goose',
  'Chicken', 'Rooster', 'Turkey', 'Ostrich', 'Emu', 'Pigeon', 'Raven', 'Crow', 'Sparrow',
  'Hummingbird', 'Kingfisher', 'Woodpecker', 'Pelican', 'Seagull', 'Albatross', 'Seal',
  'Walrus', 'Dolphin', 'Whale', 'Shark', 'Orca', 'Manatee', 'Dugong', 'Octopus', 'Squid',
  'Jellyfish', 'Crab', 'Lobster', 'Shrimp', 'Starfish', 'Seahorse', 'Pufferfish', 'Tuna',
  'Salmon', 'Trout', 'Koi', 'Eel', 'Stingray', 'Manta Ray', 'Butterfly', 'Moth', 'Bee',
  'Wasp', 'Ant', 'Beetle', 'Ladybug', 'Dragonfly', 'Grasshopper', 'Cricket', 'Firefly',
  'Spider', 'Scorpion', 'Snail', 'Slug', 'Worm', 'Centipede', 'Millipede', 'Mantis',
  'Cicada', 'Pangolin', 'Tapir', 'Okapi', 'Aardvark', 'Wombat', 'Numbat', 'Bilby',
  'Quokka', 'Kiwi', 'Cassowary', 'Narwhal', 'Blobfish', 'Coelacanth', 'Komodo Dragon'
];
const ANIMAL_TRAITS = [
  'Aurora', 'Midnight', 'Solar', 'Lunar', 'Crystal', 'Ember', 'Misty', 'Golden', 'Silver',
  'Ruby', 'Sapphire', 'Emerald', 'Obsidian', 'Pearl', 'Velvet', 'Neon', 'Shadow', 'Storm',
  'Thunder', 'Rainfall', 'Frost', 'Glacier', 'Cinder', 'Meadow', 'Forest', 'Desert',
  'Oceanic', 'Coral', 'Twilight', 'Starlit', 'Comet', 'Cosmic', 'Royal', 'Wild'
];
const ANIMAL_HABITATS = [
  'the Valley', 'the Tundra', 'the Rainforest', 'the Savannah', 'the Highlands',
  'the Moonlit Marsh', 'the Crystal Caves', 'the Coral Reef', 'the Misty Isles',
  'the Whispering Woods', 'the Golden Dunes', 'the Frozen Coast', 'the Hidden Grove',
  'the Thunder Plains', 'the Starlit Steppe', 'the Ember Peaks', 'the Azure Lagoon',
  'the Ancient Ruins', 'the Wild Orchard', 'the Silver Delta', 'the Cloud Forest',
  'the Sunken City', 'the Redwood Basin', 'the Night Garden', 'the Secret Meadow',
  'the Shimmering Shore', 'the Echo Canyon', 'the Sapphire Lake', 'the Mossy Hollow',
  'the Windy Cliffs', 'the Dreaming Desert', 'the Lantern Swamp'
];
const ANIMAL_EMOJIS = ['🐾', '🌿', '✨', '🌙', '🔥', '❄️', '💎', '🌊', '🍃', '⚡', '🌟', '🪶'];

function buildAnimalPool(): [string, string, number, number][] {
  const pool: [string, string, number, number][] = [
    ['🐭 Mouse', 'common', 45, 25],
    ['🐰 Rabbit', 'common', 40, 35],
    ['🦊 Fox', 'uncommon', 28, 80],
    ['🐼 Panda', 'rare', 15, 180],
    ['🦁 Lion', 'epic', 8, 450],
    ['🐉 Dragon', 'legendary', 2, 1500]
  ];
  const targetSize = 10048;
  for (let index = 0; pool.length < targetSize; index++) {
    const species = ANIMAL_SPECIES[index % ANIMAL_SPECIES.length];
    const trait = ANIMAL_TRAITS[Math.floor(index / ANIMAL_SPECIES.length) % ANIMAL_TRAITS.length];
    const habitat = ANIMAL_HABITATS[Math.floor(index / (ANIMAL_SPECIES.length * ANIMAL_TRAITS.length)) % ANIMAL_HABITATS.length];
    const emoji = ANIMAL_EMOJIS[index % ANIMAL_EMOJIS.length];
    const band = index % 100;
    const rarity: [string, number, number] = band < 55
      ? ['common', 45, 25]
      : band < 80
        ? ['uncommon', 28, 80]
        : band < 94
          ? ['rare', 15, 180]
          : band < 99
            ? ['epic', 8, 450]
            : ['legendary', 2, 1500];
    pool.push([
      `${emoji} ${trait} ${species} of ${habitat}`,
      rarity[0],
      rarity[1],
      rarity[2]
    ]);
  }
  return pool;
}

// Hunt has 10,048 unique collectible variants. The compact generator keeps
// the source maintainable while every generated entry remains a distinct,
// persistent inventory key.
const ANIMALS: [string, string, number, number][] = buildAnimalPool();
const DIG_ITEMS = [['🪨 Stone',45,20],['🪙 Old Coin',30,70],['💎 Crystal',18,180],['🏺 Ancient Relic',7,600]];
const FISH = [['🐟 Fish',45,35],['🐠 Tropical Fish',30,75],['🦈 Shark',8,400],['🐋 Mythic Whale Token',2,1200]];
const SEARCH_SPOTS = ['sofa','backpack','street','park','attic','drawer','arcade','library'];

function pickWeighted(list, weightIndex) {
  const total = list.reduce((n,x)=>n+x[weightIndex],0); let r=Math.random()*total;
  for (const x of list) { r-=x[weightIndex]; if (r<=0) return x; }
  return list[list.length-1];
}
function invAdd(u,id,n=1){u.inventory[id]=(u.inventory[id]||0)+n;}
function cd(u,key,ms){const rem=econ.cooldown(u,key,ms); if(rem){const e=new Error(`Try again <t:${Math.floor((Date.now()+rem)/1000)}:R>.`);throw e;}}
function rewardCoins(u,min,max){const amount=Math.floor(min+Math.random()*(max-min+1));return econ.creditCoins(u,amount).credited;}
function huntWeapon(u){
  const weapons = crates.WEAPON_LOOT || [];
  return weapons
    .map(weapon => ({ weapon, owned: Number(u.inventory?.[weapon.id] || 0) }))
    .filter(entry => entry.owned > 0)
    .sort((a,b) => b.weapon.power - a.weapon.power)[0]?.weapon || null;
}
function collectionLines(u){
  const rows=Object.entries(u.inventory).filter(([k,v])=>Number(v)>0&&(k.startsWith('animal:')||k.startsWith('dig:')||k.startsWith('fish:')))
    .sort((a,b)=>Number(b[1])-Number(a[1])).map(([k,v])=>`• **${k.split(':').slice(1).join(':')}** × ${v}`);
  const weapons=Object.entries(u.inventory).filter(([k,v])=>Number(v)>0&&k.startsWith('weapon_'))
    .map(([k,v])=>`• 🧰 **${k.replace(/^weapon_/,'').replace(/_/g,' ')}** × ${v}`);
  const all=[...weapons,...rows];
  return all.length?all.slice(0,30).join('\n'):'Your collection is empty. Try `hunt`, `dig` or `fish`.';
}
async function run(ctx, action){
  const u=store.user(ctx.guildId,ctx.user.id); let embed;
  if(action==='hunt'){
    cd(u,'adv_hunt',45000);
    const weapon=huntWeapon(u);
    const power=Number(weapon?.power||0);
    const huntPool=ANIMALS.map(([name,rarity,weight,value])=>[
      name, rarity, Number(weight) * (1 + power * (['epic','legendary'].includes(rarity) ? 0.09 : rarity === 'rare' ? 0.06 : 0.02)), Number(value)
    ]);
    const x=pickWeighted(huntPool,2);
    invAdd(u,`animal:${x[0]}`);
    u.quests ||= {};
    u.quests.hunt=Number(u.quests.hunt||0)+1;
    const coins=rewardCoins(u,15 + power * 4,x[3] + power * 30);
    const finds=[];
    if(Math.random() < 0.08) finds.push(`📦 You also found an **Astrix Lootbox**.`);
    if(Math.random() < 0.06) finds.push(`🧰 You also found a **Weapon Crate**.`);
    if(finds.some(text=>text.includes('Lootbox'))) crates.grant(u,'lootbox',1);
    if(finds.some(text=>text.includes('Weapon Crate'))) crates.grant(u,'weapon',1);
    store.save();
    embed=ui.embed('🌿 Astrix Hunt',`${ctx.user} found **${x[0]}**!\nRarity: **${x[1]}**${weapon?`\nWeapon used: **${weapon.emoji} ${weapon.name}** (power ${weapon.power})`:''}\nBonus: **${econ.fmt(coins)}**${finds.length?`\n\n${finds.join('\n')}`:''}`);
  } else if(action==='dig'){
    cd(u,'adv_dig',50000); const x=pickWeighted(DIG_ITEMS,1); invAdd(u,`dig:${x[0]}`); const coins=rewardCoins(u,10,x[2]); store.save();
    embed=ui.embed('⛏️ Astrix Dig',`You dug up **${x[0]}**!\nBonus: **${econ.fmt(coins)}**`);
  } else if(action==='fish'){
    cd(u,'adv_fish',55000); const x=pickWeighted(FISH,1); invAdd(u,`fish:${x[0]}`); const coins=rewardCoins(u,10,x[2]); store.save();
    embed=ui.embed('🎣 Astrix Fishing',`You caught **${x[0]}**!\nBonus: **${econ.fmt(coins)}**`);
  } else if(action==='beg'){
    cd(u,'adv_beg',30000); const coins=rewardCoins(u,20,180); store.save(); embed=ui.embed('🪙 Beg',coins?`A kind stranger gave you **${econ.fmt(coins)}**.`:'Nobody had spare coins this time.');
  } else if(action==='search'){
    cd(u,'adv_search',40000); const spot=SEARCH_SPOTS[Math.floor(Math.random()*SEARCH_SPOTS.length)],coins=rewardCoins(u,30,260); store.save(); embed=ui.embed('🔎 Search',`You searched the **${spot}** and found **${econ.fmt(coins)}**.`);
  } else if(action==='collection'){
    embed=ui.embed(`📚 ${ctx.user.username}'s Collection`,collectionLines(u));
  } else if(action==='quests'){
    const day=new Date().toISOString().slice(0,10); u.quests ||= {}; if(u.quests.day!==day)u.quests={day,hunt:0,work:0,claim:false}; store.save();
    embed=ui.embed('📜 Daily Quests',`🌿 Hunt collectibles: **${Math.min(u.quests.hunt||0,3)}/3**\n💼 Complete work shifts: **${Math.min(u.quests.work||0,2)}/2**\n\nQuest tracking expands as you use Astrix.`);
  } else if(action==='achievements'){
     const count=Object.entries(u.inventory).filter(([k,v])=>Number(v)>0&&(k.startsWith('animal:')||k.startsWith('dig:')||k.startsWith('fish:'))).length;
    const a=[u.level>=5?'🏅 Level 5 Explorer':null,u.shifts>=10?'💼 Dedicated Worker':null,count>=5?'📚 Collector I':null,(u.wallet+u.bank)>=50000?'💰 Coin Keeper':null].filter(Boolean);
    embed=ui.embed('🏆 Achievements',a.join('\n')||'No achievements unlocked yet. Keep exploring Astrix!');
  } else throw new Error('Unknown adventure action.');
  return ctx.reply({embeds:[embed],allowedMentions:{users: [...new Set([ctx.user.id].filter(Boolean))]}});
}
async function slash(i){return run({guildId:i.guildId,user:i.user,reply:p=>i.reply(p)},i.options.getSubcommand());}
async function prefix(message,action){return run({guildId:message.guild.id,user:message.author,reply:p=>message.reply(p)},action).then(()=>true);}
module.exports={run,slash,prefix,animalCount:ANIMALS.length};
