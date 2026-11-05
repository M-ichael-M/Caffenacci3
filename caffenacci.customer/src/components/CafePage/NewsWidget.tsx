import { useState } from 'react'
import { NewspaperIcon } from './icons'
import { X } from 'lucide-react'
import ResponsiveImage from '../ResponsiveImage'
import { useI18n } from '../../i18n/I18nProvider'

interface NewsPostItem {
  id: string
  title: string
  content: string
  image_url: string | null
  image_width?: number | null
  image_height?: number | null
  created_at: string
}

interface Props {
  posts: NewsPostItem[]
}

function formatDateTime(s: string, fmt: any, options: { dateStyle: string }) {
  // Zakładam, że formatDateTime jest dostępny z useI18n / i18n utils
  // Jeśli jest eksportowany osobno, zaimportuj go.
  // Poniżej używamy go zgodnie z instrukcją.
  return fmt(s, options) // lub konkretna implementacja formatDateTime(s, fmt, options)
}

export default function NewsWidget({ posts }: Props) {
  const { t, fmt } = useI18n()
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
              <ResponsiveImage
                className="cp-news-card__image"
                src={post.image_url}
                alt={post.title}
                sizes="(max-width: 700px) 100vw, 360px"
                width={post.image_width}
                height={post.image_height}
              />
            ) : (
              <div className="cp-news-card__image-fallback"><NewspaperIcon size={30} /></div>
            )}
            <div className="cp-news-card__body">
              <span className="cp-news-card__badge">{t('news.badge')}</span>
              <div className="cp-news-card__date">{formatDateTime(post.created_at, fmt, { dateStyle: 'long' })}</div>
              <div className="cp-news-card__title">{post.title}</div>
              <span className="cp-news-card__readmore">
                {t('news.read_more')} <span className="cp-dir-arrow" aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {openPost && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) setOpenId(null) }}>
          <div className="menu-editor" style={{ maxWidth: 560 }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">{t('news.badge')}</div>
                <h2 className="me-title">{openPost.title}</h2>
              </div>
              <button
                className="me-close"
                type="button"
                onClick={() => setOpenId(null)}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>
            <div className="me-body">
              <div className="cp-news-modal-date">
                {formatDateTime(openPost.created_at, fmt, { dateStyle: 'long' })}
              </div>
              {openPost.image_url && (
                <ResponsiveImage
                  className="cp-news-modal-image"
                  src={openPost.image_url}
                  alt={openPost.title}
                  sizes="(max-width: 600px) 100vw, 520px"
                  width={openPost.image_width}
                  height={openPost.image_height}
                />
              )}
              <p className="cp-news-modal-content">{openPost.content}</p>
            </div>
            <div className="me-footer">
              <button type="button" className="btn btn--outline-dark" onClick={() => setOpenId(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}