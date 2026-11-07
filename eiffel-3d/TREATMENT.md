# «Эйфелева башня растёт летом» — cute 3D cartoon · treatment

Vertical 1080×1920, 30 fps, three.js rendered headless (Lemo-Opuscar render tools), Russian voice (ElevenLabs, arrives later) + subtitles + `.srt`. ~1.5–2 min.
Style asked by the user: cute 3D cartoon, bright colours, soft light, rounded shapes, playful. Not a library style: built on the library's pipeline (page = `render(t)`, headless capture, mux to −14 LUFS).

## Three candidate structures
1. **A list of 24 facts**, one shot each. Faithful but flat.
2. **The tower's biography (chosen):** physics today (summer/winter/sun/wind, one place in four "colour models") → how it was born (construction, 1889, its engineer) → the drama (hated, nearly dismantled, saved by radio) → its life now (record, rivets, paint, tourists) → bookend: "once a mistake" newspaper → sunset over the Seine.
3. **A day in the life** of the tower from dawn to night. Pretty, but the history half wouldn't fit.

## Arc and look
- Setup: summer tower, «ЛЕТОМ ВЫШЕ?!». Turn: the hated "mistake" saved by radio. Ending: sunset, the channel card.
- One procedural tower (≈1 000 instanced beams, arches, platforms) reused in every set; Paris ring of houses, trees, Seine, clouds; round toy-like people with big eyes (expressions: happy / angry / worried / wow).
- Seasons as lighting models: summer, winter (snow, blue dusk), storm, vintage 1880s (sepia grade), studio (engineer's desk, newspaper), sunset.
- Signature shots: winter vs summer twin towers with «+15 см»; the half-built tower growing out of the ground (clipping plane) with cranes; the Statue of Liberty with Eiffel's iron frame visible through it; the golden crown over the record holder.

## Sound
Playful Paris score (accordion lead, ukulele, pizzicato bass, light drums, glockenspiel); minor, drumless turn for the "hated" section; pops on titles, whooshes on cuts, sizzle (heat), wind, creak (tilt), clanks (construction, buckets), crowd and boos, calendar flips, radio beeps, camera shutters, fanfares (1889, record, ending).

## Facts used
~15 cm thermal growth; tilts away from the sun; top sways a few cm in wind; height ≈ 330 m; built 1887–1889 for the Exposition Universelle; Eiffel's company; Statue of Liberty's internal frame; 1887 artists' protest; 20-year permit, saved by radio antennas; tallest structure for 41 years (until 1930); ≈ 2.5 million rivets; repainted every 7 years by hand with ≈ 60 t of paint; ≈ 6–7 million visitors a year (official site of the Eiffel Tower, SETE).
