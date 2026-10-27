import { useEffect, useState } from 'react'
import { api, timeAgo } from './api.js'

const SHOWN = 3 // games shown on a card before "+N more"

function dayLabel(date, today) {
  if (date === today) return 'Today'
  const yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)
  if (date === yesterday) return 'Yesterday'
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// "alex", "alex and maya", "alex, maya and 2 more"
function names(list) {
  if (list.length <= 2) return list.join(' and ')
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`
}

// cards arrive newest day first; one section per day, always starting with today
function byDay(cards, today, waiting = []) {
  const days = [[today, []]]
  for (const c of cards) {
    if (days[days.length - 1]?.[0] !== c.date) days.push([c.date, []])
    days[days.length - 1][1].push(c)
  }
  return days.filter(([date, list]) => list.length || (date === today && waiting.length))
}

// One card per player per day, like a Strava activity. Their highlight leads in yellow; friends
// give the day kudos. Today's friends' highlights sit in a row at the top.
export default function Feed({ me, onSeen }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = () =>
    api
      .get('/feed')
      .then((d) => {
        setData(d)
        if (d.notices.length) api.post('/feed/seen').then(onSeen, () => {})
      })
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  const more = async () => {
    setLoadingMore(true)
    try {
      const d = await api.get(`/feed?before=${data.nextBefore}`)
      setData((cur) => ({ ...cur, cards: [...cur.cards, ...d.cards], nextBefore: d.nextBefore }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const updateCard = (card, change) =>
    setData((cur) => ({
      ...cur,
      cards: cur.cards.map((c) => (c.userId === card.userId && c.date === card.date ? { ...c, ...change(c) } : c)),
    }))

  const toggleKudos = async (card) => {
    const giving = !card.kudos.mine
    const flip = (c) => ({
      kudos: {
        count: c.kudos.count + (giving ? 1 : -1),
        mine: giving,
        givers: giving ? [...c.kudos.givers, { userId: me.id, username: me.username }] : c.kudos.givers.filter((g) => g.userId !== me.id),
      },
    })
    updateCard(card, flip) // shows at once; undone if the server says no
    try {
      await (giving ? api.post : api.del)('/feed/kudos', { userId: card.userId, date: card.date })
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  // tapping the current pick's star goes back to the automatic highlight (top points)
  const highlight = async (card, game) => {
    try {
      if (card.picked && game.submissionId === card.highlightId) await api.del('/feed/highlight')
      else await api.put('/feed/highlight', { submissionId: game.submissionId })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data && !error) return <div className="spin">loading…</div>
  if (!data) return <div className="flash err">{error}</div>

  if (!data.cards.length) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="hint">
          Nothing here yet. Scores you and your friends add show up in this feed — add some friends and
          start pasting 📋
        </p>
      </div>
    )
  }

  return (
    <div className="feed">
      {error && <div className="flash err">{error}</div>}

      {data.notices.map((n) => (
        <div key={n.date} className="kudosnotice">
          👏 <b>{names(n.usernames)}</b> gave you kudos for {dayLabel(n.date, data.today).replace(/^[TY]/, (c) => c.toLowerCase())}
        </div>
      ))}

      {data.highlights.length > 0 && (
        <section aria-label="Today's highlights">
          <h3 className="sectiontitle feedrowtitle">⭐ Today's highlights</h3>
          <div className="highlightrow">
            {data.highlights.map((h) => (
              <a key={h.userId} className="highlightchip" href={`#day-${h.userId}-${h.date}`}>
                <span className="avatar small">{h.username[0]}</span>
                <span className="hlwho">{h.username}</span>
                <span className="hlgame">
                  {h.emoji} {h.gameName}
                </span>
                <span className="hlscore">
                  {h.display}
                  {h.pb && <span className="pbtag">PB</span>}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {byDay(data.cards, data.today, data.waiting).map(([date, cards]) => (
        <section key={date} className="feedday" aria-label={dayLabel(date, data.today)}>
          <h3 className="sectiontitle dayheader">
            {dayLabel(date, data.today)}
            {cards.length > 0 && <span>{cards.length} {cards.length === 1 ? 'player' : 'players'}</span>}
          </h3>
          {date === data.today && data.waiting?.length > 0 && (
            <p className="hint small waiting">Haven't played yet today: {data.waiting.join(', ')}</p>
          )}
          {cards.map((card) => (
            <DayCard
              key={`${card.userId}-${card.date}`}
              card={card}
              me={me}
              onKudos={() => toggleKudos(card)}
              onHighlight={(game) => highlight(card, game)}
              pickable={card.userId === me.id && card.date === data.today}
            />
          ))}
        </section>
      ))}

      {data.nextBefore && (
        <button className="btn ghost feedmore" onClick={more} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show earlier days'}
        </button>
      )}
    </div>
  )
}

