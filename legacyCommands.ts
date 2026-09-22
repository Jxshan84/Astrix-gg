const stringOption = (name, description, required = true, max = 500) => ({
  name, description, type: 'string', required, max
});
const integerOption = (name, description, required = true, min = undefined, max = undefined) => ({
  name, description, type: 'integer', required, ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max })
});
const userOption = (name = 'user', description = 'User to inspect', required = true) => ({
  name, description, type: 'user', required
});
const channelOption = (name = 'channel', description = 'Channel to inspect', required = false) => ({
  name, description, type: 'channel', required
});
const roleOption = (name = 'role', description = 'Role to manage', required = true) => ({
  name, description, type: 'role', required
});

const specs = [
  {
    name: 'advice', description: 'Get a random piece of practical advice.', options: []
  },
  {
    name: 'flip', description: 'Flip a coin.', options: []
  },
  {
    name: 'meme', description: 'Show a random safe meme.', options: []
  },
  {
    name: 'pokemon', description: 'Get information about a Pokémon.',
    options: [stringOption('pokemon', 'Pokémon name or number')]
  },
  {
    name: 'random', description: 'Generate a random number between two limits.',
    options: [
      integerOption('low', 'Lowest possible number', true),
      integerOption('high', 'Highest possible number', true)
    ]
  },
  {
    name: 'reminder', description: 'Set a reminder in this server.',
    options: [
      stringOption('time', 'Duration such as 10m, 2h, or 1d'),
      stringOption('information', 'What to remind you about')
    ]
  },
  {
    name: 'screenshot', description: 'Create a safe webpage screenshot link.',
    options: [stringOption('url', 'Public http(s) URL')]
  },
  {
    name: 'urban', description: 'Look up a word in Urban Dictionary.',
    options: [stringOption('word', 'Word to look up')]
  },
  {
    name: 'docs', description: 'Open Discord.js documentation for a query.',
    options: [stringOption('query', 'Documentation query')]
  },
  {
    name: 'eval', description: 'Owner-only safe JavaScript expression evaluator.',
    options: [stringOption('code', 'Expression to evaluate', true, 1000)]
  },
  {
    name: 'lavalink', description: 'View Astrix music node status.',
    options: [stringOption('action', 'Use host or list', false, 20)]
  },
  {
    name: 'node', description: 'Owner-only Lavalink node status helper.',
    options: [
      stringOption('action', 'Use add, remove, or list'),
      stringOption('host', 'Node host or identifier', false, 200),
      stringOption('password', 'Node password', false, 200),
      integerOption('port', 'Node port', false, 1, 65535)
    ]
  },
  {
    name: 'reload', description: 'Owner-only reload status command.',
    options: [stringOption('target', 'Command or event name')]
  },
  {
    name: 'script', description: 'Owner-only script compatibility helper.',
    options: [
      stringOption('file', 'Script name'),
      stringOption('params', 'Optional script parameters', false, 500)
    ]
  },
  {
    name: 'shutdown', description: 'Owner-only graceful bot shutdown.',
    options: []
  },
  {
    name: 'suggestion', description: 'Submit a suggestion for Astrix.',
    options: [
      stringOption('title', 'Suggestion title', true, 150),
      stringOption('description', 'Suggestion details', true, 1000),
      stringOption('plugin', 'Related feature or plugin', false, 100)
    ]
  },
  {
    name: 'test', description: 'Show a compact list of working compatibility commands.',
    options: [stringOption('command', 'Optional command to inspect', false, 50)]
  },
  {
    name: 'user', description: 'Owner-only view of stored user data.',
    options: [stringOption('id', 'Discord user ID')]
  },
  {
    name: 'dashboard', description: 'Show the Astrix dashboard link.',
    options: []
  },
  {
    name: 'discrim', description: 'Find members with a legacy discriminator.',
    options: [stringOption('discriminator', 'Four-digit discriminator', false, 4)]
  },
  {
    name: 'emoji-list', description: 'List this server’s custom emojis.',
    options: []
  },
  {
    name: 'firstmessage', description: 'Find the first available message in a channel.',
    options: [channelOption()]
  },
  {
    name: 'guildicon', description: 'Show this server’s icon.',
    options: []
  },
  {
    name: 'poll', description: 'Create a simple reaction poll.',
    options: [stringOption('question', 'Poll question', true, 1000)]
  },
  {
    name: 'blurpify', description: 'Create a safe blurpify image link.',
    options: [channelOption('file', 'Image attachment channel', false)]
  },
  {
    name: 'captcha', description: 'Create a simple text captcha challenge.',
    options: []
  },
  {
    name: 'cat', description: 'Show a safe cat image.', options: []
  },
  {
    name: 'changemymind', description: 'Create a change-my-mind image link.',
    options: [stringOption('text', 'Statement', true, 300)]
  },
  {
    name: 'clyde', description: 'Create a safe fake Clyde message preview.',
    options: [stringOption('text', 'Message text', true, 500)]
  },
  {
    name: 'deepfry', description: 'Create a safe deep-fry image link.',
    options: []
  },
  {
    name: 'dog', description: 'Show a safe dog image.', options: []
  },
  {
    name: 'image', description: 'Find a safe image search link.',
    options: [stringOption('topic', 'Image topic')]
  },
  {
    name: 'qrcode', description: 'Create a QR code for text or a URL.',
    options: [stringOption('text', 'Text or URL to encode', true, 1000)]
  },
  {
    name: 'stickbug', description: 'Create a safe stickbug image link.',
    options: []
  },
  {
    name: 'threats', description: 'Create a safe meme image link.',
    options: []
  },
  {
    name: 'twitter', description: 'Create a safe fake tweet preview.',
    options: [stringOption('text', 'Tweet text', true, 500), userOption('user', 'Optional displayed author', false)]
  },
  {
    name: 'whowouldwin', description: 'Create a lighthearted matchup result.',
    options: [userOption('user1', 'First user'), userOption('user2', 'Second user', false)]
  },
  {
    name: 'rank', description: 'Show your Astrix XP rank.',
    options: [userOption('user', 'User to inspect', false)]
  },
  {
    name: 'addrole', description: 'Create a server role.',
    options: [
      stringOption('name', 'Role name', true, 100),
      stringOption('color', 'Hex color such as #5865f2', false, 20),
      { name: 'hoist', description: 'Display members separately', type: 'boolean', required: false }
    ]
  },
  {
    name: 'clear', description: 'Delete recent messages from this channel.',
    options: [integerOption('amount', 'Number of messages', true, 1, 100)]
  },
  {
    name: 'clear-warning', description: 'Clear all warnings from a member.',
    options: [userOption()]
  },
  {
    name: 'deafen', description: 'Server-deafen a member.',
    options: [userOption()]
  },
  {
    name: 'delrole', description: 'Delete a server role.',
    options: [roleOption()]
  },
  {
    name: 'dm', description: 'Send a direct message to a member.',
    options: [userOption(), stringOption('message', 'Message to send', true, 1500)]
  },
  {
    name: 'editrole', description: 'Edit a server role.',
    options: [
      roleOption(),
      stringOption('option', 'Use name, color, hoist, or mentionable'),
      stringOption('value', 'New value', true, 100)
    ]
  },
  {
    name: 'undeafen', description: 'Remove a server deafen from a member.',
    options: [userOption()]
  },
  {
    name: 'about', description: 'Show information about Astrix.', options: []
  },
  {
    name: 'invite', description: 'Show an invite link for Astrix.', options: []
  },
  {
    name: 'privacy', description: 'Show Astrix privacy information.', options: []
  },
  {
    name: 'shorturl', description: 'Create a short URL using TinyURL.',
    options: [stringOption('url', 'URL to shorten')]
  },
  {
    name: 'support', description: 'Show Astrix support information.', options: []
  },
  {
    name: '247', description: 'Show instructions for Premium 24/7 music.', options: []
  },
  {
    name: 'back', description: 'Play the previous music track.', options: []
  },
  {
    name: 'bassboost', description: 'Show music bass boost compatibility status.',
    options: [integerOption('value', 'Bass boost level 0-100', false, 0, 100)]
  },
  {
    name: 'dc', description: 'Disconnect Astrix from voice.', options: []
  },
  {
    name: 'fast-forward', description: 'Fast-forward the current track.',
    options: [stringOption('time', 'Time such as 30s or 2m')]
  },
  {
    name: 'join', description: 'Join your current voice channel.', options: []
  },
  {
    name: 'lyrics', description: 'Find lyrics for a song.',
    options: [stringOption('song', 'Song title', false, 200)]
  },
  {
    name: 'nightcore', description: 'Toggle nightcore compatibility mode.', options: []
  },
  {
    name: 'np', description: 'Show the currently playing song.', options: []
  },
  {
    name: 'p-add', description: 'Add a song to a saved playlist.',
    options: [stringOption('playlist', 'Playlist name'), stringOption('song', 'Song or URL')]
  },
  {
    name: 'p-create', description: 'Create a saved playlist.',
    options: [stringOption('playlist', 'Playlist name'), stringOption('song', 'First song or URL')]
  },
  {
    name: 'p-delete', description: 'Delete a saved playlist.',
    options: [stringOption('playlist', 'Playlist name')]
  },
  {
    name: 'p-load', description: 'Load a saved playlist.',
    options: [stringOption('playlist', 'Playlist name')]
  },
  {
    name: 'p-remove', description: 'Remove a song from a saved playlist.',
    options: [stringOption('playlist', 'Playlist name'), integerOption('position', 'Track position', true, 1)]
  },
  {
    name: 'p-view', description: 'View a saved playlist.',
    options: [stringOption('playlist', 'Playlist name')]
  },
  {
    name: 'pitch', description: 'Show pitch compatibility status.',
    options: [stringOption('value', 'Pitch value or reset', false, 30)]
  },
  {
    name: 'previous', description: 'Return to the previous music track.',
    options: []
  },
  {
    name: 'radio', description: 'Start music from a radio search.',
    options: [stringOption('query', 'Radio or station query')]
  },
  {
    name: 'rewind', description: 'Rewind the current track.',
    options: [stringOption('time', 'Time such as 30s or 2m')]
  },
  {
    name: 'seek', description: 'Seek within the current track.',
    options: [stringOption('time', 'Position such as 1m30s')]
  },
  {
    name: 'shuffle', description: 'Shuffle the current music queue.', options: []
  },
  {
    name: 'speed', description: 'Show playback speed compatibility status.',
    options: [integerOption('value', 'Playback speed percentage', true, 25, 200)]
  },
  {
    name: 'vaporwave', description: 'Toggle vaporwave compatibility mode.', options: []
  },
  {
    name: 'rr-add', description: 'Show reaction-role setup instructions.',
    options: [stringOption('message', 'Message ID or message link', false, 300)]
  },
  {
    name: 'rr-remove', description: 'Show reaction-role removal instructions.',
    options: [stringOption('message', 'Message link or ID')]
  },
  {
    name: 'set-lang', description: 'Set the server language label.',
    options: [stringOption('language', 'Language code such as en or hi')]
  },
  {
    name: 'set-logs', description: 'Configure the Astrix log channel.',
    options: [channelOption('channel', 'Log channel', true)]
  },
  {
    name: 'set-plugin', description: 'Enable or disable a server plugin label.',
    options: [
      stringOption('plugin', 'Plugin name'),
      { name: 'enabled', description: 'Whether the plugin is enabled', type: 'boolean', required: true }
    ]
  },
  {
    name: 'fortnite', description: 'Open a Fortnite player lookup.',
    options: [stringOption('platform', 'Platform such as kbm, gamepad, or touch'), stringOption('user', 'Epic username')]
  },
  {
    name: 'instagram', description: 'Open an Instagram profile lookup.',
    options: [stringOption('user', 'Instagram username')]
  },
  {
    name: 'mc', description: 'Check a Minecraft server.',
    options: [stringOption('ip', 'Minecraft server address'), integerOption('port', 'Server port', false, 1, 65535)]
  },
  {
    name: 'r6', description: 'Open a Rainbow Six player lookup.',
    options: [
      stringOption('user', 'Rainbow Six username'),
      stringOption('platform', 'pc, xbox, or ps4', false, 20),
      stringOption('region', 'eu, na, or as', false, 20)
    ]
  },
  {
    name: 'reddit', description: 'Show a safe post from a subreddit.',
    options: [stringOption('subreddit', 'Subreddit name')]
  },
  {
    name: 'steam', description: 'Open a Steam player lookup.',
    options: [stringOption('user', 'Steam username or profile')]
  },
  {
    name: 'twitch', description: 'Open a Twitch channel lookup.',
    options: [stringOption('user', 'Twitch username')]
  },
  {
    name: 'weather', description: 'Look up current weather.',
    options: [stringOption('location', 'City or location')]
  },
  {
    name: 'tag-add', description: 'Create a server tag.',
    options: [stringOption('name', 'Tag name', true, 32), stringOption('response', 'Tag response', true, 1000)]
  },
  {
    name: 'tag-delete', description: 'Delete a server tag.',
    options: [stringOption('name', 'Tag name', true, 32)]
  },
  {
    name: 'tag-edit', description: 'Edit or rename a server tag.',
    options: [
      stringOption('action', 'Use rename or edit'),
      stringOption('name', 'Existing tag name', true, 32),
      stringOption('value', 'New name or response', true, 1000)
    ]
  },
  {
    name: 'tag-view', description: 'View a server tag.',
    options: [stringOption('name', 'Optional tag name', false, 32)]
  },
  {
    name: 'tags', description: 'List server tags.', options: []
  }
];

