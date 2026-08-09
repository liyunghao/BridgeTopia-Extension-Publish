const SERVER = 'https://bridgetopia.long-becrux.ts.net'

async function target() {
  if (!(await chrome.permissions.contains({ origins: [`${SERVER}/*`] }))) {
    throw new Error(`沒有 ${SERVER} 的權限，去 chrome://extensions 把這個擴充的網站存取權打開`)
  }
  return SERVER
}

let writes = Promise.resolve()
function serialise(job) {
  const done = writes.then(job, job)
  writes = done.catch(() => {})
  return done
}

function enqueue(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return Promise.resolve()
  return serialise(async () => {
    const { pending = [] } = await chrome.storage.local.get('pending')
    await chrome.storage.local.set({ pending: [...pending, ...sessions] })
  })
}

async function post(sessions) {
  const res = await fetch(`${await target()}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'bbo-myhands', sessions }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let msg = body
    try {
      const { error } = JSON.parse(body)
      if (typeof error === 'string') msg = error
    } catch {}
    throw new Error(`伺服器回 ${res.status}${msg ? `：${msg.slice(0, 200)}` : ''}`)
  }
  return res.json().catch(() => ({}))
}

function removeBoards(ids) {
  const gone = new Set(ids)
  return serialise(async () => {
    const { pending = [] } = await chrome.storage.local.get('pending')
    const left = pending
      .map((s) => ({ ...s, boards: s.boards.filter((b) => !gone.has(b.id)) }))
      .filter((s) => s.boards.length > 0)
    await chrome.storage.local.set({ pending: left })
  })
}

async function importPending() {
  const { pending = [] } = await chrome.storage.local.get('pending')
  const sent = new Set(pending.flatMap((s) => s.boards.map((b) => b.id)))
  if (sent.size === 0) return { boards: 0 }

  const body = await post(pending)

  await removeBoards(sent)

  return { boards: sent.size, imported: body.imported }
}


chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'enqueue') {
    enqueue(msg.sessions)
      .then(() => reply({ ok: true }))
      .catch((err) => reply({ ok: false, error: err.message }))
    return true
  }
  if (msg?.type === 'remove') {
    removeBoards(msg.ids ?? [])
      .then(() => reply({ ok: true }))
      .catch((err) => reply({ ok: false, error: err.message }))
    return true
  }
  if (msg?.type !== 'import') return false
  importPending()
    .then((r) => reply({ ok: true, ...r }))
    .catch((err) => reply({ ok: false, error: err.message }))
  return true // reply comes later
})
