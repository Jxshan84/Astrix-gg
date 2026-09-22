const presetNames = [
  'Bass Boost', 'Deep Bass', 'Bass Punch', 'Bass Boost Pro', 'Ultra Bass',
  'Subwoofer', 'Deep Low', 'Warm Bass', 'Mids Boost', 'Midnight',
  'Treble', 'Treble Boost', 'Ultra Treble', 'Bright', 'Crystal Clear',
  'Hi-Fi', 'Studio', 'Studio Pro', 'Concert', 'Live',
  'Club', 'Festival', 'EDM', 'Hip-Hop', 'Trap', 'Rap', 'Rock', 'Metal',
  'Jazz', 'Blues', 'R&B', 'Pop', 'Classical', 'Lo-Fi', 'Acoustic', 'Piano',
  'Guitar', 'Drum Boost', 'Cinematic', 'Movie',
  'Gaming', 'FPS', 'Podcast', 'Speech', 'Vocal', 'Vocal Boost', 'Clear Voice',
  'Voice Boost', 'Voice Clarity', 'Karaoke', 'Loudness', 'Soft', 'Flat', 'Radio',
  'Nightcore', 'Daycore', 'Vaporwave', 'Slow + Reverb', 'Speed Up', 'Pitch Up',
  'Pitch Down', 'Deep Voice', 'High Voice', 'Demon Voice', 'Chipmunk',
  'Robot Voice', 'Alien Voice', 'Echo', 'Reverb', 'Chorus', 'Flanger', 'Phaser',
  'Tremolo', 'Distortion', 'Telephone',
  '8D', '8D Pro', '3D Audio', '3D Surround', '360 Audio', 'Wide Stereo',
  'Ultra Wide', 'Spatial Audio', 'Surround', 'Surround Pro', 'Cinema Surround',
  'Astrix Ultra', 'Astrix Bass', 'Astrix Crystal', 'Astrix Studio', 'Astrix Club',
  'Astrix Cinema', 'Astrix Immersive', 'Astrix Ultra HD', 'Astrix Signature',
  'Astrix Supreme', 'Party', 'Warm', 'Dynamic', 'Ultra HD'
];

const categories = [
  { value: 'cat_reset', label: 'Normal / Reset EQ', emoji: '✨', presets: [] },
  { value: 'cat_bass_treble', label: 'Bass & Treble Suite', emoji: '🔊', presets: presetNames.slice(0, 20) },
  { value: 'cat_genres', label: 'Music Genres & Ambiance', emoji: '🎸', presets: presetNames.slice(20, 40) },
  { value: 'cat_vocals', label: 'Vocal, Podcast & Clarity', emoji: '🎙️', presets: presetNames.slice(40, 54) },
  { value: 'cat_modulators', label: 'Pitch, Speeds & Modulators', emoji: '⚡', presets: presetNames.slice(54, 75) },
  { value: 'cat_spatial', label: '8D, 3D & Spatial Audio', emoji: '🌀', presets: presetNames.slice(75, 86) },
  { value: 'cat_astrix', label: 'Astrix Exclusive Signatures', emoji: '👑', presets: presetNames.slice(86, 100) }
];

