// KanjiVG variants (a/b/v) and slash alternatives retain the base stroke type.
// These types end in a hook; a plain bend such as ㇗ does not require one.
export function hasHook(type){return String(type).split('/').some(t=>/^[㇁㇂㇃㇆㇈㇉㇚㇙㇟㇖㇠]/u.test(t));}
