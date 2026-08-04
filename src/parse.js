// Reading BBO's myhands listing. Row shapes measured on a real account, 2026-07-29:
//
//   1 cell    "Hands played by «user» since «start» to «end»"   — the page title
//   3 cells   "Main Bridge Club hands | Tourney hands | Team Match hands"
//             — a legend of the three kinds, NOT a divider: a window shows only
//               the kinds you actually played
//   1 cell    "2026-07-17"                                      — a date separator
//  11 cells   Nº | Time | North | South | East | West | Result | Points | Score |
//             Movie | Traveller                                 — starts a session
//   5 cells   the team-match line, carrying a link to tview.php  — only for teams
//  11 cells   one board, carrying a link to fetchlin.php?id=…&when_played=…
//
// groupSessions takes plain data rather than a document so it can be tested in node with
// no DOM. rowsFromDocument is the only part that touches one.

const LISTING_BASE = 'https://www.bridgebase.com/myhands/hands.php'

function resolve(href) {
  return href ? new URL(href, LISTING_BASE).href : null
}

const KINDS = ['mbc', 'tourney', 'team']

function rowsFromDocument(doc) {
  return [...doc.querySelectorAll('tr')].map((tr) => ({
    cells: [...tr.children].map((td) => td.textContent.trim().replace(/\s+/g, ' ')),
    cls: KINDS.find((k) => tr.classList.contains(k)) ?? '',
    lin: resolve(tr.querySelector('a[href*="fetchlin"]')?.getAttribute('href')),
    tview: resolve(tr.querySelector('a[href*="tview"]')?.getAttribute('href')),
  }))
}

function matchURL(tview) {
  const id = tview && new URL(tview).searchParams.get('t')
  return id ? `https://www.bridgebase.com/myhands/fetchtm.php?id=${encodeURIComponent(id)}` : null
}

function handURL(lin) {
  const p = lin && new URL(lin).searchParams
  const id = p && p.get('id')
  const when = p && p.get('when_played')
  return id && when
    ? `https://webutil.bridgebase.com/v2/mh_handxml.php?id=${encodeURIComponent(`${id}-${when}`)}`
    : null
}

function isColumnHeader(cells) {
  return cells.includes('Result') && cells.includes('Movie')
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function groupSessions(rows) {
  const sessions = []
  let current = null
  let day = ''

  for (const row of rows) {
    if (row.cells.length === 1 && DATE_ONLY.test(row.cells[0])) {
      day = row.cells[0]
      continue
    }
    if (isColumnHeader(row.cells)) {
      current = { label: day, date: day, kind: '', teams: false, tview: null, boards: [] }
      sessions.push(current)
      continue
    }
    if (!current) continue

    if (row.tview) {
      current.tview = row.tview
      const named = row.cells.find((c) => c && !/^[\d.\/-]+$/.test(c))
      if (named) current.label = named
      continue
    }

    if (!row.lin) continue
    if (!current.kind && row.cls) {
      current.kind = row.cls
      current.teams = row.cls === 'team'
    }
    const id = new URL(row.lin).searchParams.get('id')
    if (!id) throw new Error('BBO 清單裡的牌局連結沒有 id，格式變了')

    current.boards.push({
      id,
      url: row.lin,
      seq: Number(row.cells[0]) || null,
      time: row.cells[1] ?? '',
      result: row.cells.at(-5) ?? '',
    })
  }

  return sessions.filter((s) => s.boards.length > 0)
}

function dedupe(sessions, seen = new Set()) {
  return sessions
    .map((s) => ({ ...s, boards: s.boards.filter((b) => !seen.has(b.id) && seen.add(b.id)) }))
    .filter((s) => s.boards.length > 0)
}

function idsOf(sessions) {
  return new Set(sessions.flatMap((s) => s.boards.map((b) => b.id)))
}

function fetched(sessions) {
  return sessions
    .map((s) => (s.match ? s : { ...s, boards: s.boards.filter((b) => b.lin !== undefined) }))
    .filter((s) => s.match || s.boards.length > 0)
}

if (typeof module !== 'undefined') {
  module.exports = {
    rowsFromDocument,
    groupSessions,
    dedupe,
    idsOf,
    fetched,
    isColumnHeader,
    resolve,
    matchURL,
    handURL,
  }
}
