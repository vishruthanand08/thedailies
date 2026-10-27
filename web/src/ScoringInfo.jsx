import { useEffect, useState } from 'react'
import { api } from './api.js'

// The ⓘ on the crown card and the leaderboards: how points are worked out, with every game's
// perfect, par and zero.
export default function ScoringInfo({ label = 'How scoring works' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="iconbtn infobtn" aria-label={label} title={label} onClick={() => setOpen(true)}>
        ⓘ
      </button>
      {open && <ScoringPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function ScoringPanel({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    api.get('/submissions/scoring').then(setData).catch((err) => setError(err.message))
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="gamepanel-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card infopanel" role="dialog" aria-modal="true" aria-labelledby="scoring-title">
        <div className="infohead">
          <h3 id="scoring-title">How scoring works</h3>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <ul className="inforules">
          <li>Every game turns your result into <b>0 to 100 points</b>: a perfect result is 100, the game's typical result (par) is 50 and a fail is 0. Close to perfect costs a little; each step further costs more.</li>
          <li>Your points depend only on your own result, and they're locked in when you post. Other people playing never changes them.</li>
          <li>The <b>daily crown</b> goes to the most points added up across the day's games. A tie goes to whoever played fewer games.</li>
          <li>Each category's crown works the same way with just that category's games.</li>
          <li>The <b>leaderboard</b> adds up daily points over the range you pick. Each game's own board ranks the actual results (all time: best ever, then average).</li>
        </ul>
        {error && <div className="flash err">{error}</div>}
        {data && (
          <div className="tablewrap">
            <table className="stattable scoringtable">
              <thead>
                <tr>
                  <th>Game</th>
                  <th className="num">100 pts</th>
                  <th className="num">50 pts</th>
                  <th className="num">0 pts</th>
                </tr>
              </thead>
              {data.categories.map((c) => (
                <tbody key={c.id}>
                  <tr className="grouprow"><th colSpan={4}>{c.emoji} {c.name}</th></tr>
                  {data.games.filter((g) => g.category === c.id).map((g) => (
                    <tr key={g.id}>
                      <td className="who">{g.emoji} {g.name}</td>
                      <td className="num">{g.perfect}</td>
                      <td className="num">{g.par}</td>
                      <td className="num">{g.zero}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
