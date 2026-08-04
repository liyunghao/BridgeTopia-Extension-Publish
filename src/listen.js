chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'survey') {
    survey(msg.range)
      .then((r) => reply({ ok: true, ...r }))
      .catch((err) => reply({ ok: false, error: err.message }))
    return true
  }
  if (msg?.type === 'pull') {
    pull(msg.sessions)
      .then((r) => reply({ ok: true, ...r }))
      .catch((err) => reply({ ok: false, error: err.message }))
    return true
  }
  return false
})
