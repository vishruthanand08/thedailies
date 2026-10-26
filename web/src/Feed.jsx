import { useEffect, useState } from 'react'
import { api, timeAgo } from './api.js'

export default function Feed({ me }) {
  const [feed, setFeed] = useState(null)

  useEffect(() => {
    api.get('/submissions/feed').then((d) => setFeed(d.feed))
  }, [])

  if (!feed) return <div className="spin">loading…</div>
  if (!feed.length) {
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
      {feed.map((item) => (
        <div key={item.id} className="card feeditem">
          <div className="feedhead">
            <div className="avatar">{item.username[0]}</div>
            <div className="feedwho">
              <b>{item.userId === me.id ? 'You' : item.username}</b> played{' '}
              <b>{item.emoji} {item.gameName}</b>
            </div>
            <div className="feedtime">{timeAgo(item.createdAt)}</div>
          </div>
          <div className="feedscore">
            {item.display}
            {!item.verified && <span className="unverified">~manual</span>}
          </div>
          {item.rawText && !item.rawText.startsWith('(manual entry)') && (
            <details>
              <summary>show receipt</summary>
              <pre>{item.rawText}</pre>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}
