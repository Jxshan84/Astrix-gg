const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const specs = require(path.join(projectRoot, 'data', 'commands.json'));
const { buildGlobalCommandSet, getGuildOnlyCommands } = require(path.join(projectRoot, 'register.ts'));

let ok = true;

function validName(name) {
  return /^[a-z0-9_-]{1,32}$/.test(String(name || ''));
}

function checkOptions(options, route) {
  let optionalSeen = false;
  for (const option of options || []) {
    if (option.type === 1 || option.type === 2) {
      checkOptions(option.options || [], `${route}/${option.name}`);
      continue;
    }

    if (option.required) {
      if (optionalSeen) {
        console.error(`Required option appears after an optional option: ${route}/${option.name}`);
        ok = false;
      }
    } else {
      optionalSeen = true;
    }

    if (option.autocomplete && Array.isArray(option.choices) && option.choices.length) {
      console.error(`Autocomplete and choices cannot both be enabled: ${route}/${option.name}`);
      ok = false;
    }
  }
}

const specNames = new Set();
for (const spec of specs) {
  if (specNames.has(spec.name)) {
    console.error('Duplicate core command:', spec.name);
    ok = false;
  }
  specNames.add(spec.name);

  if (!validName(spec.name)) {
    console.error('Invalid core command name:', spec.name);
    ok = false;
  }

  if (Array.isArray(spec.subcommands)) {
    if (spec.subcommands.length > 25) {
      console.error('Too many subcommands:', spec.name, spec.subcommands.length);
      ok = false;
    }

    const subNames = new Set();
    for (const sub of spec.subcommands) {
      if (subNames.has(sub.name)) {
        console.error('Duplicate subcommand:', spec.name, sub.name);
        ok = false;
      }
      subNames.add(sub.name);

      if (!validName(sub.name)) {
        console.error('Invalid subcommand name:', spec.name, sub.name);
        ok = false;
      }

      if ((sub.options || []).length > 25) {
        console.error('Too many subcommand options:', spec.name, sub.name, (sub.options || []).length);
        ok = false;
      }
    }
  }
}

let globalCommands = [];
try {
  globalCommands = buildGlobalCommandSet();
} catch (error) {
  console.error('Global command build failed:', error.message);
  ok = false;
}

const globalNames = new Set();
for (const command of globalCommands) {
  if (globalNames.has(command.name)) {
    console.error('Duplicate registered global command:', command.name);
    ok = false;
  }
  globalNames.add(command.name);

  if (!validName(command.name)) {
    console.error('Invalid registered global command name:', command.name);
    ok = false;
  }

  checkOptions(command.options || [], `/${command.name}`);
}

let guildOnlyCommands = [];
try {
  guildOnlyCommands = getGuildOnlyCommands();
} catch (error) {
  console.error('Guild command build failed:', error.message);
  ok = false;
}

function checkNoGlobalSubcommandDuplicates(commands) {
  for (const command of commands) {
    for (const option of command.options || []) {
      if ((option.type === 1 || option.type === 2) && globalNames.has(option.name)) {
        console.error('Duplicate global/subcommand registration:', command.name, option.name);
        ok = false;
      }
      if (option.type === 2) {
        for (const child of option.options || []) {
          if ((child.type === 1 || child.type === 2) && globalNames.has(child.name)) {
            console.error('Duplicate global/nested subcommand registration:', command.name, child.name);
            ok = false;
          }
        }
      }
    }
  }
}

checkNoGlobalSubcommandDuplicates([...globalCommands, ...guildOnlyCommands]);

if (globalCommands.length > 100) {
  console.error(`Discord global command limit exceeded: ${globalCommands.length}/100`);
  ok = false;
}

const runtimeExt = path.extname(__filename) === '.js' ? '.js' : '.ts';
const requiredFiles = [
  `index${runtimeExt}`,
  `register${runtimeExt}`,
  `router${runtimeExt}`,
  `commands${runtimeExt}`,
  `extendedCommands${runtimeExt}`,
  `services/store${runtimeExt}`,
  `services/economy${runtimeExt}`,
  `services/shop${runtimeExt}`,
  `services/ai${runtimeExt}`,
  `services/music${runtimeExt}`,
  `services/recording${runtimeExt}`,
  `services/security${runtimeExt}`,
  `services/moderation${runtimeExt}`,
  `services/jobs${runtimeExt}`,
  `services/tickets${runtimeExt}`,
  `services/giveaway${runtimeExt}`,
  `services/prefix${runtimeExt}`,
  `services/autorespond${runtimeExt}`,
  `services/premium${runtimeExt}`,
  `services/fun${runtimeExt}`,
  `services/adventure${runtimeExt}`,
  'data/free-shop.json',
  'data/premium-shop.json',
  'data/xp-shop.json',
  'data/crate-items.json',
  'data/jobs.json',
  'data/work-mini-jobs.json'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(projectRoot, file))) {
    console.error('Missing required project file:', file);
    ok = false;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

for (const file of walk(projectRoot)) {
  if (!/\.json$/i.test(file)) continue;
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('Invalid JSON:', path.relative(projectRoot, file), error.message);
    ok = false;
  }
}

const ticket = globalCommands.find(command => command.name === 'ticket');
const record = globalCommands.find(command => command.name === 'record');
const work = globalCommands.find(command => command.name === 'work');

console.log(`Registered global command count: ${globalCommands.length}/100`);
console.log(`Unique registered command names: ${globalNames.size}`);
console.log(`Ticket subcommands: ${ticket?.options?.length || 0}/25`);
console.log(`Recording subcommands: ${record?.options?.length || 0}/25`);
console.log(`Work subcommands: ${work?.options?.length || 0}/25`);

if (!ok) process.exit(1);
console.log('Astrix project structure and command validation passed.');
