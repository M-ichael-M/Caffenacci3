import type { Tr } from './I18nProvider'

interface SiteLike {
  description: string | null
  menu_sections: { name: string; items: { name: string; description: string | null }[] }[]
  loyalty_rewards: { name: string }[]
  loyalty_stamps_earn_desc: string | null
  loyalty_stamps_reward_desc: string | null
  news_posts: { title: string; content: string }[]
  employees: { role: string; bio: string | null }[]
  social_links: { platform: string; label: string | null }[]
}

/** Tłumaczy tylko teksty kawiarni. NIE rusza: nazwy, adresu, imion, nicków, opinii, cen, godzin, kontaktu. */
export function localizeSite<T extends SiteLike>(d: T, tr: Tr): T {
  return {
    ...d,
    description: tr(d.description),
    menu_sections: d.menu_sections.map(s => ({
      ...s, name: tr(s.name),
      items: s.items.map(i => ({ ...i, name: tr(i.name), description: tr(i.description) })),
    })),
    loyalty_rewards: d.loyalty_rewards.map(r => ({ ...r, name: tr(r.name) })),
    loyalty_stamps_earn_desc: tr(d.loyalty_stamps_earn_desc),
    loyalty_stamps_reward_desc: tr(d.loyalty_stamps_reward_desc),
    news_posts: d.news_posts.map(p => ({ ...p, title: tr(p.title), content: tr(p.content) })),
    employees: d.employees.map(e => ({ ...e, role: tr(e.role), bio: tr(e.bio) })),
    social_links: d.social_links.map(s => s.platform === 'other' ? { ...s, label: tr(s.label) } : s),
  }
}