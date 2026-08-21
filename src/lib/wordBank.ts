export const COMMON_WORDS: string[] = [
  'focus', 'tempo', 'cloud', 'swift', 'pilot', 'spark', 'orbit', 'prism', 'cyber', 'pulse',
  'flame', 'hyper', 'matrix', 'vector', 'stream', 'quantum', 'beacon', 'rocket', 'sphere',
  'galaxy', 'stellar', 'dynamo', 'glider', 'breeze', 'pixel', 'signal', 'zenith', 'plasma',
  'vertex', 'cosmic', 'falcon', 'meteor', 'shadow', 'cipher', 'echo', 'frost', 'gravity',
  'horizon', 'laser', 'nexus', 'optics', 'quartz', 'radar', 'sonic', 'turbo', 'vapor',
  'voyage', 'whisper', 'alpha', 'delta', 'omega', 'solaris', 'strata', 'astral',
  'ignite', 'lumina', 'motion', 'vortex', 'radiant', 'nebula', 'photon', 'surge', 'titan',
  'energy', 'rhythm', 'galaxy', 'future', 'action', 'impact', 'charge', 'spirit', 'shield',
  'engine', 'silver', 'aurora', 'vertex', 'valley', 'symbol', 'vision', 'glory', 'bright',
  'stride', 'launch', 'castle', 'knight', 'island', 'jungle', 'planet', 'portal', 'zenith',
  'craft', 'force', 'storm', 'ocean', 'river', 'ember', 'solar', 'lunar', 'comet', 'flint'
];

export function getRandomWords(count = 50): string[] {
  const selected: string[] = [];
  const pool = [...COMMON_WORDS];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    selected.push(pool[randomIndex].toUpperCase());
  }
  return selected;
}