function DayCard({ card, me, pickable, onKudos, onHighlight }) {
  const [expanded, setExpanded] = useState(false)
  const [receipt, setReceipt] = useState(null) // submissionId whose share text is open
  const mine = card.userId === me.id
  const canPick = pickable && card.games.length > 1
  const games = expanded ? card.games : card.games.slice(0, SHOWN)

  return (
    <article id={`day-${card.userId}-${card.date}`} className="card feeditem daycard">
      <div className="feedhead">
        <div className="avatar">{card.username[0]}</div>
        <div className="feedwho">
          <b>{mine ? 'You' : card.username}</b>
          <span className="daymeta">
            {card.games.length} {card.games.length === 1 ? 'game' : 'games'}
            {card.streak > 1 && <> · 🔥 {card.streak}</>}
          </span>
        </div>
        <div className="daypoints">
          {card.points}
          <span>pts</span>
        </div>
      </div>

      <ul className="daygames">
        {games.map((g) => {
          const isHighlight = g.submissionId === card.highlightId
          return (
            <li key={g.submissionId} className={isHighlight ? 'highlight' : undefined}>
              <button
                className="gamerow"
                onClick={() => g.rawText && setReceipt(receipt === g.submissionId ? null : g.submissionId)}
                aria-expanded={g.rawText ? receipt === g.submissionId : undefined}
                title={g.rawText ? 'Show the shared result' : undefined}
              >
                <span className="gemoji" style={{ background: g.color }}>{g.emoji}</span>
                <span className="gname">{g.gameName}</span>
                {g.pb && <span className="pbtag" title="Personal best">PB</span>}
                {!g.verified && <span className="unverified">~manual</span>}
                <span className="gdisplay">{g.display}</span>
                <span className="gpoints">{g.points}</span>
              </button>
              {canPick && (
                <button
                  className={`starbtn${isHighlight ? ' on' : ''}`}
                  onClick={() => onHighlight(g)}
                  aria-pressed={isHighlight}
                  aria-label={
                    isHighlight
                      ? card.picked ? `Stop highlighting ${g.gameName}` : `${g.gameName} is your highlight`
                      : `Highlight ${g.gameName}`
                  }
                  title={isHighlight ? (card.picked ? 'Go back to your top-points game' : 'Your highlight (top points)') : 'Make this your highlight'}
                  disabled={isHighlight && !card.picked}
                >
                  {isHighlight ? '★' : '☆'}
                </button>
              )}
              {receipt === g.submissionId && <pre>{g.rawText}</pre>}
            </li>
          )
        })}
      </ul>
      {card.games.length > SHOWN && (
        <button className="linklike daymore" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : `+${card.games.length - SHOWN} more`}
        </button>
      )}

      <div className="dayfoot">
        {mine ? (
          <span className="kudoscount">👏 {card.kudos.count}</span>
        ) : (
          <button className={`kudosbtn${card.kudos.mine ? ' on' : ''}`} onClick={onKudos} aria-pressed={card.kudos.mine}>
            👏 {card.kudos.mine ? 'Kudos given' : 'Give kudos'}
            {card.kudos.count > 0 && <span className="kcount">{card.kudos.count}</span>}
          </button>
        )}
        <span className="kudosnames">
          {card.kudos.count > 0
            ? names(card.kudos.givers.map((g) => (g.userId === me.id ? 'you' : g.username)))
            : mine ? 'No kudos yet' : ''}
        </span>
        <span className="feedtime">{timeAgo(card.lastActivity)}</span>
      </div>
    </article>
  )
}