const LEGACY_GROUPS = {
  'legacy-fun': ['advice', 'flip', 'meme', 'pokemon', 'random', 'reminder', 'screenshot', 'urban'],
  'legacy-host': ['docs', 'eval', 'lavalink', 'node', 'reload', 'script', 'shutdown', 'suggestion', 'test', 'user'],
  'legacy-guild': ['dashboard', 'discrim', 'emoji-list', 'firstmessage', 'guildicon', 'poll'],
  'legacy-image': ['blurpify', 'captcha', 'cat', 'changemymind', 'clyde', 'deepfry', 'dog', 'image', 'qrcode', 'stickbug', 'threats', 'twitter', 'whowouldwin'],
  'legacy-level': ['rank'],
  'legacy-moderation': ['addrole', 'clear-warning', 'clear', 'deafen', 'delrole', 'dm', 'editrole', 'undeafen'],
  'legacy-misc': ['about', 'invite', 'privacy', 'shorturl', 'support'],
  'legacy-music': ['247', 'back', 'bassboost', 'dc', 'fast-forward', 'join', 'lyrics', 'nightcore', 'np', 'p-add', 'p-create', 'p-delete', 'p-load', 'p-remove', 'p-view', 'pitch', 'previous', 'radio', 'rewind', 'seek', 'shuffle', 'speed', 'vaporwave'],
  'legacy-plugins': ['rr-add', 'rr-remove', 'set-lang', 'set-logs', 'set-plugin'],
  'legacy-search': ['fortnite', 'instagram', 'mc', 'r6', 'reddit', 'steam', 'twitch', 'weather'],
  'legacy-tags': ['tag-add', 'tag-delete', 'tag-edit', 'tag-view', 'tags']
};

const LEGACY_COMMAND_NAMES = new Set(specs.map(spec => spec.name));

module.exports = { specs, LEGACY_GROUPS, LEGACY_COMMAND_NAMES };