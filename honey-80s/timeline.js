// One timeline drives picture, subtitles, sound events and the score.
// Until the voiceover arrives, scene lengths are estimates; with the voice, SPANS (speech start/end per line,
// in seconds of the voice file) replace them and every cut is snapped to the beat grid.
export const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;

export const LINES = [
  { id: 'jar', text: 'Мёд может храниться тысячи лет!' },
  { id: 'tomb', text: 'Археологи находили мёд в древнеегипетских гробницах.' },
  { id: 'open', text: 'И он всё ещё не испортился.' },
  { id: 'water', text: 'Секрет в том, что в мёде очень мало воды.' },
  { id: 'bact', text: 'Бактериям просто негде жить.' },
  { id: 'acid', text: 'А ещё мёд кислый — это тоже защищает его.' },
  { id: 'bee', text: 'Пчёлы добавляют в мёд особый фермент…' },
  { id: 'shield', text: '…который не даёт микробам размножаться.' },
  { id: 'spoon', text: 'За всю жизнь одна пчела делает всего полчайной ложки мёда… нет, ещё меньше — около 1/12 ложки.' },
  { id: 'cryst', text: 'Если мёд засахарился — это нормально, он не испортился.' },
  { id: 'sub', text: 'Подписывайтесь на «Факты за минуту»!' },
];

// Voice spans [start, end] in the voice file (null = no voice yet → estimated from text length)
export const VOICE = [[0.0, 2.48], [2.80, 6.06], [6.36, 8.18], [8.56, 11.33], [11.62, 13.18], [13.55, 16.89], [17.24, 19.86], [19.89, 22.05], [22.46, 30.44], [30.85, 34.32], [34.69, 37.15]];
export const VOICE_OFFSET = 0.4;     // where the voice file starts in the film
export const NET_FRAC = 0.569;         // where «нет, ещё меньше» starts inside the spoon line (fraction of the line)

const snap = t => Math.round(t / BEAT) * BEAT;
function build() {
  const spans = VOICE || (() => {
    let t = 0; return LINES.map(l => { const d = l.text.length / 13.5; const s = [t, t + d]; t += d + 0.55; return s; });
  })();
  const on = spans.map(s => s[0] + VOICE_OFFSET);
  const starts = on.map((x, i) => i === 0 ? 0 : snap(x - 0.25));
  const end = snap(spans[spans.length - 1][1] + VOICE_OFFSET + 2.6);
  const SC = LINES.map((l, i) => ({ name: l.id, t0: starts[i], t1: i + 1 < starts.length ? starts[i + 1] : end }));
  const VO = LINES.map((l, i) => ({ id: l.id, text: l.text, t: spans[i][0] + VOICE_OFFSET, d: spans[i][1] - spans[i][0] }));
  return { SC, VO, DUR: end };
}
export const { SC, VO, DUR } = build();
export const sceneAt = t => SC.find(s => t >= s.t0 && t < s.t1) || SC[SC.length - 1];
export const S = Object.fromEntries(SC.map(s => [s.name, s]));
// key moments
export const T = {
  lidOpen: S.open.t0 + BEAT,                                         // one beat of silence before it
  net: VO[8].t + VO[8].d * NET_FRAC,                                     // the self-correction
  shieldHit: S.shield.t0 + BEAT * 2,
};
