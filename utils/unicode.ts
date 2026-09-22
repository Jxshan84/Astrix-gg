const BOLD_UPPER = Array.from('𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭');
const BOLD_LOWER = Array.from('𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇');
const BOLD_DIGITS = Array.from('𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵');
const SMALL_CAPS: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'ˣ', y: 'ʏ', z: 'ᴢ'
};
function boldSans(input: unknown) {
  return Array.from(String(input ?? '')).map(character => {
    if (character >= 'A' && character <= 'Z') return BOLD_UPPER[character.charCodeAt(0) - 65];
    if (character >= 'a' && character <= 'z') return BOLD_LOWER[character.charCodeAt(0) - 97];
    if (character >= '0' && character <= '9') return BOLD_DIGITS[character.charCodeAt(0) - 48];
    return character;
  }).join('');
}
function smallCaps(input: unknown) {
  return Array.from(String(input ?? '')).map(c => SMALL_CAPS[c.toLowerCase()] || c).join('');
}
function styledTitle(input: unknown) {
  return boldSans(String(input ?? '').replace(/\s+/g, ' ').trim());
}
module.exports = { boldSans, smallCaps, styledTitle };