function slug(value: string) {
  return String(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

const presets = Object.fromEntries([
  ['clear', { label: 'Normal / Reset EQ', value: 'clear', category: 'cat_reset' }],
  ...presetNames.map((label, index) => [
    slug(label),
    { label, value: slug(label), category: categories.find(category => category.presets.includes(label))?.value || 'cat_astrix', index }
  ])
]);

function equalizer(gains: number[]) {
  // LavaShark's Filters.set() converts this numeric array into Lavalink's
  // { band, gain } representation when it sends the REST payload.
  return gains.map(gain => Math.max(-0.25, Math.min(1, Number(gain) || 0)));
}

function payloadFor(label: string) {
  const name = String(label || '').toLowerCase();
  if (name === 'normal / reset eq' || name === 'clear') return {};

  if (name.includes('nightcore') || name.includes('speed up') || name === 'high voice') {
    return { timescale: { speed: 1.18, pitch: 1.18, rate: 1 } };
  }
  if (name.includes('daycore') || name.includes('deep voice') || name.includes('slow + reverb')) {
    return { timescale: { speed: 0.86, pitch: 0.86, rate: 1 }, lowPass: { smoothing: 12 } };
  }
  if (name.includes('pitch up') || name.includes('chipmunk')) {
    return { timescale: { speed: 1, pitch: 1.3, rate: 1 } };
  }
  if (name.includes('pitch down') || name.includes('demon voice')) {
    return { timescale: { speed: 1, pitch: 0.72, rate: 1 } };
  }
  if (name === '8d' || name.includes('8d pro')) {
    return { rotation: { rotationHz: name.includes('pro') ? 0.28 : 0.2 } };
  }
  if (name.includes('3d') || name.includes('360') || name.includes('spatial') || name.includes('surround')) {
    return { channelMix: { leftToLeft: 0.85, leftToRight: 0.15, rightToLeft: 0.15, rightToRight: 0.85 } };
  }
  if (name.includes('wide') || name.includes('cinema')) {
    return { channelMix: { leftToLeft: 1, leftToRight: 0.28, rightToLeft: 0.28, rightToRight: 1 } };
  }
  if (name.includes('tremolo')) return { tremolo: { frequency: 4, depth: 0.65 } };
  if (name.includes('vibrato')) return { vibrato: { frequency: 4, depth: 0.55 } };
  if (name.includes('flanger')) return { timescale: { speed: 1.02, pitch: 1, rate: 1.02 }, rotation: { rotationHz: 0.08 } };
  if (name.includes('phaser')) return { rotation: { rotationHz: 0.12 } };
  if (name.includes('telephone')) return { lowPass: { smoothing: 8 }, equalizer: equalizer([0, 0, 0, 0, -0.08, -0.12, -0.18, -0.2, -0.2, -0.2, -0.18, -0.12, 0, 0, 0]) };
  if (name.includes('karaoke')) return { karaoke: { level: 1, monoLevel: 0, filterBand: 220, filterWidth: 100 } };
  if (name.includes('echo') || name.includes('reverb')) return { lowPass: { smoothing: 18 }, timescale: { speed: 0.98, pitch: 1, rate: 1 } };
  if (name.includes('distortion')) return { distortion: { sinOffset: 0, sinScale: 1, cosOffset: 0, cosScale: 1.15, tanOffset: 0, tanScale: 1, offset: 0, scale: 1 } };

  const gains = Array(15).fill(0);
  if (name.includes('bass') || name.includes('subwoofer') || name.includes('low') || name.includes('drum')) {
    gains.splice(0, 6, 0.22, 0.2, 0.17, 0.12, 0.08, 0.04);
  }
  if (name.includes('treble') || name.includes('bright') || name.includes('crystal') || name.includes('clarity') || name.includes('clear')) {
    gains.splice(8, 7, 0.03, 0.06, 0.1, 0.14, 0.17, 0.2, 0.22);
  }
  if (name.includes('vocal') || name.includes('speech') || name.includes('podcast')) {
    gains.splice(4, 6, 0.02, 0.08, 0.14, 0.16, 0.12, 0.06);
  }
  if (name.includes('soft')) gains.splice(0, 15, -0.06, -0.05, -0.04, -0.03, -0.02, -0.01, 0, 0, -0.01, -0.02, -0.03, -0.04, -0.05, -0.06, -0.08);
  if (name.includes('loudness') || name.includes('party') || name.includes('festival') || name.includes('club')) {
    gains.splice(0, 15, 0.12, 0.1, 0.08, 0.05, 0.02, 0, -0.01, 0, 0.02, 0.05, 0.08, 0.1, 0.12, 0.14, 0.15);
  }
  if (name.includes('flat')) return { equalizer: equalizer(Array(15).fill(0)) };
  if (name.includes('night') || name.includes('midnight')) gains.splice(0, 15, 0.12, 0.1, 0.08, 0.04, 0, -0.03, -0.04, -0.03, 0.01, 0.05, 0.08, 0.1, 0.12, 0.12, 0.1);
  return { equalizer: equalizer(gains) };
}

function categoryFor(value: string) {
  return categories.find(category => category.value === value) || categories[0];
}

function presetFor(value: string) {
  const aliases: Record<string, string> = {
    'full-bass': 'bass_boost',
    'hall-reverb': 'reverb',
    '8d-audio': '8d',
    nightcore: 'nightcore',
    clear: 'clear'
  };
  const raw = String(value || '').replace(/^preset:/, '').toLowerCase();
  const normalized = aliases[raw] || raw;
  return Object.values(presets).find((preset: any) => preset.value === normalized || slug(preset.label) === normalized)
    || Object.values(presets).find((preset: any) => preset.label.toLowerCase() === normalized)
    || null;
}

module.exports = { presetNames, categories, presets, categoryFor, presetFor, payloadFor, slug };