'use strict'
// Mia command centre — one plain script, no build step, no server.
// Everything you change is saved in THIS browser (localStorage). Use "Download backup" in the
// footer to keep a copy or to move your list to another device.

const BAG = 'Hospital Bag' // not a shelf of its own: it gathers items from every section (marked with a bag) plus a few that live only here
const BAG_TREE = { // three bags, each with subsections (subsection names are unique across bags)
  'Mum’s bag': ['Very bottom', 'Bottom: postpartum recovery', 'Middle: nursing after birth', 'Top: labour', 'Separate bag', 'Necessaire: toiletries & medication', 'Bring from home when needed'],
  'Dad’s bag': ['Food & drink', 'Labour support', 'Tech', 'Personal & clothes'],
  'Baby’s bag': ['Clothes & blankets', 'Nappy changing & care', 'Feeding & burping', 'Other'],
}
const BAGS = Object.values(BAG_TREE).flat() // every subsection, in order; an item's `bag` holds its subsection
const topOf = (sub) => Object.keys(BAG_TREE).find((t) => BAG_TREE[t].includes(sub)) || ''
const bagLabel = (sub) => (sub ? `${topOf(sub)} — ${sub}` : '')
const SECTIONS = ['Sleep & Rest', 'Feeding', 'Clothing', 'Hygiene, Care & Safety', 'Travel & Outings', 'Comfort & Development', BAG]
// Subcategories are fixed: these are the groups from the original list, in that order.
const SUBCATEGORIES = {
  'Sleep & Rest': ['Sleep furniture', 'Sleep clothing', 'Sleep tech'],
  'Feeding': ['Breastfeeding', 'Bottle feeding', 'Breastfeeding & bottle feeding', 'Solids (6 months onward)'],
  'Clothing': ['Stage 1 — First size / newborn', 'Stage 2 — 0-3 months', 'Stage 3 — 3-6 months', 'Stage 4 — 6-9 months', 'Stage 5 — 9-12 months'],
  'Hygiene, Care & Safety': ['Hygiene (any area)', 'Hygiene (bathroom area)', 'Health issues', 'Safety', 'Postpartum recovery'],
  'Travel & Outings': ['Travel & outings'],
  'Comfort & Development': ['Play & development'],
  [BAG]: BAGS,
}
const PLANS = { buy: 'Buy', 'if-needed': 'Only if needed', skip: 'Skip' }
const CURRENCIES = { GBP: '£', EUR: '€', USD: '$' }
const PASSWORD = 'unclemarko' // a polite door, not security: anyone can read this file
const STORE = 'mia-command-centre-v15'
const UNLOCKED = 'mia-unlocked'
// Pregnancy dating: she was 18 weeks on 15 Nov 2026; a full term is 40 weeks. Change these two to re-date.
const WEEKS_ON = { week: 18, on: new Date('2026-11-15') }
const WEEK_MS = 7 * 24 * 3600 * 1000
const DUE = new Date(WEEKS_ON.on.getTime() + (40 - WEEKS_ON.week) * WEEK_MS)
const weekNow = () => Math.min(40, WEEKS_ON.week + Math.floor((Date.now() - WEEKS_ON.on) / WEEK_MS))
const dueLabel = () => `Week ${weekNow()} of 40 · due ${DUE.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
// Matiss was born on this date. Purchases are shown as weeks before (-) / after (+) it, instead of calendar dates.
const BIRTH = new Date('2026-08-29')
// Mia's own spending is timed against her due date until the baby arrives; Matiss's reference history against his actual birth.
const REF = { mia: { date: DUE, word: 'due date', short: 'due', name: 'Mia' }, matiss: { date: BIRTH, word: 'birth', short: 'birth', name: 'Matiss' } }
const weekIndex = (date, ref = BIRTH) => Math.floor((new Date(date) - ref) / WEEK_MS) // -1 = the week before, 0 = the week it happens
const weekLabel = (k, r = REF.matiss) => (k < 0 ? `${-k} wk before ${r.word}` : k === 0 ? `${r.short} week` : `${k} wk after ${r.word}`)
const weekShort = (k) => (k < 0 ? `−${-k}` : k === 0 ? '0' : `+${k}`)
const VERDICTS = { essential: 'Essential', good: 'Good', 'not-needed': 'Not needed', 'wouldnt-rebuy': "Wouldn't buy again" }
const BLACK_FRIDAY = new Date('2026-11-27')

const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const uid = () => Math.random().toString(36).slice(2, 10)
const today = () => new Date().toISOString().slice(0, 10)
const money = (n, cur, digits) => (n < 0 ? '-' : '') + (CURRENCIES[cur] || '£') + Math.abs(Number(n)).toLocaleString('en-GB', digits === undefined ? { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits })
const num = (v) => (String(v ?? '').trim() === '' ? null : Number(v))

// ---------- data ----------
function seedDb() {
  return {
    currency: 'GBP',
    items: SEED.items.map((s) => ({
      id: s.key, name: s.name, product: s.product || '', section: s.section, subcategory: s.subcategory,
      when: s.when || '', packed: false, bag: s.bag || '', bagOrder: s.bagOrder ?? 0, store: s.store || '', verdict: s.verdict || '', blackFriday: !!s.blackFriday, qty: s.qty ?? null, perPack: s.perPack ?? null, age: s.age || '', plan: s.plan || 'buy', price: s.price ?? null, currency: 'GBP', decision: s.decisionStatus === 'decided' ? 'decided' : 'undecided',
      buyType: s.buyType || '', recurring: !!s.recurring, owned: !!s.owned, retired: !!s.retired, starred: false,
      links: s.links || [], order: s.order ?? 1000, note: s.note || '',
      comments: [], priceLog: [],
      purchases: [], // Mia's own spending starts empty
      refPurchases: (s.purchases || []).map((p) => ({ id: uid(), currency: 'GBP', ...p })), // how it went for Matiss (read-only)
    })),
  }
}
let db
try { db = JSON.parse(localStorage.getItem(STORE)) } catch { /* fall through to the starting list */ }
if (!db || !Array.isArray(db.items)) db = seedDb()
// Lists saved by older versions are brought up to date: "before/after birth" and "Black Friday" come from the
// starting list, and old "alternatives" are folded into the purchase links and the note so nothing is lost.
function migrate() {
  for (const i of db.items) {
    const s = SEED.items.find((x) => x.key === i.id)
    if (i.when === undefined) i.when = s?.when || ''
    if (i.blackFriday === undefined) i.blackFriday = !!s?.blackFriday
    if (i.refPurchases === undefined) i.refPurchases = (s?.purchases || []).map((p) => ({ id: uid(), currency: 'GBP', ...p }))
    if (i.perPack === undefined) i.perPack = s?.perPack ?? null // lists saved before "items per pack" existed
    if (i.packed === undefined) i.packed = false
    if (i.bag === undefined) { i.bag = s?.bag || ''; i.bagOrder = s?.bagOrder ?? 0 }
    if (i.store === undefined) { i.store = s?.store || ''; i.verdict = '' }
    if (i.plan === undefined) { i.plan = s?.plan || 'buy'; i.qty = s?.qty ?? null; i.age = s?.age || '' }
    if (i.alternatives) {
      for (const a of i.alternatives) {
        i.links.push(...(a.links || []).map((l) => ({ url: l.url, label: l.label || a.product })))
        i.note = [i.note, `Alternative: ${a.product}${a.price != null ? ` (${money(a.price, i.currency)})` : ''}${a.note ? ` — ${a.note}` : ''}`].filter(Boolean).join('\n')
      }
      delete i.alternatives
    }
  }
}
migrate()
let saveFailed = false
function save() { try { localStorage.setItem(STORE, JSON.stringify(db)) } catch { saveFailed = true } }
const item = (id) => db.items.find((i) => i.id === id)

// ---------- small helpers ----------
const linksToText = (l) => l.map((x) => (x.label ? `${x.url} ${x.label}` : x.url)).join('\n')
const textToLinks = (t) => t.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => {
  const i = s.search(/\s/)
  return i < 0 ? { url: s, label: null } : { url: s.slice(0, i), label: s.slice(i).trim() || null }
})
function safeUrl(u) {
  const full = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u
  return /^https?:\/\//i.test(full) ? full : '#'
}
function linkChips(links) {
  return links.map((l) => {
    let label = l.label
    if (!label) { try { label = new URL(safeUrl(l.url)).hostname.replace(/^www\./, '') } catch { label = l.url } }
    return `<a class="link" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
  }).join(' ')
}
const sel = (attrs, options, cur) =>
  `<select ${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
const WHEN = { before: 'Before birth', after: 'After birth' }
const star = (i) => `<button class="star${i.starred ? ' on' : ''}" data-act="star" data-id="${i.id}" aria-label="${i.starred ? 'Remove from favourites' : 'Add to favourites'}">${i.starred ? '★' : '☆'}</button>`
const lineTotal = (p) => p.price * p.quantity
// Sections, then subcategories, follow the fixed lists above; items follow their own `order`.
// an item can cover several ages (e.g. sleep sacks: "0-6 months, 6-18 months")
const agesOf = (i) => (i.age || '').split(',').map((a) => a.trim()).filter(Boolean)
// An item is "in" a section if it lives there; the Hospital Bag also includes every item marked with a bag (each item exists once).
const inView = (i, section) => (section === BAG ? !!i.bag : i.section === section)
const subIndex = (i) => { const k = (SUBCATEGORIES[i.section] || []).indexOf(i.subcategory); return k < 0 ? 99 : k }
const sorted = (items) => [...items].sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || subIndex(a) - subIndex(b) || a.order - b.order)
function groupBySub(items, section) {
  const hb = section === BAG // the bag groups by bag, in the original packing order
  const ordered = hb ? [...items].sort((a, b) => BAGS.indexOf(a.bag) - BAGS.indexOf(b.bag) || (a.bagOrder ?? 0) - (b.bagOrder ?? 0)) : sorted(items)
  const g = new Map()
  for (const i of ordered) { const k = hb ? i.bag : i.subcategory; g.set(k, [...(g.get(k) || []), i]) }
  return [...g.entries()]
}

// ---------- state ----------
const ui = {
  filters: { timing: 'all', search: '', decision: 'all', packed: 'all', plan: 'all', age: 'all', verdict: 'all', store: 'all', when: 'all', buy: 'all', recurring: 'no', owned: 'all', fav: false, bf: false },
  sec: SECTIONS[0], open: new Set(), pOpen: new Set(), filtersOpen: false, addTo: '', openId: null, adding: false, // sec: the list on show; open: subcategories the reader has opened (everything starts closed)
  edit: { purchase: null },
  spend: { who: 'mia', currency: null, range: 'all', section: 'all', dim: 'section', adding: false, opts: false, all: false },
}
function route() {
  const [path, q] = (location.hash.slice(1) || '/').split('?')
  return { path, params: new URLSearchParams(q || '') }
}

// ---------- pages ----------
function syncTop(path) {
  $('#top').dataset.part = path === '/spending' ? 'spend' : 'lists'
  $('#top').querySelectorAll('[data-p]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.p === $('#top').dataset.part)))
  $('#wk').textContent = `Week ${weekNow()} · ${Math.max(0, Math.ceil((DUE - Date.now()) / WEEK_MS))} to go`
}

// Qty is the number of ITEMS. "Items per pack" says how they come, so 3 sleepsuits bought as one 3-pack read "3 × … (1 pack of 3)".
const packsOf = (i) => (i.qty && i.perPack > 1 ? ` <span class="packs">(${Math.ceil(i.qty / i.perPack)} pack${Math.ceil(i.qty / i.perPack) === 1 ? '' : 's'} of ${i.perPack})</span>` : '')
const nameHtml = (i) => `${i.qty ? `<span class="qty">${i.qty} ×</span> ` : ''}${esc(i.name)}${packsOf(i)}`
// Quiet facts read as one grey line; only what deserves a glance (decided, packed, Black Friday, have) becomes a pill.
const factsOf = (i, bagView) => [!(bagView || i.section === BAG) && i.when && WHEN[i.when], ...agesOf(i).slice(0, 3), agesOf(i).length > 3 && `+${agesOf(i).length - 3} more ages`,
  i.buyType, i.recurring && 'recurring', i.plan !== 'buy' && PLANS[i.plan], i.verdict && VERDICTS[i.verdict], i.bag && i.section !== BAG && 'in hospital bag'].filter(Boolean)
const pillsHtml = (i, bagView, status = true) => {
  const bag = bagView || i.section === BAG
  return `${status && (bag ? i.packed : i.decision === 'decided') ? `<span class="badge decided">${bag ? 'Packed' : 'Decided'}</span>` : ''}${i.blackFriday ? '<span class="badge bf">Black Friday</span>' : ''}${i.owned ? '<span class="badge have">have ✓</span>' : ''}`
}

function card(i, dim, bagView) { // in the hospital bag the status is packed / not packed
  const more = i.product ? (i.links.length ? `<a class="card-more" href="${esc(safeUrl(i.links[0].url))}" target="_blank" rel="noopener noreferrer">What Maja &amp; Marko bought ↗</a>` : '<span class="card-more">What Maja &amp; Marko bought <i></i></span>') : ''
  const facts = factsOf(i, bagView).join(' · '), pills = pillsHtml(i, bagView)
  return `<div class="card${dim ? ' dim' : ''}${i.id === ui.openId ? ' on' : ''}" role="button" tabindex="0" data-act="open" data-id="${i.id}">
    <div class="card-top"><span class="card-name">${nameHtml(i)}</span><span class="card-meta">
      ${i.price != null ? `<span class="price">${money(i.price, i.currency)}</span>` : ''}${star(i)}</span></div>
    ${facts ? `<p class="card-line">${facts}</p>` : ''}${more}${pills ? `<div class="badges">${pills}</div>` : ''}</div>`
}

function visible(section) {
  const f = ui.filters, q = f.search.trim().toLowerCase()
  return db.items.filter((i) => inView(i, section) && !i.retired
    && (section === BAG ? f.packed === 'all' || (f.packed === 'yes') === !!i.packed : f.decision === 'all' || i.decision === f.decision)
    && (f.when === 'all' || i.when === f.when)
    && (f.timing === 'all' || needBucket(i) === f.timing)
    && (f.plan === 'all' || i.plan === f.plan)
    && (f.verdict === 'all' || i.verdict === f.verdict)
    && (f.store === 'all' || i.store === f.store)
    && (f.age === 'all' || agesOf(i).includes(f.age))
    && (f.buy === 'all' || i.buyType === f.buy)
    && (f.bf || section === BAG || (f.recurring === 'yes' ? i.recurring : !i.recurring)) // the Black Friday view and the hospital bag show recurring and one-off together
    && (f.owned === 'all' || (f.owned === 'yes') === i.owned)
    && (!f.fav || i.starred)
    && (!f.bf || i.blackFriday)
    && (!q || `${i.name} ${i.product}`.toLowerCase().includes(q)))
}

// An accordion: the height eases open (see style.css). Everything starts closed; what the reader opens is remembered in ui.open.
const acc = (key, head, body, cls) => {
  const on = (key.startsWith('p:') ? ui.pOpen : ui.open).has(key)
  return `<div class="acc ${cls}${on ? ' open' : ''}"><button class="acc-h" data-act="toggle" data-key="${esc(key)}" aria-expanded="${on}">${head}<i class="chev"></i></button><div class="acc-p"><div${on ? '' : ' inert'}>${body}</div></div></div>`
}
const groupHtml = (section, sub, its) => acc(`${section}|${sub}`, `<span class="name">${esc(sub)}</span><span class="count">${ui.filters.timing === 'all' ? its.length : `${itemsOf(its)} items`}</span>`, `<div class="grid">${its.map((i) => card(i, false, section === BAG)).join('')}</div>`, 'sub')
const FILTER_KEYS = ['decision', 'packed', 'plan', 'age', 'verdict', 'store', 'when', 'buy', 'owned']
const filtersActive = () => { const f = ui.filters; return f.timing !== 'all' || !!f.search.trim() || f.fav || f.bf || f.recurring === 'yes' || FILTER_KEYS.some((k) => f[k] !== 'all') }
function openMatches() { // while searching or filtering, open whatever has results so nothing is hidden
  if (filtersActive()) groupBySub(visible(ui.sec), ui.sec).forEach(([sub]) => ui.open.add(`${ui.sec}|${sub}`))
}
const SHORT = { 'Hygiene, Care & Safety': 'Hygiene & safety', 'Comfort & Development': 'Comfort & play', 'Travel & Outings': 'Travel' }
const rail = () => SECTIONS.map((s) => `<button class="chip" data-act="sec" data-v="${esc(s)}"${s === ui.sec ? ' aria-current="true"' : ''}>${esc(SHORT[s] || s)}<small>${visible(s).length}</small></button>`).join('')

function list() {
  const groups = groupBySub(visible(ui.sec), ui.sec)
  if (!groups.length) return '<p class="muted pad">Nothing matches. Clear a filter to see more.</p>'
  if (ui.sec !== BAG) return groups.map(([sub, its]) => groupHtml(ui.sec, sub, its)).join('')
  // the hospital bag: one header per bag (Mum's, Dad's, Baby's) with its subsections underneath
  return Object.keys(BAG_TREE).map((top) => {
    const gs = groups.filter(([sub]) => BAG_TREE[top].includes(sub))
    return gs.length ? `<h3 class="bag-title">${esc(top)}<span class="count">${gs.reduce((c, [, its]) => c + its.length, 0)}</span></h3>` + gs.map(([sub, its]) => groupHtml(ui.sec, sub, its)).join('') : ''
  }).join('')
}
function listHead() {
  const shown = visible(ui.sec), n = shown.length, all = db.items.filter((i) => inView(i, ui.sec) && !i.retired)
  const cost = shown.reduce((c, i) => c + (i.currency === db.currency && i.price != null ? i.price : 0), 0)
  const done = all.filter((i) => (ui.sec === BAG ? i.packed : i.decision === 'decided')).length
  return `<h1>${esc(ui.sec)}</h1><p class="meta">${n} product${n === 1 ? '' : 's'} · ${itemsOf(shown)} items · ${money(cost, db.currency, 0)}${ui.filters.timing === 'all' ? ` · ${done} of ${all.length} ${ui.sec === BAG ? 'packed' : 'decided'}` : ''}</p>`
}

let appliedHash = null
function listCol() { // everything that belongs to the list on show, so switching lists redraws just this
  const f = ui.filters, inSec = db.items.filter((i) => inView(i, ui.sec) && !i.retired)
  const ageKey = (a) => { const n = (a.match(/\d+/g) || [999]).map(Number); return /^newborn/i.test(a) ? -1 : n[0] * 100 + (n[1] || 0) } // by first number, then second
  const ages = [...new Set(inSec.flatMap(agesOf))].sort((a, b) => ageKey(a) - ageKey(b))
  if (f.age !== 'all' && !ages.includes(f.age)) f.age = 'all' // that age doesn't exist in this list
  const stores = [...new Set(inSec.filter((i) => i.store).map((i) => i.store))].sort()
  if (f.store !== 'all' && !stores.includes(f.store)) f.store = 'all'
  const fs = (key, opts) => sel(`data-chg="filter" data-key="${key}"`, opts, f[key])
  const n = FILTER_KEYS.filter((k) => f[k] !== 'all').length + (f.recurring === 'yes') + f.fav + f.bf
  return `${whenBar()}<div id="lhead">${listHead()}</div>
    <div class="tools"><input id="search" type="search" placeholder="Search this list" value="${esc(f.search)}" aria-label="Search this list">
    <button class="fbtn" data-act="filters-toggle" aria-expanded="${ui.filtersOpen}">Filters${n ? ` · ${n}` : ''}</button></div>
    <div class="fpanel" id="fpanel"${ui.filtersOpen ? '' : ' hidden'}>
    ${ui.sec === BAG ? fs('packed', [['all', 'Packed & not packed'], ['yes', 'Packed'], ['no', 'Not packed']]) : fs('decision', [['all', 'All decisions'], ['decided', 'Decided'], ['undecided', 'Not decided']])}
    ${fs('plan', [['all', 'Buy, if needed & skip'], ['buy', 'Buy'], ['if-needed', 'Only if needed'], ['skip', 'Skip']])}
    ${fs('age', [['all', 'All ages & sizes'], ...ages.map((a) => [a, a])])}
    ${fs('verdict', [['all', 'All verdicts'], ...Object.entries(VERDICTS)])}
    ${fs('store', [['all', 'All stores'], ...stores.map((x) => [x, x])])}
    ${fs('when', [['all', 'Before & after birth'], ['before', 'Buy before birth'], ['after', 'Buy after birth']])}
    ${fs('buy', [['all', 'New or used'], ['new', 'new'], ['used', 'used']])}
    ${sel(`data-chg="filter" data-key="recurring"${f.bf || ui.sec === BAG ? ' disabled title="Not used for Black Friday or the hospital bag, which show everything"' : ''}`, [['yes', 'Recurring'], ['no', 'One-off']], f.recurring)}
    ${fs('owned', [['all', 'Have or need'], ['yes', 'Have it'], ['no', "Don't have it"]])}
    <label><input type="checkbox" data-chg="filter-fav"${f.fav ? ' checked' : ''}> ★ Favourites</label>
    <label><input type="checkbox" data-chg="filter-bf"${f.bf ? ' checked' : ''}> Black Friday</label></div>
    <div id="list">${list()}</div>`
}
function board(params) {
  if (location.hash !== appliedHash) { // links such as #/board?section=Feeding or ?bf=1 apply once, so the reader can change them afterwards
    appliedHash = location.hash
    const req = params.get('section'); if (SECTIONS.includes(req)) ui.sec = req
    if (params.get('bf')) { ui.filters.bf = true; openMatches() }
  }
  const retired = db.items.filter((i) => i.retired).length
  return `<div class="lists"><nav class="rail" id="rail" aria-label="Lists">${rail()}${retired ? `<a class="chip quiet" href="#/retired">Retired<small>${retired}</small></a>` : ''}</nav>
    <div class="list-col" id="lcol">${listCol()}</div></div><button class="fab" data-act="add" aria-label="Add item">+</button>`
}
const redrawRail = () => $('#rail')?.querySelectorAll('[data-act=sec]').forEach((b) => { b.removeAttribute('aria-current'); if (b.dataset.v === ui.sec) b.setAttribute('aria-current', 'true'); b.querySelector('small').textContent = visible(b.dataset.v).length })

function retiredPage() {
  const its = sorted(db.items.filter((i) => i.retired))
  return `<div class="page"><a class="back" href="#/board"><i></i>Lists</a><h1>Retired</h1>${its.length ? `<div class="grid flat">${its.map((i) => card(i, true)).join('')}</div>` : '<p class="muted">Nothing retired yet.</p>'}</div>`
}

// ---------- spending ----------
// When each item is needed: before the birth, in the first 3 months, or later. Solids and safety items come after 3 months.
const LATER = ['Solids (6 months onward)', 'Safety']
const startMonth = (i) => { const a = agesOf(i)[0] || ''; return /^(newborn|up to)/i.test(a) ? 0 : Number((a.match(/\d+/) || [0])[0]) }
const needBucket = (i) => (i.when === 'before' ? 'before' : i.when === 'after' ? (LATER.includes(i.subcategory) || startMonth(i) >= 3 ? 'later' : 'early') : null)
// Items and cost per time, for the "when" bar on the Lists page. One-off or recurring follows the list's own filter.
function needTotals(cur) {
  const f = ui.filters, t = { all: { n: 0, cost: 0 }, before: { n: 0, cost: 0 }, early: { n: 0, cost: 0 }, later: { n: 0, cost: 0 } }
  for (const i of db.items) {
    if (i.retired || i.plan !== 'buy' || !(f.bf || i.section === BAG || (f.recurring === 'yes' ? i.recurring : !i.recurring))) continue
    for (const k of ['all', needBucket(i)]) if (k) { t[k].n += i.qty || 1; if (i.currency === cur && i.price != null) t[k].cost += i.price }
  }
  return t
}
const itemsOf = (list) => list.reduce((n, i) => n + (i.qty || 1), 0)
const WHEN_BAR = [['all', 'Everything'], ['before', 'Before the birth'], ['early', 'First 3 months'], ['later', 'After 3 months']]
function whenBar() {
  const t = needTotals(db.currency)
  return `<div class="when" role="group" aria-label="When you need it">${WHEN_BAR.map(([k, label]) => `<button class="when-b${ui.filters.timing === k ? ' on' : ''}" data-act="timing" data-v="${k}" aria-pressed="${ui.filters.timing === k}"><span>${label}</span><b>${t[k].n}<i> items</i></b><small>${money(t[k].cost, db.currency, 0)}</small></button>`).join('')}</div>`
}

function spending() {
  const s = ui.spend, cur = s.currency || db.currency
  const ref = REF[s.who] // whose spending: Mia's own tracker, or the read-only Matiss reference
  const all = db.items.flatMap((i) => (s.who === 'mia' ? i.purchases : i.refPurchases).map((p) => ({ ...p, item: i })))
  const inSection = (it) => s.section === 'all' || inView(it, s.section)
  const mine = all.filter((p) => p.currency === cur && inSection(p.item))
  const inRange = (p) => { const k = weekIndex(p.date, ref.date); return s.range === 'before' ? k < 0 : s.range === 'after' ? k >= 0 : s.range === 'last4' ? k >= -4 && k < 0 : true }
  const ps = mine.filter(inRange)
  const sum = (list) => list.reduce((n, p) => n + lineTotal(p), 0)
  const total = sum(ps)
  const buys = ps.filter((p) => p.price > 0) // refunds count towards the total, not as a purchase
  const planned = db.items.filter((i) => i.currency === cur && !i.retired && !i.owned && i.decision === 'decided' && inSection(i)).reduce((n, i) => n + (i.price || 0), 0)

  // one column per week, from the earliest to the latest purchase, so quiet weeks show honestly
  const weeks = new Map()
  for (const p of ps) weeks.set(weekIndex(p.date, ref.date), (weeks.get(weekIndex(p.date, ref.date)) || 0) + lineTotal(p))
  const series = []
  if (weeks.size) for (let k = Math.min(...weeks.keys()); k <= Math.max(...weeks.keys()); k++) series.push([k, weeks.get(k) || 0])
  const maxM = Math.max(1, ...series.map(([, v]) => Math.abs(v)))
  const chart = series.length
    ? `<div class="cols" style="grid-template-columns:repeat(${series.length},minmax(0,40px))">${series.map(([k, v]) => `<div class="col${k < 0 ? '' : ' after'}" style="height:${(Math.max(v, 0) / maxM) * 100}%" title="${weekLabel(k, ref)}: ${money(v, cur, 2)}">${v === maxM ? `<em>${money(v, cur)}</em>` : ''}</div>`).join('')}</div>
       <div class="months" style="grid-template-columns:repeat(${series.length},minmax(0,40px))">${series.map(([k]) => `<span>${series.length <= 14 || k % 2 === 0 ? weekShort(k) : ''}</span>`).join('')}</div>
       <p class="faint" style="margin:8px 0 0">Weeks before (−) and after (+) the ${ref.word}. Blue = before, green = after.</p>`
    : '<p class="faint">No purchases in this range yet.</p>'

  const keyOf = {
    section: (p) => p.item.section, subcategory: (p) => p.item.subcategory, source: (p) => p.source || '—',
    buyType: (p) => (p.item.buyType === 'new' ? 'New' : p.item.buyType === 'used' ? 'Used' : '—'),
  }[s.dim]
  const groups = new Map()
  for (const p of ps) groups.set(keyOf(p), (groups.get(keyOf(p)) || 0) + lineTotal(p))
  const rows = [...groups].sort((a, b) => b[1] - a[1]).slice(0, 12), maxB = Math.max(1, ...rows.map((r) => r[1]))
  const bars = rows.length ? rows.map(([k, v]) => `<div class="bar-row"><div class="lbl"><span>${esc(k)}</span><span>${money(v, cur, 2)}</span></div>
    <div class="track"><div class="fill" style="width:${(v / maxB) * 100}%"></div></div></div>`).join('') : '<p class="faint">No purchases in this range yet.</p>'

  const byItem = new Map()
  for (const p of ps) {
    const e = byItem.get(p.item.id) || { item: p.item, n: 0, total: 0, last: '' }
    if (p.price > 0) e.n++
    e.total += lineTotal(p); if (p.date > e.last) e.last = p.date
    byItem.set(p.item.id, e)
  }
  const table = byItem.size ? `<div class="tablewrap"><table><thead><tr><th>Item</th><th>Section</th><th>Purchases</th><th>Total</th><th>Last bought</th></tr></thead><tbody>
    ${[...byItem.values()].sort((a, b) => b.total - a.total).map((e) => `<tr><td><b>${esc(e.item.name)}</b>${e.item.product ? ` <span class="muted">— ${esc(e.item.product)}</span>` : ''}</td>
    <td class="muted">${esc(e.item.section)}</td><td>${e.n}</td><td><b>${money(e.total, cur, 2)}</b></td><td class="muted">${weekLabel(weekIndex(e.last, ref.date), ref)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted">No purchases in this range.</p>'

  const ctl = (key, opts) => sel(`data-chg="spend" data-key="${key}"`, opts, key === 'currency' ? cur : s[key])
  const empty = s.who === 'mia' && !all.length
  const intro = s.who === 'matiss'
    ? `<p class="banner">What Maja and Marko actually spent on Matiss (born 29 Aug 2026), week by week, from the receipts. Read only: Mia’s own spending is separate.</p>`
    : empty && !s.adding ? `<p class="banner">Nothing recorded yet. When you buy something, add it here. It shows up week by week around the due date. Switch to <b>Maja &amp; Marko’s example</b> to see how it looked last time.</p>` : ''
  const sumBefore = sum(mine.filter((p) => weekIndex(p.date, ref.date) < 0)), sumAfter = sum(mine.filter((p) => weekIndex(p.date, ref.date) >= 0))
  const nItems = new Set(ps.map((p) => p.item.id)).size
  return `<div class="page spend"><h1>Spending</h1>
    <div class="seg" role="group" aria-label="Whose spending">${[['mia', 'Mia’s spending'], ['matiss', 'Maja &amp; Marko’s example']].map(([v, t]) => `<button data-act="spend-who" data-v="${v}" class="${s.who === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <p class="tot">${money(total, cur, 2)}</p>
    <p class="cap">${buys.length} purchase${buys.length === 1 ? '' : 's'} across ${nItems} item${nItems === 1 ? '' : 's'} · ${money(sumBefore, cur, 0)} before the ${ref.word}, ${money(sumAfter, cur, 0)} after${s.who === 'mia' ? ` · ${money(planned, cur, 0)} still planned` : ''}</p>
    ${intro}
    ${s.who === 'mia' ? `<button class="add" data-act="spend-add">${s.adding ? 'Close' : 'Add a purchase'}</button>${s.adding ? spendForm() : ''}` : ''}
    <div class="panels"><section class="panel"><h2>Spend per week, around the ${ref.word}</h2>${chart}</section>
    <section class="panel"><h2>Breakdown ${ctl('dim', [['section', 'By section'], ['subcategory', 'By subcategory'], ['source', 'By source'], ['buyType', 'By new vs used']])}</h2>${bars}</section></div>
    <details class="more" data-opt="all"${s.all ? ' open' : ''}><summary>All items (${byItem.size})</summary>${table}</details>
    <details class="more" data-opt="opts"${s.opts ? ' open' : ''}><summary>Currency, range and section</summary><div class="ctl">
      ${ctl('currency', Object.entries(CURRENCIES).map(([c, sym]) => [c, `Showing ${sym} ${c}`]))}
      ${ctl('range', [['all', 'All time'], ['before', `Before the ${ref.word}`], ['last4', 'Last 4 weeks before'], ['after', `After the ${ref.word}`]])}
      ${ctl('section', [['all', 'All sections'], ...SECTIONS.map((x) => [x, x])])}</div></details>
    <p class="faint" style="margin-top:12px">Amounts in different currencies are never added together — pick one above.</p></div>`
}

// "Add a purchase" on the Spending page: pick an item from the list, then say what was paid
function spendForm() {
  return `<form data-form="spendadd" class="sform"><label>What did you buy<input name="item" list="spend-items" required placeholder="Start typing an item" autocomplete="off"><datalist id="spend-items">${db.items.filter((i) => !i.retired).map((i) => `<option value="${esc(i.name + ' · ' + i.section)}">`).join('')}</datalist></label>
    <div class="pair"><label>Price each (${CURRENCIES[db.currency]})<input name="price" type="number" step="0.01" min="0" required inputmode="decimal"></label><label>How many<input name="quantity" type="number" min="1" value="1" inputmode="numeric"></label></div>
    <div class="pair"><label>Date<input name="date" type="date" value="${today()}"></label><label>Where<input name="source" placeholder="Shop"></label></div>
    <p class="err" id="sp-err"></p><button class="btn big-btn" type="submit">Save purchase</button></form>`
}

// ---------- item panel ----------
// ---------- item panel ----------

// the fixed subcategories of a section (plus the item's current one, so an old value is never lost on save)
const subOptions = (section, current) => [...new Set([...(SUBCATEGORIES[section] || []), current].filter(Boolean))].map((x) => [x, section === BAG ? bagLabel(x) : x])

function itemForm(i) {
  return `<form data-form="item" class="fgrid">
    <label class="full">Name<input name="name" value="${esc(i.name)}" required></label>
    <label class="full">Subcategory${sel('name="subcategory"', subOptions(i.section, i.subcategory), i.subcategory)}</label>
    <label class="full">Product / description<input name="product" value="${esc(i.product)}"></label>
    <label>Quantity<input name="qty" type="number" min="1" step="1" value="${i.qty ?? ''}"></label>
    <label>Age / size<input name="age" value="${esc(i.age)}" placeholder="e.g. 0-3 months, Newborn"></label>
    <label>Plan${sel('name="plan"', Object.entries(PLANS), i.plan)}</label>
    <label>Where bought<input name="store" list="stores" value="${esc(i.store)}" placeholder="e.g. Amazon, IKEA, Vinted"><datalist id="stores">${[...new Set(db.items.map((x) => x.store).filter(Boolean))].sort().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <label>Verdict${sel('name="verdict"', [['', '—'], ...Object.entries(VERDICTS)], i.verdict)}</label>
    ${i.section === BAG ? '' : `<label class="full">Also in the hospital bag${sel('name="bag"', [['', 'No'], ...BAGS.map((x) => [x, bagLabel(x)])], i.bag)}</label>`}
    <label>Price (${CURRENCIES[db.currency]})<input name="price" type="number" step="0.01" value="${i.price ?? ''}"></label>
    ${i.section === BAG ? '' : `<label>Decision${sel('name="decision"', [['decided', 'Decided'], ['undecided', 'Not decided']], i.decision)}</label>`}
    ${i.bag ? `<label class="check full"><input type="checkbox" name="packed"${i.packed ? ' checked' : ''}> Packed in the hospital bag</label>` : ''}
    <label>When to buy${sel('name="when"', [['', '—'], ['before', 'Before birth'], ['after', 'After birth']], i.when)}</label>
    <label>Buy${sel('name="buyType"', [['', '—'], ['new', 'new'], ['used', 'used']], i.buyType)}</label>
    <label class="check"><input type="checkbox" name="recurring"${i.recurring ? ' checked' : ''}> Recurring / bulk-buy</label>
    <label class="check"><input type="checkbox" name="blackFriday"${i.blackFriday ? ' checked' : ''}> Buy on Black Friday</label>
    <label class="full">Purchase links <span class="faint">— one per line: link, then an optional label</span><textarea name="links" rows="2">${esc(linksToText(i.links))}</textarea></label>
    <label class="full">Note<textarea name="note" rows="2">${esc(i.note)}</textarea></label>
    <div class="full"><button class="btn" type="submit">Save changes</button></div></form>`
}

function commentSection(i) {
  return (i.comments.length ? i.comments.map((c) => `<div class="comment"><div class="top2"><span class="faint">${new Date(c.at).toLocaleDateString()}</span>
    <button class="linkbtn red" data-act="comment-delete" data-id="${i.id}" data-cid="${c.id}">Delete</button></div><p>${esc(c.text)}</p></div>`).join('') : '<p class="faint">No comments yet.</p>') +
    `<form data-form="comment"><textarea name="text" rows="2" placeholder="Add a comment…" required></textarea><button class="btn" style="margin-top:6px" type="submit">Post</button></form>`
}

function purchaseForm(i, p) {
  const cur = p ? p.currency : db.currency
  return `<form data-form="purchase" class="inline"><input type="hidden" name="pid" value="${p ? p.id : ''}">
    <label>Price/unit (${CURRENCIES[cur]})<input name="price" type="number" step="0.01" required value="${p ? p.price : ''}" placeholder="${p ? '' : i.price ?? ''}" style="width:96px"></label>
    <label>Qty<input name="quantity" type="number" min="1" value="${p ? p.quantity : 1}" style="width:64px"></label>
    <label>Date<input name="date" type="date" value="${p ? p.date : today()}"></label>
    <label>Source<input name="source" value="${esc(p ? p.source : 'Amazon')}" style="width:96px"></label>
    <label>Note<input name="note" value="${esc(p?.note)}" style="width:128px"></label>
    <button class="btn" type="submit">${p ? 'Save' : 'Record'}</button><button class="linkbtn" type="button" data-act="purchase-cancel">Cancel</button></form>`
}

function purchaseSection(i) {
  const totals = new Map()
  for (const p of i.purchases) totals.set(p.currency, (totals.get(p.currency) || 0) + lineTotal(p))
  const sum = [...totals].map(([c, n]) => money(n, c, 2)).join(' + ')
  const sortedP = [...i.purchases].sort((a, b) => b.date.localeCompare(a.date))
  return (sortedP.length ? `<table><thead><tr><th>When</th><th>Price</th><th>Qty</th><th>Total</th><th>Source</th><th>Note</th><th></th></tr></thead><tbody>
    ${sortedP.map((p) => ui.edit.purchase === p.id ? `<tr><td colspan="7">${purchaseForm(i, p)}</td></tr>` : `<tr><td class="muted">${weekLabel(weekIndex(p.date, DUE), REF.mia)}</td><td>${money(p.price, p.currency)}</td><td>${p.quantity}</td>
    <td><b>${money(lineTotal(p), p.currency, 2)}</b></td><td class="muted">${esc(p.source)}</td><td class="faint">${esc(p.note)}</td>
    <td><button class="linkbtn" data-act="purchase-edit" data-pid="${p.id}">Edit</button> <button class="linkbtn red" data-act="purchase-delete" data-id="${i.id}" data-pid="${p.id}">Delete</button></td></tr>`).join('')}
    </tbody></table><p style="font-weight:500;font-size:14px">Spent so far: ${sum}${sortedP.length > 1 ? ` <span class="faint">(${sortedP.length} purchases)</span>` : ''}</p>` : '<p class="faint">No purchases recorded.</p>') +
    (ui.edit.purchase ? '' : '<button class="btn ghost" data-act="purchase-new">+ Record a purchase</button>')
}

const refTable = (i) => `<table><thead><tr><th>When</th><th>Price</th><th>Qty</th><th>Source</th><th>Note</th></tr></thead><tbody>
  ${[...i.refPurchases].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<tr><td class="muted">${weekLabel(weekIndex(p.date, BIRTH), REF.matiss)}</td><td>${money(p.price, p.currency)}</td><td>${p.quantity}</td><td class="muted">${esc(p.source)}</td><td class="faint">${esc(p.note)}</td></tr>`).join('')}</tbody></table>`

function priceStats(entries, now = new Date()) {
  const sortedE = [...entries].sort((a, b) => b.date.localeCompare(a.date)), latest = sortedE[0]
  const lowestSince = (days) => {
    const since = new Date(now.getTime() - days * 86400000), inWin = entries.filter((e) => new Date(e.date) >= since)
    return inWin.length ? Math.min(...inWin.map((e) => e.price)) : null
  }
  const lows = [['30 days', lowestSince(30)], ['90 days', lowestSince(90)], ['year', lowestSince(365)]]
  return { latest, best: lows.find(([, low]) => low != null && latest.price <= low) }
}

function priceHistory(i) {
  // Lows only make sense within one currency, so stats use the latest entry's currency.
  const sortedE = [...i.priceLog].sort((a, b) => b.date.localeCompare(a.date))
  let banner = ''
  if (sortedE.length) {
    const cur = sortedE[0].currency, { latest, best } = priceStats(i.priceLog.filter((e) => e.currency === cur))
    banner = `<div class="banner${best ? ' good' : ''}">Current price ${money(latest.price, cur)} (${latest.date}) ${best ? `— lowest it's been in the last ${best[0]}.` : '— not currently at its lowest.'}</div>`
  }
  return banner + (sortedE.length ? `<table><thead><tr><th>Date</th><th>Price</th><th>Source</th><th>Note</th></tr></thead><tbody>
    ${sortedE.map((e) => `<tr><td>${esc(e.date)}</td><td>${money(e.price, e.currency)}</td><td>${esc(e.source)}</td><td class="faint">${esc(e.note)}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">No price history logged yet.</p>') +
    `<form data-form="pricelog" class="inline" style="margin-top:10px"><label>Price (${CURRENCIES[db.currency]})<input name="price" type="number" step="0.01" required style="width:84px"></label>
    <label>Date<input name="date" type="date" value="${today()}"></label><label>Source<input name="source" value="Amazon" style="width:96px"></label>
    <label>Note<input name="note" style="width:128px"></label><button class="btn" type="submit">Add</button></form>`
}

// A row in the panel: closed until opened, like the subcategories in the lists.
const pacc = (key, title, body, n) => acc('p:' + key, `<span class="name">${title}</span>${n ? `<span class="count">${n}</span>` : ''}`, `<div class="p-body">${body}</div>`, 'p')

function itemDetails(i) {
  return `<div class="p-move"><label>List${sel(`data-chg="move-section" data-id="${i.id}" aria-label="Move to list"`, SECTIONS.map((x) => [x, x]), i.section)}</label>
    <span class="mv"><button data-act="move" data-dir="-1" data-id="${i.id}" aria-label="Move up">▲</button><button data-act="move" data-dir="1" data-id="${i.id}" aria-label="Move down">▼</button></span></div>
    ${itemForm(i)}
    <div class="p-foot">${i.owned ? `<button class="linkbtn" data-act="toggle-owned" data-id="${i.id}">Mark as not have</button>` : '<span></span>'}${i.retired ? '' : `<button class="linkbtn red" data-act="toggle-retired" data-id="${i.id}">Retire this item</button>`}</div>`
}

// Pressing "Decided" asks for the link first, then "have you bought it?", then the price paid (the purchase form).
const decideBox = () => ui.edit.decide === 'link'
  ? `<form data-form="decide" class="havebox"><b>What did you decide on?</b>
      <label>Link to the product<input name="link" type="url" inputmode="url" required placeholder="https://" autocomplete="off"></label>
      <div class="actions"><button class="btn" type="submit">Save as decided</button><button class="linkbtn" type="button" data-act="decide-skip">Decide without a link</button><button class="linkbtn" type="button" data-act="decide-cancel">Cancel</button></div></form>`
  : ui.edit.decide === 'bought'
    ? `<div class="havebox"><b>Have you bought it?</b><div class="actions"><button class="btn" data-act="bought-yes">Yes, enter the price</button><button class="btn ghost" data-act="bought-no">Not yet</button></div></div>` : ''

function panel(i) {
  const bag = i.section === BAG, ref = i.refPurchases?.length, facts = factsOf(i, bag), pills = pillsHtml(i, bag, false)
  const status = bag ? [['0', 'Not packed', !i.packed], ['1', 'Packed', i.packed]] : [['0', 'Not decided', i.decision !== 'decided'], ['1', 'Decided', i.decision === 'decided']]
  return `<p class="p-eyebrow">${esc(SHORT[i.section] || i.section)} · ${esc(bag ? bagLabel(i.subcategory) : i.subcategory)}</p>
    <div class="p-title"><h2>${nameHtml(i)}</h2>${star(i)}</div>
    ${i.product ? `<p class="p-prod"><small>What Maja &amp; Marko bought</small>${i.links.length ? `<a href="${esc(safeUrl(i.links[0].url))}" target="_blank" rel="noopener noreferrer">${esc(i.product)} ↗</a>` : esc(i.product)}</p>` : ''}
    <p class="p-price">${i.price != null ? `<b>${money(i.price, i.currency)}</b><small>${ref ? 'what Maja and Marko paid' : 'price'}</small>` : '<small>No price yet</small>'}</p>
    ${i.retired ? `<p class="banner">This item is retired. <button class="linkbtn" data-act="toggle-retired" data-id="${i.id}">Restore</button></p>` : ''}
    ${facts.length ? `<p class="card-line p-facts">${facts.join(' · ')}</p>` : ''}${pills ? `<div class="badges p-tags">${pills}</div>` : ''}
    <div class="seg" role="group" aria-label="Status">${status.map(([v, t, on]) => `<button data-act="set-status" data-v="${v}" class="${on ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${i.links.length ? `<div class="p-links">${linkChips(i.links)}</div>` : ''}
    ${decideBox()}
    ${ui.edit.purchase === 'new' ? `<div class="havebox"><b>${i.owned ? 'Record a purchase' : 'Mark as have: what did you pay?'}</b>${purchaseForm(i, null)}
      ${i.owned ? '' : `<button class="linkbtn" data-act="have-no-details" data-id="${i.id}">Mark as have without details (e.g. a gift)</button>`}</div>`
      : i.owned || ui.edit.decide ? '' : `<button class="add" data-act="toggle-owned" data-id="${i.id}">Mark as have</button>`}
    <div class="p-accs">
      ${pacc('buy', 'Purchases', purchaseSection(i), i.purchases.length)}
      ${ref ? pacc('ref', 'How it went with Matiss', refTable(i), i.refPurchases.length) : ''}
      ${pacc('com', 'Comments', commentSection(i), i.comments.length)}
      ${i.recurring ? pacc('price', 'Price history', priceHistory(i), i.priceLog.length) : ''}
      ${pacc('details', 'Details', itemDetails(i))}
    </div>`
}

function addForm() {
  const opts = SECTIONS.map((x) => `<optgroup label="${esc(x)}">${(SUBCATEGORIES[x] || []).map((sub) => `<option value="${esc(x + '|' + sub)}"${x + '|' + sub === ui.addTo ? ' selected' : ''}>${esc(x === BAG ? bagLabel(sub) : sub)}</option>`).join('')}</optgroup>`).join('')
  return `<form data-form="add" class="fgrid" style="grid-template-columns:1fr"><h2 style="font:600 18px var(--sans)">Add an item</h2>
    <label>Name<input name="name" required></label>
    <label>List${`<select name="subcategory">${opts}</select>`}</label>
    <label>When to buy${sel('name="when"', [['', '—'], ['before', 'Before birth'], ['after', 'After birth']], '')}</label>
    <label>Price (${CURRENCIES[db.currency]}) — optional<input name="price" type="number" step="0.01"></label>
    <label class="check" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="blackFriday"> Buy on Black Friday</label>
    <div><button class="btn" type="submit">Add item</button></div></form>`
}

// ---------- render ----------
function render() {
  const locked = localStorage.getItem(UNLOCKED) !== '1'
  document.body.classList.toggle('locked', locked)
  if (locked) return renderLock()
  const { path, params } = route()
  syncTop(path)
  const page = path === '/retired' ? retiredPage() : path === '/spending' ? spending() : board(params)
  $('#app').innerHTML = (saveFailed ? '<div class="warn">This browser is blocking saving — changes will be lost when you close the page.</div>' : '') +
    `<main>${page}</main>` +
    `<div class="footer"><button class="linkbtn" data-act="backup">Download backup</button>
     <label class="linkbtn" style="cursor:pointer">Restore from backup<input type="file" accept="application/json" data-chg="restore" hidden></label>
     <label class="linkbtn">New prices in ${sel('data-chg="currency" aria-label="Currency for new prices" title="Currency used for every new price you enter"', Object.entries(CURRENCIES).map(([c, sym]) => [c, `${sym} ${c}`]), db.currency)}</label>
     <span>Your list is saved in this browser only.</span></div>`
  renderOverlay(true)
}

// The item panel is one persistent sheet (index.html): it slides up on phones and sits beside the list on desktop.
function renderOverlay(resetScroll) {
  const keep = resetScroll ? 0 : $('#dc').scrollTop
  const i = ui.openId && item(ui.openId), on = ui.adding || !!i
  if (on) $('#dc').innerHTML = ui.adding ? addForm() : panel(i)
  $('#overlay').classList.toggle('open', on)
  document.body.classList.toggle('panel-open', on)
  document.querySelectorAll('.card.on').forEach((c) => c.classList.remove('on'))
  if (i) document.querySelector(`.card[data-id="${i.id}"]`)?.classList.add('on')
  if (on) $('#dc').scrollTop = keep
}

const refresh = () => { save(); render2() }
function render2() { // re-render page but keep the open panel's scroll position
  const keep = $('#dc').scrollTop
  render()
  $('#dc').scrollTop = keep
}

function renderLock() {
  $('#overlay').classList.remove('open')
  $('#app').innerHTML = `<div class="lock"><div><p class="eyebrow">${dueLabel()}</p><h1>Luka<span>.</span></h1></div>
    <form data-form="lock"><input type="password" name="pw" placeholder="Password" aria-label="Password" autofocus required><button class="btn" type="submit">Enter</button><p class="err" id="lock-err"></p></form></div>`
  $('input[name=pw]')?.focus()
}

// ---------- actions ----------
const siblings = (i) => db.items.filter((x) => !x.retired && x.section === i.section && x.subcategory === i.subcategory).sort((a, b) => a.order - b.order)

const actions = {
  open: (el) => { if (ui.openId !== el.dataset.id) ui.pOpen.clear(); ui.openId = el.dataset.id; ui.adding = false; ui.edit = { purchase: null }; renderOverlay(true) },
  close: () => { ui.openId = null; ui.adding = false; renderOverlay(true) },
  add: () => { ui.adding = true; ui.openId = null; renderOverlay(true); $('#overlay input[name=name]')?.focus() },
  star: (el) => { const i = item(el.dataset.id); i.starred = !i.starred; refresh() },
  toggle: (el) => { // opens or closes a subcategory in place: no re-render, so the height can ease
    const box = el.closest('.acc'), on = !box.classList.contains('open'), k = el.dataset.key
    box.classList.toggle('open', on); el.setAttribute('aria-expanded', on)
    box.querySelector(':scope > .acc-p > div').inert = !on
    const set = k.startsWith('p:') ? ui.pOpen : ui.open
    on ? set.add(k) : set.delete(k)
    if (on && set === ui.open) ui.addTo = k // "+" then offers the subcategory you were just looking at
  },
  sec: (el) => { // switching list redraws only the list column, so the rail keeps its place
    if (ui.sec === el.dataset.v) return
    ui.sec = el.dataset.v; ui.openId = null; ui.adding = false
    redrawRail(); $('#lcol').innerHTML = listCol(); renderOverlay(true)
    $('#lcol').classList.remove('enter'); void $('#lcol').offsetWidth; $('#lcol').classList.add('enter')
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); scrollTo(0, 0)
  },
  timing: (el) => { // if the list on show has nothing for that time, move to the first list that has
    ui.filters.timing = el.dataset.v
    if (!visible(ui.sec).length) ui.sec = SECTIONS.find((x) => visible(x).length) || ui.sec
    redrawList()
  },
  'filters-toggle': (el) => { const p = $('#fpanel'); p.hidden = !p.hidden; ui.filtersOpen = !p.hidden; el.setAttribute('aria-expanded', ui.filtersOpen) },
  'spend-who': (el) => { ui.spend.who = el.dataset.v; ui.spend.adding = false; render2() },
  'spend-add': () => { ui.spend.adding = !ui.spend.adding; render2(); $('input[name=item]')?.focus() },
  move: (el) => {
    const i = item(el.dataset.id), sibs = siblings(i)
    const dir = Number(el.dataset.dir), other = sibs[sibs.indexOf(i) + dir]
    if (other) { if (i.order === other.order) i.order += dir * 0.5; else [i.order, other.order] = [other.order, i.order] }
    refresh()
  },
  // marking as "have" first asks what was paid; the purchase form then records it and marks the item owned
  'set-status': (el) => {
    const i = item(ui.openId), on = el.dataset.v === '1'
    if (i.section === BAG) { i.packed = on; refresh() }
    else if (on && i.decision !== 'decided') { ui.edit.decide = 'link'; renderOverlay() } // ask for the link before it counts as decided
    else if (!on) { i.decision = 'undecided'; ui.edit.decide = null; refresh() }
  },
  'decide-skip': () => { item(ui.openId).decision = 'decided'; ui.edit.decide = 'bought'; refresh() },
  'decide-cancel': () => { ui.edit.decide = null; renderOverlay() },
  'bought-yes': () => { ui.edit.decide = null; ui.edit.purchase = 'new'; renderOverlay(); $('#dc input[name=price]')?.focus() },
  'bought-no': () => { ui.edit.decide = null; renderOverlay() },
  'toggle-owned': (el) => { const i = item(el.dataset.id); if (i.owned) { i.owned = false; refresh() } else { ui.edit.purchase = 'new'; renderOverlay(true) } },
  'have-no-details': (el) => { item(el.dataset.id).owned = true; ui.edit.purchase = null; refresh() },
  'purchase-new': () => { ui.edit.purchase = 'new'; renderOverlay(true) },
  'toggle-retired': (el) => { const i = item(el.dataset.id); i.retired = !i.retired; refresh() },
  'comment-delete': (el) => { const i = item(el.dataset.id); i.comments = i.comments.filter((c) => c.id !== el.dataset.cid); refresh() },
  'purchase-edit': (el) => { ui.edit.purchase = el.dataset.pid; renderOverlay() },
  'purchase-cancel': () => { ui.edit.purchase = null; renderOverlay() },
  'purchase-delete': (el) => { const i = item(el.dataset.id); i.purchases = i.purchases.filter((p) => p.id !== el.dataset.pid); refresh() },
  backup: () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }))
    a.download = `luka-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}

const forms = {
  lock: (f) => {
    if (new FormData(f).get('pw').trim().toLowerCase() === PASSWORD) { localStorage.setItem(UNLOCKED, '1'); render() }
    else $('#lock-err').textContent = 'Wrong password.'
  },
  add: (f) => {
    const fd = new FormData(f), [section, sub] = String(fd.get('subcategory')).split('|')
    const inSec = db.items.filter((i) => i.section === section), inSub = inSec.filter((i) => i.subcategory === sub)
    // joins the end of its subcategory (or the end of the section if the subcategory is still empty)
    const order = inSub.length ? Math.max(...inSub.map((i) => i.order)) + 1 : inSec.reduce((m, i) => Math.max(m, i.order), 0) + 1000
    db.items.push({
      id: uid(), name: fd.get('name').trim(), product: '', section, subcategory: sub, price: num(fd.get('price')),
      currency: db.currency, decision: 'undecided', when: fd.get('when'), blackFriday: fd.get('blackFriday') === 'on', buyType: '', qty: null, age: '', plan: 'buy', store: '', verdict: '', bag: section === BAG ? sub : '', bagOrder: 999, packed: false, recurring: false, owned: false, retired: false, starred: false,
      links: [], order, note: '', comments: [], purchases: [], refPurchases: [], priceLog: [],
    })
    ui.adding = false; ui.sec = section; ui.open.add(`${section}|${sub}`) // so the new item is visible
    refresh()
  },
  spendadd: (f) => {
    const fd = new FormData(f), it = db.items.find((x) => !x.retired && `${x.name} · ${x.section}` === fd.get('item').trim())
    if (!it) { $('#sp-err').textContent = 'Pick an item from the suggestions as you type.'; return }
    it.purchases.push({ id: uid(), currency: db.currency, price: Number(fd.get('price')), quantity: Math.max(1, Number(fd.get('quantity')) || 1), date: fd.get('date') || today(), source: fd.get('source').trim(), note: '' })
    it.owned = true // recording a purchase also marks it owned
    ui.spend.adding = false; ui.spend.who = 'mia'
    refresh()
  },
  item: (f) => {
    const i = item(ui.openId), fd = new FormData(f)
    const price = num(fd.get('price'))
    if (price !== i.price) i.currency = db.currency // editing a price is a new entry, so it takes the current currency
    Object.assign(i, {
      name: fd.get('name').trim() || i.name, subcategory: fd.get('subcategory'), product: fd.get('product').trim(),
      qty: num(fd.get('qty')), age: fd.get('age').trim(), plan: fd.get('plan'), store: fd.get('store').trim(), verdict: fd.get('verdict'),
      bag: i.section === BAG ? fd.get('subcategory') : fd.get('bag'), // hospital-bag items keep bag and subcategory the same
      price, decision: fd.get('decision') || i.decision, packed: f.querySelector('[name=packed]') ? fd.get('packed') === 'on' : i.packed, when: fd.get('when'), buyType: fd.get('buyType'), recurring: fd.get('recurring') === 'on', blackFriday: fd.get('blackFriday') === 'on',
      links: textToLinks(fd.get('links')), note: fd.get('note').trim(),
    })
    refresh()
  },
  decide: (f) => {
    const i = item(ui.openId), link = new FormData(f).get('link').trim()
    if (link && !i.links.some((l) => l.url === link)) i.links.push({ url: link, label: 'Decided on' })
    i.decision = 'decided'; ui.edit.decide = 'bought'
    refresh()
  },
  comment: (f) => {
    const text = new FormData(f).get('text').trim()
    if (text) item(ui.openId).comments.push({ id: uid(), text, at: Date.now() })
    refresh()
  },
  purchase: (f) => {
    const i = item(ui.openId), fd = new FormData(f), pid = fd.get('pid')
    const data = { price: Number(fd.get('price')), quantity: Math.max(1, Number(fd.get('quantity')) || 1), date: fd.get('date') || today(), source: fd.get('source').trim(), note: fd.get('note').trim() }
    if (pid) Object.assign(i.purchases.find((p) => p.id === pid), data) // an edited row keeps its currency
    else { i.purchases.push({ id: uid(), currency: db.currency, ...data }); i.owned = true } // recording a purchase also marks it owned
    ui.edit.purchase = null
    refresh()
  },
  pricelog: (f) => {
    const fd = new FormData(f)
    item(ui.openId).priceLog.push({ id: uid(), price: Number(fd.get('price')), currency: db.currency, date: fd.get('date') || today(), source: fd.get('source').trim(), note: fd.get('note').trim() })
    refresh()
  },
}

const redrawList = () => { openMatches(); $('#lcol').innerHTML = listCol(); redrawRail() }
const changes = {
  currency: (el) => { db.currency = el.value; refresh() },
  filter: (el) => { ui.filters[el.dataset.key] = el.value; redrawList() },
  'filter-fav': (el) => { ui.filters.fav = el.checked; redrawList() },
  'filter-bf': (el) => { ui.filters.bf = el.checked; redrawList() },
  spend: (el) => { ui.spend[el.dataset.key] = el.value; render2() },
  'move-section': (el) => { const i = item(el.dataset.id), wasBag = i.section === BAG; i.section = el.value; i.subcategory = SUBCATEGORIES[el.value][0]; i.bag = el.value === BAG ? i.subcategory : wasBag ? '' : i.bag; refresh() }, // subcategories belong to a section
  restore: (el) => {
    const file = el.files[0]
    if (!file) return
    file.text().then((t) => {
      let data
      try { data = JSON.parse(t) } catch { return alert('That file is not a valid backup.') }
      if (!Array.isArray(data.items)) return alert('That file is not a valid backup.')
      if (!confirm(`Replace everything in this browser with the backup (${data.items.length} items)?`)) return
      db = data
      migrate()
      refresh()
    })
  },
}

document.addEventListener('click', (e) => {
  if (e.target.closest('a[href]')) return // links open their page; they don't trigger the card behind them
  const el = e.target.closest('[data-act]')
  if (el) actions[el.dataset.act]?.(el, e)
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (ui.openId || ui.adding)) {
    const d = $('#drawer'); d.classList.add('instant'); actions.close()
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('instant')))
  }
  const el = e.target.closest?.('.card[data-act]')
  if (el && e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); actions.open(el) }
})
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]')
  if (!f) return
  e.preventDefault()
  forms[f.dataset.form](f)
})
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]')
  if (el) changes[el.dataset.chg]?.(el)
})
document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { ui.filters.search = e.target.value; openMatches(); $('#list').innerHTML = list(); $('#lhead').innerHTML = listHead(); redrawRail() }
})
document.addEventListener('toggle', (e) => { const k = e.target.dataset?.opt; if (k) ui.spend[k] = e.target.open }, true) // keeps the Spending disclosures open across re-renders
{
  const sheet = $('#drawer'), grip = $('#drag'); let sy = 0, dy = 0, t0 = 0, dragging = false
  grip.addEventListener('pointerdown', (e) => { if (dragging) return; dragging = true; sy = e.clientY; dy = 0; t0 = performance.now(); grip.setPointerCapture(e.pointerId); sheet.style.transition = 'none' })
  grip.addEventListener('pointermove', (e) => { if (!dragging) return; const d = e.clientY - sy; dy = d < 0 ? -Math.sqrt(-d) * 2.4 : d; sheet.style.transform = `translateY(${dy}px)` })
  const end = () => { if (!dragging) return; dragging = false; const v = dy / Math.max(1, performance.now() - t0); sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 120 || (dy > 12 && v > 0.11)) actions.close() }
  grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end)
}
new ResizeObserver(() => document.documentElement.style.setProperty('--hh', $('#top').offsetHeight + 'px')).observe($('#top')) // sticky offsets follow the header
window.addEventListener('hashchange', () => { ui.openId = null; ui.adding = false; render(); scrollTo(0, 0) })
render()
