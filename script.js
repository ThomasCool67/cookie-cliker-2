// ---------- Dados do jogo ----------
const BUILDINGS = [
  { id: 'cursor',  name: 'Cursor',            desc: 'Clica sozinho por você',      base: 15,      cps: 0.1 },
  { id: 'gran',    name: 'Vovó',              desc: 'Assa com receita de família', base: 100,     cps: 1 },
  { id: 'farm',    name: 'Fazenda de trigo',  desc: 'Farinha direto da fonte',     base: 1100,    cps: 8 },
  { id: 'mine',    name: 'Mina de chocolate', desc: 'Gotas escavadas fresquinhas', base: 12000,   cps: 47 },
  { id: 'factory', name: 'Fábrica',           desc: 'Linha de produção 24 horas',  base: 130000,  cps: 260 },
  { id: 'lab',     name: 'Laboratório',       desc: 'Cookies feitos com ciência',  base: 1400000, cps: 1400 },
];
const byId = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
const SAVE_KEY = 'forno-infinito';

const state = { cookies: 0, total: 0, clicks: 0, clickLevel: 0, owned: {}, boostUntil: 0 };

const clickPower = () => Math.pow(2, state.clickLevel);
const clickCost  = () => Math.ceil(100 * Math.pow(4, state.clickLevel));
const cost       = b => Math.ceil(b.base * Math.pow(1.15, state.owned[b.id] || 0));
const baseCps    = () => BUILDINGS.reduce((s, b) => s + (state.owned[b.id] || 0) * b.cps, 0);
const boost      = () => (Date.now() < state.boostUntil ? 7 : 1);
const cps        = () => baseCps() * boost();

// ---------- Formatação ----------
function fmt(n) {
  if (n < 1000) return Math.floor(n).toLocaleString('pt-BR');
  const units = ['mil', 'mi', 'bi', 'tri', 'quad'];
  let i = -1;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  const digits = n < 10 ? 2 : n < 100 ? 1 : 0;
  return n.toFixed(digits).replace('.', ',') + ' ' + units[i];
}
const fmtRate = n => (n < 10 ? n.toFixed(1).replace('.', ',') : fmt(n));

// ---------- Elementos ----------
const $ = id => document.getElementById(id);
const countEl = $('count'), rateEl = $('rate'), stage = $('stage'), cookieBtn = $('cookie');
const clicksEl = $('clicks'), totalEl = $('total'), listEl = $('list'), toastEl = $('toast');

// ---------- Loja ----------
const rows = [];

function addRow(id, name) {
  const li = document.createElement('li');
  li.innerHTML =
    '<button class="item" type="button">' +
      '<span class="info">' +
        '<span class="name"></span>' +
        '<span class="desc"></span>' +
        '<span class="cost"><i></i><span class="price"></span></span>' +
      '</span>' +
      '<span class="owned">0</span>' +
    '</button>';
  const btn = li.querySelector('.item');
  li.querySelector('.name').textContent = name;
  btn.addEventListener('click', () => buy(id));
  listEl.appendChild(li);
  rows.push({
    id, btn,
    desc: li.querySelector('.desc'),
    price: li.querySelector('.price'),
    owned: li.querySelector('.owned'),
  });
}

function buildShop() {
  addRow('click', 'Mãos de manteiga');
  BUILDINGS.forEach(b => addRow(b.id, b.name));
}

function buy(id) {
  if (id === 'click') {
    const c = clickCost();
    if (state.cookies < c) return;
    state.cookies -= c;
    state.clickLevel++;
  } else {
    const b = byId[id], c = cost(b);
    if (state.cookies < c) return;
    state.cookies -= c;
    state.owned[id] = (state.owned[id] || 0) + 1;
  }
  render();
}

