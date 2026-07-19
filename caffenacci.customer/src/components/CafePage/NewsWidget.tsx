import { useState } from 'react'
import { NewspaperIcon } from './icons'

interface NewsPostItem {
  id: string
  title: string
  content: string
  image_url: string | null
  created_at: string
}

interface Props {
  posts: NewsPostItem[]
}

function formatDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NewsWidget({ posts }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const openPost = posts.find(p => p.id === openId) ?? null

  if (posts.length === 0) return null

  return (
    <>
      <div className="cp-news-grid">
        {posts.map(post => (
          <div
            key={post.id}
            className="cp-news-card"
            onClick={() => setOpenId(post.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpenId(post.id) }}
          >
            {post.image_url ? (
              <img className="cp-news-card__image" src={`http://localhost:8000${post.image_url}`} alt={post.title} loading="lazy" />
            ) : (
              <div className="cp-news-card__image-fallback"><NewspaperIcon size={30} /></div>
            )}
            <div className="cp-news-card__body">
              <span className="cp-news-card__badge">Aktualność</span>
              <div className="cp-news-card__date">{formatDate(post.created_at)}</div>
              <div className="cp-news-card__title">{post.title}</div>
              <span className="cp-news-card__readmore">Czytaj więcej →</span>
            </div>
          </div>
        ))}
      </div>

      {openPost && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) setOpenId(null) }}>
          <div className="menu-editor" style={{ maxWidth: 560 }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">Aktualność</div>
                <h2 className="me-title">{openPost.title}</h2>
              </div>
              <button className="me-close" type="button" onClick={() => setOpenId(null)} aria-label="Zamknij">✕</button>
            </div>
            <div className="me-body">
              <div className="cp-news-modal-date">{formatDate(openPost.created_at)}</div>
              {openPost.image_url && (
                <img className="cp-news-modal-image" src={`http://localhost:8000${openPost.image_url}`} alt={openPost.title} />
              )}
              <p className="cp-news-modal-content">{openPost.content}</p>
            </div>
            <div className="me-footer">
              <button type="button" className="btn btn--outline-dark" onClick={() => setOpenId(null)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}