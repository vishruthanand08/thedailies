import { useEffect, useState } from 'react'
import { api } from './api.js'

// "Which game should we add next?" Lists my circle's ideas; votes count from everyone.
export default function Suggestions() {
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const load = () => api.get('/suggestions').then((d) => setList(d.suggestions)).catch(() => setList([]))
  useEffect(() => {
    load()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setFlash(null)
    try {
      const d = await api.post('/suggestions', { name, url, note })
      setFlash({
        kind: 'ok',
        msg: d.merged ? `${d.name} was already suggested, so we added your vote.` : `Thanks! ${d.name} is on the list.`,
      })
      setName('')
      setUrl('')
      setNote('')
      setOpen(false)
      load()
    } catch (err) {
      setFlash({ kind: 'err', msg: err.message })
    } finally {
      setBusy(false)
    }
  }

  const vote = async (s) => {
    setList((l) => l.map((x) => (x.id === s.id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x)))
    try {
      await api.post(`/suggestions/${s.id}/vote`)
    } finally {
      load()
    }
  }

  const remove = async (s) => {
    await api.del(`/suggestions/${s.id}`)
    load()
  }

  return (
    <div className="card suggestions">
      <div className="suggesthead">
        <h3 className="sectiontitle">💡 Missing a game?</h3>
        {!open && (
          <button
            className="btn small"
            onClick={() => {
              setOpen(true)
              setFlash(null)
            }}
          >
            Suggest one
          </button>
        )}
      </div>

      {open && (
        <form className="suggestform" onSubmit={submit}>
          <input
            className="input"
            placeholder="Game name"
            aria-label="Game name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            placeholder="Link (optional)"
            aria-label="Link to the game (optional)"
            maxLength={300}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <input
            className="input"
            placeholder="Anything we should know? (optional)"
            aria-label="Note (optional)"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="row">
            <button className="btn coral small" type="submit" disabled={busy || !name.trim()}>
              Send suggestion
            </button>
            <button className="btn ghost small" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {flash && <div className={`flash ${flash.kind}`} role="status">{flash.msg}</div>}

      {list?.length > 0 && (
        <ul className="suggestlist">
          {list.map((s) => (
            <li key={s.id} className={s.added ? 'added' : undefined}>
              {s.added ? (
                <span className="addedtag" title="This game is on the board now">Added ✓</span>
              ) : (
                <button
                  className={`votebtn${s.voted ? ' on' : ''}`}
                  aria-pressed={s.voted}
                  aria-label={`${s.voted ? 'Remove your vote for' : 'Vote for'} ${s.name}`}
                  onClick={() => vote(s)}
                >
                  ▲ {s.votes}
                </button>
              )}
              <div className="what">
                <div>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer nofollow">{s.name}</a>
                  ) : (
                    <b>{s.name}</b>
                  )}
                  {s.by && <span className="sub"> · {s.mine ? 'you' : s.by}</span>}
                </div>
                {s.note && <div className="sub">{s.note}</div>}
              </div>
              {s.mine && (
                <button className="del" aria-label={`Delete your suggestion ${s.name}`} onClick={() => remove(s)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