// ---------- Desenho da tela ----------
function render() {
  countEl.textContent = fmt(state.cookies);
  document.title = fmt(state.cookies) + ' cookies';
  const mult = boost();
  rateEl.textContent = fmtRate(cps()) + ' por segundo' + (mult > 1 ? ' (frenesi ×7)' : '');
  rateEl.classList.toggle('frenzy', mult > 1);
  clicksEl.textContent = fmt(state.clicks);
  totalEl.textContent = fmt(state.total);

  rows.forEach(r => {
    let c;
    if (r.id === 'click') {
      c = clickCost();
      r.owned.textContent = state.clickLevel;
      r.desc.textContent = 'Cada clique vale ' + fmt(clickPower()) + ', passa a valer ' + fmt(clickPower() * 2);
    } else {
      const b = byId[r.id];
      c = cost(b);
      r.owned.textContent = state.owned[r.id] || 0;
      r.desc.textContent = b.desc + ' (+' + fmtRate(b.cps) + '/s cada)';
    }
    r.price.textContent = fmt(c);
    r.btn.classList.toggle('poor', state.cookies < c);
  });
}

// ---------- Clique no cookie ----------
function bake(x, y) {
  const p = clickPower();
  state.cookies += p;
  state.total += p;
  state.clicks++;
  floater(x, y, '+' + fmt(p));
  render();
}

function floater(x, y, text) {
  const el = document.createElement('span');
  el.className = 'floater';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.addEventListener('animationend', () => el.remove());
  stage.appendChild(el);
}

cookieBtn.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const r = stage.getBoundingClientRect();
  bake(e.clientX - r.left, e.clientY - r.top);
});

// Teclado (Enter ou Espaço): o "click" sem ponteiro tem detail === 0
cookieBtn.addEventListener('click', e => {
  if (e.detail !== 0) return;
  const r = stage.getBoundingClientRect();
  const c = cookieBtn.getBoundingClientRect();
  bake(c.left - r.left + c.width / 2, c.top - r.top + c.height / 2);
});

// ---------- Produção automática ----------
let last = Date.now();
function tick() {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 3600);
  last = now;
  const gain = cps() * dt;
  state.cookies += gain;
  state.total += gain;
  render();
}

// ---------- Cookie dourado ----------
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function scheduleGolden() {
  setTimeout(spawnGolden, 40000 + Math.random() * 50000);
}

function spawnGolden() {
  const g = document.createElement('button');
  g.className = 'golden';
  g.type = 'button';
  g.setAttribute('aria-label', 'Cookie dourado! Toque para ganhar um bônus');
  g.style.left = (12 + Math.random() * 76) + '%';
  g.style.top = (16 + Math.random() * 66) + '%';

  const expire = setTimeout(() => { g.remove(); scheduleGolden(); }, 13000);

  g.addEventListener('click', () => {
    clearTimeout(expire);
    g.remove();
    if (Math.random() < 0.5) {
      state.boostUntil = Date.now() + 20000;
      toast('Frenesi! Produção ×7 por 20 segundos');
    } else {
      const bonus = Math.min(state.cookies * 0.15, cps() * 900) + 13;
      state.cookies += bonus;
      state.total += bonus;
      toast('Sorte! Você ganhou ' + fmt(bonus) + ' cookies');
    }
    render();
    scheduleGolden();
  });

  document.body.appendChild(g);
}

// ---------- Salvar e carregar ----------
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      state.cookies = d.cookies || 0;
      state.total = d.total || 0;
      state.clicks = d.clicks || 0;
      state.clickLevel = d.clickLevel || 0;
      state.owned = d.owned || {};
    }
  } catch (err) { /* sem progresso salvo */ }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cookies: state.cookies, total: state.total, clicks: state.clicks,
      clickLevel: state.clickLevel, owned: state.owned,
    }));
  } catch (err) { /* armazenamento indisponível */ }
}

// Recomeçar: pede um segundo toque para confirmar
const resetBtn = $('reset');
let resetArmed = false, resetTimer;
resetBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.textContent = 'Toque de novo para apagar tudo';
    resetTimer = setTimeout(() => {
      resetArmed = false;
      resetBtn.textContent = 'Recomeçar do zero';
    }, 3000);
    return;
  }
  clearTimeout(resetTimer);
  resetArmed = false;
  resetBtn.textContent = 'Recomeçar do zero';
  Object.assign(state, { cookies: 0, total: 0, clicks: 0, clickLevel: 0, owned: {}, boostUntil: 0 });
  save();
  render();
});

// ---------- Início ----------
buildShop();
render();
load();
last = Date.now();
render();
setInterval(tick, 100);
setInterval(save, 5000);
scheduleGolden();
