const $ = (id) => document.getElementById(id)

const handle = $('handle')
const from = $('from')
const to = $('to')
const pending = $('pending')
const pick = $('pick')
const goBtn = $('go')
const toggleBtn = $('toggleBtn')
const surveyBtn = $('surveyBtn')
const importBtn = $('importBtn')
const clearBtn = $('clearBtn')
const importBar = $('importBar')
const findState = $('findState')
const pullState = $('pullState')
const statusLine = $('statusLine')
const progress = $('progress')
const bar = $('bar')
const server = $('server')
const serverPanel = $('serverPanel')
const serverSave = $('serverSave')
const serverState = $('serverState')

const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text })

function state(node, text, kind = '') {
  node.className = text ? `state ${kind}` : ''
  node.replaceChildren(...[text].flat())
}

function setStep(n) {
  for (const s of document.querySelectorAll('.step')) {
    s.classList.toggle('on', Number(s.dataset.step) === n)
  }
}

const iso = (d) => d.toLocaleDateString('sv')

const isoDaysAgo = (days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return iso(d)
}

const monthStart = () => {
  const d = new Date()
  d.setDate(1)
  return iso(d)
}

function litChip(chip) {
  for (const c of document.querySelectorAll('.chip')) c.classList.toggle('on', c === chip)
}

async function chosenRange() {
  const username = handle.value.trim()
  if (!username) throw new Error('請填你的 BBO 帳號')
  if (!from.value || !to.value) throw new Error('請填日期範圍')
  if (from.value > to.value) {
    [from.value, to.value] = [to.value, from.value]
  }

  await chrome.storage.sync.set({ handle: username })
  return { username, from: from.value, to: to.value }
}


function card(s, checked) {
  const done = s.boards.length === 0
  const row = document.createElement('label')
  row.className = done ? 'card done' : 'card'

  const box = Object.assign(document.createElement('input'), {
    type: 'checkbox',
    disabled: done,
    checked,
  })
  box.addEventListener('change', refresh)

  const title = Object.assign(el('div', ''), { className: 'title' })
  title.append(el('span', s.label || s.date))
  if (done) title.append(Object.assign(el('span', '已下載'), { className: 'badge' }))

  const bits = [s.date.slice(5), s.kind || '不明', `${done ? s.total : s.boards.length} 副`]
  if (!done && s.queued) bits.push(`另 ${s.queued} 副已下載`)
  if (s.whole) bits.push('含對桌')

  row.append(box, title, Object.assign(el('div', bits.join(' · ')), { className: 'meta' }))
  return { row, box, s }
}

const keyOf = (s) => `${s.date}|${s.label}`

let picked = []

let pulling = false
const chosen = () => picked.filter(({ box }) => box.checked).map(({ s }) => s)
const boardCount = (ss) => ss.reduce((n, s) => n + s.boards.length, 0)
const selectable = () => picked.filter(({ s }) => s.boards.length > 0)

function toggleAll() {
  const on = selectable().every(({ box }) => box.checked)
  for (const { box } of selectable()) box.checked = !on
  refresh()
}

function refresh() {
  const n = boardCount(chosen())
  goBtn.disabled = pulling || n === 0
  goBtn.textContent = n ? `下載勾選的 ${n} 副` : '沒有勾選任何 session'
  const sel = selectable()
  toggleBtn.hidden = sel.length === 0
  toggleBtn.textContent = sel.every(({ box }) => box.checked) ? '全不選' : '全選'
}

