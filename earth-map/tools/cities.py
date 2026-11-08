"""Готовит data/cities.json из Natural Earth populated places (общественное достояние).

Запуск: python3 tools/cities.py path/to/ne_10m_populated_places.geojson
Источник: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson
"""
import json, sys, os

src = json.load(open(sys.argv[1], encoding='utf-8'))['features']
CAP = {'Admin-0 capital': 2, 'Admin-0 capital alt': 2, 'Admin-0 region capital': 1,
       'Admin-1 capital': 1, 'Admin-1 region capital': 1}
SKIP = {'Meteorological Station', 'Scientific station', 'Historic place'}
tzs, rows = [], []
for f in src:
    p = f['properties']
    if p['FEATURECLA'] in SKIP:
        continue
    tz = p.get('TIMEZONE') or ''
    if tz and tz not in tzs:
        tzs.append(tz)
    iso = p['ISO_A2'] if len(str(p['ISO_A2'])) == 2 else p['ADM0NAME']
    rows.append([p['NAME_RU'] or p['NAME'], p['NAME'], round(p['LATITUDE'], 3), round(p['LONGITUDE'], 3),
                 int(max(p['POP_MAX'] or 0, 0)), int(p['SCALERANK']), CAP.get(p['FEATURECLA'], 0),
                 iso, tzs.index(tz) if tz else -1])
# важнее — раньше: столицы, затем по рангу и населению
rows.sort(key=lambda r: (-(r[6] == 2), r[5], -r[4]))
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'cities.json')
json.dump({'fields': ['ru', 'en', 'lat', 'lon', 'pop', 'rank', 'capital', 'country', 'tz'], 'tz': tzs, 'rows': rows},
          open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'cities ->', out)
