// Runs inside a page on www.bridgebase.com, and it has to: a fetch from there to
// /myhands/hands.php is same-origin, so the browser attaches the session by itself. Nothing
// here reads document.cookie and the extension has no "cookies" permission.
//
// It cannot move to the service worker — a fetch from there is cross-origin, where whether
// the session rides along is up to SameSite rather than up to us.

const FETCH_GAP_MS = 300

const MAX_GAP_MS = 2400

const RETRIES = 3

const BACKOFF_MS = 2000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const count = (sessions) => sessions.reduce((n, s) => n + s.boards.length, 0)


function midnight(isoDate) {
  return Math.floor(new Date(`${isoDate}T00:00:00`).getTime() / 1000)
}

function midnightAfter(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return Math.floor(d.getTime() / 1000)
}

function listingURL(username, from, to) {
  const p = new URLSearchParams({
    username,
    start_time: String(midnight(from)),
    end_time: String(midnightAfter(to)),
    // Without offset, hands.php does not serve the listing at all. It serves a bootstrap
    // page whose entire job is to run
    //
    //   document.tz_form.offset.value = new Date().getTimezoneOffset()
    //   document.tz_form.submit()
    //
    // and resubmit itself. A real navigation runs that script; DOMParser does not, so
    // fetching without this returns a page with no boards and no error to explain the
    // emptiness. That page's own no-JS fallback link is ?offset=0, i.e. this parameter.
    //
    // Minutes behind UTC, matching BBO's own form. The bounds above are already local
    // midnights, so this keeps both ends on the same clock.
    offset: String(new Date().getTimezoneOffset()),
  })
  return `https://www.bridgebase.com/myhands/hands.php?${p}`
}

async function listing(username, from, to) {
  const url = listingURL(username, from, to)
  const res = await fetch(url, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`BBO 的清單回 ${res.status}`)
  if (res.url.includes('myhands_login')) throw new Error('BBO 已登出，請重新登入')
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  const rows = rowsFromDocument(doc)
  return { sessions: groupSessions(rows), rows: rows.length, url }
}

function newestFirst(sessions) {
  return sessions.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

async function survey(range) {
  const { from, to } = range
  const { sessions: all, rows, url } = await listing(range.username, from, to)
  const already = idsOf(await queued())
  return {
    sessions: newestFirst(dedupe(all)).map((s) => {
      const fresh = s.boards.filter((b) => !already.has(b.id))
      return {
        ...s,
        boards: fresh,
        total: s.boards.length,
        queued: s.boards.length - fresh.length,
        whole: Boolean(s.teams && matchURL(s.tview)),
      }
    }),
    rows,
    url,
    from,
    to,
  }
}

function progressText(p) {
  return p.retryIn
    ? `${p.label}被 BBO 限流，${p.retryIn} 秒後重試（第 ${p.attempt}/${p.of} 次）…`
    : `下載中 ${p.done}/${p.total}…`
}

function report(p) {
  return p
    ? chrome.storage.local.set({
        progress: {
          done: p.done,
          total: p.total,
          text: progressText(p),
          at: Date.now(),
        },
      })
    : chrome.storage.local.remove('progress')
}

async function countdown(ms, notify, info) {
  const until = Date.now() + ms
  for (let left = ms; left > 0; left = until - Date.now()) {
    notify?.({ ...info, retryIn: Math.ceil(left / 1000) })
    await sleep(Math.min(1000, left))
  }
}

function pacer() {
  let ms = FETCH_GAP_MS
  return {
    wait: () => sleep(ms),
    slower: () => {
      ms = Math.min(ms * 2, MAX_GAP_MS)
    },
  }
}

async function grab(url, label, notify, pace) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return await res.text()
    if (res.status === 429) pace?.slower()
    if (res.status !== 429 || attempt === RETRIES) {
      throw new Error(`${label}回 ${res.status}`)
    }
    const after = Number(res.headers.get('Retry-After'))
    const waitMs = after > 0 ? after * 1000 : BACKOFF_MS * 2 ** attempt
    await countdown(waitMs, notify, { label, attempt: attempt + 1, of: RETRIES + 1 })
  }
}

function linFrom(xml, label) {
  const lin = new DOMParser().parseFromString(xml, 'application/xml').querySelector('lin')
  if (!lin || lin.getAttribute('err') !== '0') {
    throw new Error(`${label}拿不到牌（${lin?.getAttribute('errmsg') || '回應看不懂'}）`)
  }
  return lin.textContent.replace(/\n$/, '')
}

async function fetchBoards(sessions, onProgress) {
  const total = count(sessions)
  let done = 0
  const emit = (extra = {}) => onProgress?.({ done, total, ...extra })
  const pace = pacer()
  for (const session of sessions) {
    const whole = session.teams && matchURL(session.tview)
    if (whole) {
      const label = `整場 ${session.label}`
      let body
      try {
        body = await grab(whole, label, emit, pace)
      } catch (err) {
        return { done, total, error: err.message }
      }
      if (!body.includes('qx|')) {
        return { done, total, error: `${label}拿到的不是牌局檔（BBO 可能已登出）` }
      }
      session.match = body
      done += session.boards.length
      emit()
      await pace.wait()
      continue
    }
    for (const board of session.boards) {
      const label = `第 ${board.seq} 副`
      const url = handURL(board.url)
      if (!url) return { done, total, error: `${label}的連結看不懂，BBO 換了格式` }
      try {
        board.lin = linFrom(await grab(url, label, emit, pace), label)
      } catch (err) {
        return { done, total, error: err.message }
      }
      done++
      emit()
      await pace.wait()
    }
  }
  return { done, total }
}

async function queued() {
  const { pending = [] } = await chrome.storage.local.get('pending')
  return pending
}

async function enqueue(sessions) {
  const reply = await chrome.runtime.sendMessage({ type: 'enqueue', sessions })
  if (!reply?.ok) throw new Error(reply?.error ?? '存進待匯入清單失敗')
}

async function pull(chosen, onProgress) {
  const already = idsOf(await queued())
  const offered = (chosen ?? []).map(({ total, queued, whole, ...s }) => s)
  const sessions = dedupe(offered, already)
  if (sessions.length === 0) return { boards: 0, total: 0 }

  try {
    const { done, total, error } = await fetchBoards(sessions, (p) => {
      void report(p)
      onProgress?.(p)
    })
    const landed = fetched(sessions)
    if (landed.length) await enqueue(landed)
    return { boards: done, total, error }
  } finally {
    await report(null)
  }
}