async function showSurvey(r, redraw = false) {
  if (!r) return
  const ticks = redraw ? new Map(picked.map(({ s, box }) => [keyOf(s), box.checked])) : null
  if (!redraw) {
    from.value = r.from
    to.value = r.to
    litChip(null)
  }

  if (r.sessions.length === 0) {
    picked = []
    pick.hidden = true
    state(
      findState,
      [
        el(
          'p',
          r.rows > 0
            ? `${r.from} 到 ${r.to} 這段沒有牌局。帳號「${r.username}」是好的：` +
                `BBO 回了 ${r.rows} 列的清單，帳號不對的話一列都不會有。把起始日往前拉。`
            : `BBO 沒有回出清單（0 列）。可能是那個分頁登出了，或帳號「${r.username}」不存在。`,
        ),
        Object.assign(el('p', r.url), { className: 'url' }),
      ],
      'empty',
    )
    return
  }

  const already = await queuedIds()
  const sessions = r.sessions.map((s) => {
    const boards = s.boards.filter((b) => !already.has(b.id))
    return { ...s, boards, queued: s.total - boards.length }
  })

  let firstFresh = true
  picked = sessions.map((s) => {
    const entry = card(s, ticks ? Boolean(ticks.get(keyOf(s))) : s.boards.length > 0 && firstFresh)
    if (s.boards.length > 0) firstFresh = false
    return entry
  })

  pick.hidden = false
  $('foundCount').textContent = `找到 ${sessions.length} 個 session（${r.at}）`
  $('found').replaceChildren(...picked.map(({ row }) => row))
  refresh()
  setStep(sessions.some((s) => s.boards.length > 0) || !already.size ? 2 : 3)
}

async function doSurvey() {
  surveyBtn.disabled = true
  picked = []
  $('found').replaceChildren()
  pick.hidden = true
  refresh()
  state(findState, '查詢中…')
  try {
    const range = await chosenRange()
    const r = await ask({ type: 'survey', range })
    state(findState, '')
    const survey = { ...r, username: range.username, at: new Date().toTimeString().slice(0, 5) }
    await chrome.storage.local.set({ survey })
    await showSurvey(survey)
  } catch (err) {
    state(findState, `失敗：${err.message}`, 'err')
  } finally {
    surveyBtn.disabled = false
  }
}

const PROGRESS_STALE_MS = 30_000

async function liveProgress() {
  const { progress: p } = await chrome.storage.local.get('progress')
  if (!p) return null
  if (Date.now() - (p.at ?? 0) < PROGRESS_STALE_MS) return p
  await chrome.storage.local.remove('progress')
  return null
}

function showProgress(p) {
  progress.hidden = !p
  if (!p) return
  pick.hidden = false
  bar.max = p.total || 1
  bar.value = p.done
  $('progressText').textContent = p.text
}

async function doPull(sessions) {
  pulling = true
  goBtn.disabled = true
  state(pullState, `下載 ${boardCount(sessions)} 副中，可以關掉這個視窗，下載會繼續。`)
  try {
    const r = await ask({ type: 'pull', sessions })
    state(
      pullState,
      r.error
        ? `存下 ${r.boards}/${r.total} 副後停住：${r.error}。等一下再按查詢，會只補剩下的。`
        : `已存下 ${r.boards} 副。`,
      r.error ? 'warn' : '',
    )
  } catch (err) {
    state(pullState, `失敗：${err.message}`, 'err')
  } finally {
    pulling = false
    await render()
    refresh()
  }
}

const DEFAULT_SERVER = 'http://localhost:8080'

function originOf(text) {
  try {
    const { protocol, origin } = new URL(text)
    return protocol === 'http:' || protocol === 'https:' ? origin : null
  } catch {
    return null
  }
}

function saveServer() {
  const origin = originOf(server.value.trim())
  if (!origin) return state(serverState, '位址要像 http://主機:埠號', 'err')

  void chrome.permissions.request({ origins: [`${origin}/*`] }).then(async (granted) => {
    if (!granted) return state(serverState, '沒有授權這個位址，目的地沒有改。', 'err')
    await chrome.storage.sync.set({ server: origin })
    server.value = origin
    state(serverState, `匯入會送到 ${origin}`)
  })
}


async function queuedIds() {
  const { pending: sessions = [] } = await chrome.storage.local.get('pending')
  return new Set(sessions.flatMap((s) => s.boards.map((b) => b.id)))
}

function queuedRow(s) {
  const name = s.label || s.date
  const drop = Object.assign(el('button', '✕'), {
    className: 'ghost link drop',
    title: `把「${name}」移出佇列（不動其他場）`,
  })
  drop.addEventListener('click', () => void dropSession(s, name))
  const row = Object.assign(document.createElement('div'), { className: 'qrow' })
  row.append(el('span', `${name} · ${s.date.slice(5)} · ${s.boards.length} 副`), drop)
  return row
}

