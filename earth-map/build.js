// Собирает index.html: шаблон + границы Natural Earth + русские названия + текстуры NASA (встроены как data:URI).
const fs = require('fs');
const path = require('path');
const countries = require('i18n-iso-countries');
countries.registerLocale(require('i18n-iso-countries/langs/ru.json'));

const topo = require('world-atlas/countries-50m.json');
const extra = { 'Somaliland': 'Сомалиленд', 'Kosovo': 'Косово', 'N. Cyprus': 'Северный Кипр',
  'Indian Ocean Ter.': 'Австралийские территории в Индийском океане', 'Siachen Glacier': 'Ледник Сиачен' };
const short = { 'Российская Федерация': 'Россия', 'Соединённые Штаты Америки': 'США' };
const names = topo.objects.countries.geometries.map(g => {
  const a2 = g.id && countries.numericToAlpha2(g.id);
  let ru = (a2 && countries.getName(a2, 'ru')) || extra[g.properties.name] || g.properties.name;
  return short[ru] || ru;
});

const cities = require('./data/cities.json');
const cc = {};
for (const r of cities.rows) {
  const code = r[7];
  if (cc[code]) continue;
  const ru = code.length === 2 && countries.getName(code, 'ru');
  cc[code] = short[ru] || ru || extra[code] || { 'Northern Cyprus': 'Северный Кипр' }[code] || code;
}

const img = path.join(__dirname, 'node_modules/three-globe') + '/example/img/';
const uri = f => 'data:image/jpeg;base64,' + fs.readFileSync(img + f).toString('base64');

let html = fs.readFileSync(path.join(__dirname, 'src/template.html'), 'utf8');
html = html.replace('/*TOPO*/null', () => JSON.stringify(topo))
           .replace('/*NAMES*/null', () => JSON.stringify(names))
           .replace('/*CITIES*/null', () => JSON.stringify(cities))
           .replace('/*CC*/null', () => JSON.stringify(cc))
           .replace('__DAY__', () => uri('earth-blue-marble.jpg'))
           .replace('__NIGHT__', () => uri('earth-night.jpg'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', (html.length / 1e6).toFixed(2), 'MB');