async function dropSession(s, name) {
  let reply
  try {
    reply = await chrome.runtime.sendMessage({ type: 'remove', ids: s.boards.map((b) => b.id) })
  } catch (err) {
    reply = { ok: false, error: err.message }
  }
  state(
    statusLine,
    reply?.ok
      ? `已移出「${name}」。這幾副沒有匯入；之後查詢那個日期可以重新下載。`
      : `移出失敗：${reply?.error ?? '沒有回應'}`,
    reply?.ok ? '' : 'err',
  )
  await render()
}

async function render() {
  const { pending: sessions = [] } = await chrome.storage.local.get('pending')
  const boards = sessions.reduce((n, s) => n + s.boards.length, 0)

  importBtn.disabled = boards === 0
  clearBtn.disabled = boards === 0
  $('pendingCount').textContent = boards ? `${boards} 副 · ${sessions.length} 個 session` : ''
  pending.className = boards ? '' : 'note'
  if (boards) {
    pending.replaceChildren(...sessions.map(queuedRow))
  } else {
    pending.textContent = '尚無待匯入的牌局。查詢後勾選 session 即可下載。'
  }
  return boards
}

async function doImport() {
  importBtn.disabled = true
  importBar.hidden = false
  state(statusLine, '匯入中…')
  let reply
  try {
    reply = await chrome.runtime.sendMessage({ type: 'import' })
  } catch (err) {
    reply = { ok: false, error: `${err.message}（佇列沒有動，可以再按一次）` }
  } finally {
    importBar.hidden = true
    importBtn.disabled = false
  }
  state(
    statusLine,
    reply?.ok
      ? `匯入了 ${reply.imported ?? reply.boards} 副。`
      : `失敗：${reply?.error ?? '沒有回應'}`,
    reply?.ok ? '' : 'err',
  )
  await render()
  setStep(reply?.ok ? 1 : 3)
}

async function doClear() {
  if (!confirm('清除所有等待匯入的牌局？已下載的內容會消失，需要重新下載。')) return
  await chrome.storage.local.remove('pending')
  state(statusLine, '已清除。')
  await render()
}

const SPRINGBOARD = ['src/parse.js', 'src/pull.js', 'src/listen.js']

async function ask(msg) {
  const [tab] = await chrome.tabs.query({ url: 'https://www.bridgebase.com/*' })
  if (!tab) throw new Error('請先開著一個 bridgebase.com 的分頁並保持登入')
  let reply
  try {
    reply = await chrome.tabs.sendMessage(tab.id, msg)
  } catch {
    const { status } = await chrome.tabs.get(tab.id)
    if (status !== 'complete') throw new Error('那個 BBO 分頁還在載入，等一下再按一次')
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: SPRINGBOARD })
    reply = await chrome.tabs.sendMessage(tab.id, msg)
  }
  if (!reply?.ok) throw new Error(reply?.error ?? '沒有回應')
  return reply
}

for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    from.value = chip.dataset.days === 'month' ? monthStart() : isoDaysAgo(Number(chip.dataset.days))
    to.value = isoDaysAgo(0)
    litChip(chip)
  })
}
for (const box of [from, to]) box.addEventListener('input', () => litChip(null))

goBtn.addEventListener('click', () => void doPull(chosen()))
toggleBtn.addEventListener('click', toggleAll)
surveyBtn.addEventListener('click', () => void doSurvey())
importBtn.addEventListener('click', () => void doImport())
clearBtn.addEventListener('click', () => void doClear())

$('serverBtn').addEventListener('click', () => {
  serverPanel.hidden = !serverPanel.hidden
  if (!serverPanel.hidden) server.focus()
})
serverSave.addEventListener('click', saveServer)
server.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveServer()
})

chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.progress) showProgress(changes.progress.newValue)
  if (!changes.pending) return
  await render()
  const { survey } = await chrome.storage.local.get('survey')
  await showSurvey(survey, true)
})

async function onBoot() {
  document.querySelector('.chip').click()
  setStep(1)

  const { handle: saved = '', server: dst = DEFAULT_SERVER } = await chrome.storage.sync.get([
    'handle',
    'server',
  ])
  handle.value = saved
  server.value = dst

  const queued = await render()
  showProgress(await liveProgress())

  const { survey } = await chrome.storage.local.get('survey')
  await showSurvey(survey)

  if (!survey && queued) setStep(3)
}

void onBoot()
