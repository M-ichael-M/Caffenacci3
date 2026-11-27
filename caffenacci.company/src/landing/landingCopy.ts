export type LandingLang = 'pl' | 'en'
export type FeatureIcon =
  | 'palette' | 'menu' | 'orders' | 'reservations' | 'loyalty' | 'stats' | 'languages' | 'app'

// Ceny: lustro backend/app/core/billing_prices.py (BILLING_PRICES_MINOR / 100)
export const PRICES = { PLN: 20, EUR: 5, USD: 5 } as const

// Promocja: kod z migracji 0011 (30 dni). Landing sam chowa baner po tej dacie.
export const PROMO_CODE = 'CAFE30'
export const TRIAL_UNTIL = new Date(2027, 1, 28, 23, 59, 59)

interface Item { title: string; text: string }

export interface LandingCopy {
  meta: { title: string; description: string; ogLocale: string }
  nav: { features: string; pricing: string; faq: string; login: string; register: string; customer: string }
  hero: { eyebrow: string; h1: string; lead: string; cta: string; ctaSecondary: string; points: string[] }
  trial: string
  benefits: { title: string; items: Item[] }
  features: { title: string; intro: string; items: (Item & { icon: FeatureIcon })[]; bonus: string; bonusLink: string }
  seo: { title: string; intro: string; items: string[]; note: string }
  steps: { title: string; items: Item[] }
  pricing: { title: string; intro: string; perMonth: string; includes: string[]; notes: string[]; cta: string; others: string }
  faq: { title: string; items: { q: string; a: string }[] }
  final: { title: string; text: string; cta: string }
  footer: { tagline: string; customer: string }
}

const pl: LandingCopy = {
  meta: {
    title: 'Strona internetowa dla kawiarni – menu, zamówienia | Caffenacci',
    description: 'Gotowa strona kawiarni zoptymalizowana pod Google: menu, rezerwacje, zamówienia online i program lojalnościowy. Bez znajomości IT. 20 zł/mies.',
    ogLocale: 'pl_PL',
  },
  nav: { features: 'Funkcje', pricing: 'Cennik', faq: 'FAQ', login: 'Zaloguj się', register: 'Załóż profil', customer: 'Szukasz kawiarni?' },
  hero: {
    eyebrow: 'Dla właścicieli kawiarni',
    h1: 'Profesjonalna strona internetowa Twojej kawiarni – gotowa w kilkanaście minut',
    lead: 'Menu, godziny otwarcia, rezerwacje, zamówienia online i program lojalnościowy w jednym miejscu. Strona jest przygotowana pod Google tak, jakby była Twoją własną, a zarządzasz nią bez znajomości IT.',
    cta: 'Załóż profil kawiarni',
    ctaSecondary: 'Mam już konto',
    points: ['Bez programisty i własnego hostingu', 'Zmiany w menu widoczne od razu', 'Wszystkie funkcje za 20 zł miesięcznie'],
  },
  trial: 'Zarejestruj się do {date} i pierwszy miesiąc masz za darmo. Po założeniu konta wpisz kod {code} w zakładce „Płatności”.',
  benefits: {
    title: 'Co zyskuje Twoja kawiarnia',
    items: [
      { title: 'Strona zoptymalizowana pod Google', text: 'Każda strona to gotowy HTML z danymi strukturalnymi Schema.org, mapą witryny i szybkimi obrazami. Taki fundament zwykle zamawia się w agencji SEO.' },
      { title: 'Zarządzanie bez IT', text: 'Menu, ceny, godziny i zdjęcia zmieniasz w prostym panelu. Nie ma kodu, serwera ani wtyczek do aktualizowania.' },
      { title: 'Goście nie tylko czytają', text: 'Zamawiają z odbiorem na miejscu, rezerwują stolik, zbierają punkty i zostawiają opinie.' },
    ],
  },
  features: {
    title: 'Wszystko, czego kawiarnia potrzebuje online',
    intro: 'Włączasz tylko to, czego używasz. Reszta nie przeszkadza gościom.',
    items: [
      { icon: 'palette', title: '10 szablonów i 12 palet', text: 'Jednym kliknięciem wygenerujesz paletę z kolorów swojego logo. Podgląd na żywo na telefonie, tablecie i komputerze.' },
      { icon: 'menu', title: 'Menu z oznaczeniami', text: 'Sekcje, ceny, opisy, znaczniki VEGE i HOT. Coś się skończyło? Oznacz pozycję jako niedostępną.' },
      { icon: 'orders', title: 'Zamówienia online', text: 'Goście zamawiają z odbiorem na miejscu, a Ty realizujesz zamówienia jednym kliknięciem.' },
      { icon: 'reservations', title: 'Rezerwacje stolików', text: 'Tryb prosty z akceptacją albo zaawansowany ze stolikami, terminami i stołami komunalnymi.' },
      { icon: 'loyalty', title: 'Program lojalnościowy', text: 'Punkty za zakupy z nagrodami albo cyfrowe pieczątki. Kod klienta wpisujesz przy kasie.' },
      { icon: 'stats', title: 'Statystyki bez cookies', text: 'Odsłony, źródła wejść (Google, QR, ulotki), urządzenia i droga od wizyty do zamówienia.' },
      { icon: 'languages', title: 'Drugi język strony', text: 'Wygenerujesz plik, przetłumaczysz go w Google Translate lub DeepL i wgrasz. Resztą zajmujemy się my.' },
      { icon: 'app', title: 'Aplikacja dla zespołu', text: 'Pracownicy obsługują zamówienia i rezerwacje oraz zmieniają dostępność produktów, bez dostępu do profilu kawiarni.' },
    ],
    bonus: 'Dodatkowo Twoja kawiarnia pojawia się w wyszukiwarce Caffenacci, z mapą, filtrami i plakietkami (np. wifi, przyjazna zwierzętom).',
    bonusLink: 'Zobacz wyszukiwarkę kawiarni',
  },
  seo: {
    title: 'Technicznie przygotowana pod wyszukiwarki',
    intro: 'Typowy kreator stron buduje aplikację JavaScript, którą roboty czytają gorzej. U nas każda strona kawiarni jest serwowana tak, żeby Google rozumiał ją od pierwszego żądania:',
    items: [
      'gotowy HTML z treścią (menu, godziny, opinie), nie pusta aplikacja',
      'dane strukturalne Schema.org: adres, godziny, menu, ceny i oceny',
      'automatyczna mapa witryny i czytelny adres w formacie nazwa-miasto',
      'obrazy WebP w kilku rozmiarach i podglądy do udostępniania w social media',
      'wersje językowe z poprawnymi znacznikami hreflang',
      'strony miast i filtrów (np. kawiarnie z wifi w Twoim mieście) linkujące do Ciebie',
    ],
    note: 'Pozycji w Google nikt uczciwie nie gwarantuje, ale solidny fundament techniczny masz od pierwszego dnia.',
  },
  steps: {
    title: 'Jak zacząć',
    items: [
      { title: 'Załóż konto', text: 'Podaj dane kawiarni i adres. Strefa czasowa i waluta ustawią się automatycznie.' },
      { title: 'Uzupełnij profil', text: 'Dodaj logo, godziny otwarcia, menu i zdjęcia, a potem wybierz szablon i kolory.' },
      { title: 'Opublikuj', text: 'Aktywuj subskrypcję i opublikuj stronę jednym kliknięciem. Możesz ją też w każdej chwili wycofać.' },
    ],
  },
  pricing: {
    title: 'Jeden prosty cennik',
    intro: 'Wszystkie funkcje w jednej cenie. Bez opłat za dodatkowe moduły.',
    perMonth: '/ miesiąc',
    includes: [
      'Strona WWW z 10 szablonami', 'Menu, zamówienia i rezerwacje', 'Program lojalnościowy',
      'Statystyki i opinie gości', 'Aplikacja dla pracowników', 'Wersja w drugim języku', 'Wpis w wyszukiwarce Caffenacci',
    ],
    notes: [
      'Subskrypcję anulujesz w panelu (najpóźniej dzień przed odnowieniem). Dostęp trwa do końca opłaconego okresu.',
      'Walutę rozliczeń (PLN, EUR lub USD) wybierasz do pierwszej płatności.',
    ],
    cta: 'Załóż profil kawiarni',
    others: 'lub',
  },
  faq: {
    title: 'Najczęstsze pytania',
    items: [
      { q: 'Czy muszę znać się na IT?', a: 'Nie. Wszystko robisz w panelu, wypełniając formularze: wpisujesz menu, wybierasz szablon i klikasz „Opublikuj”. Nie ma kodu, serwera ani wtyczek.' },
      { q: 'Ile kosztuje Caffenacci?', a: 'Subskrypcja kosztuje 20 zł, 5 EUR lub 5 USD miesięcznie i obejmuje wszystkie funkcje. Kawiarnie, które zarejestrują się do 28 lutego 2027, mają pierwszy miesiąc za darmo.' },
      { q: 'Czy moja strona będzie widoczna w Google?', a: 'Dajemy techniczne podstawy SEO: gotowy HTML, dane Schema.org, mapę witryny i szybkie obrazy. Pozycja zależy też od konkurencji i treści, więc nie możemy jej zagwarantować.' },
      { q: 'Jaki adres będzie miała strona?', a: 'Adres tworzy się automatycznie z nazwy i miasta kawiarni, np. caffenacci.com/kawiarnia/pod-lipa-warszawa. Po zmianie nazwy stary adres przekierowuje na nowy.' },
      { q: 'Czy strona może być w dwóch językach?', a: 'Tak. Napisy systemowe tłumaczą się same. Własne teksty (menu, opis, aktualności) tłumaczysz plikiem w Google Translate lub DeepL i wgrywasz go do panelu.' },
      { q: 'Co z pracownikami?', a: 'Zapraszasz ich e-mailem do aplikacji Caffenacci Business. Obsługują w niej zamówienia i rezerwacje oraz dostępność produktów, ale nie mogą zmieniać profilu kawiarni.' },
    ],
  },
  final: {
    title: 'Zacznij od założenia profilu kawiarni',
    text: 'Rejestracja zajmuje kilka minut. Stronę opublikujesz, gdy będziesz gotowy.',
    cta: 'Załóż profil kawiarni',
  },
  footer: { tagline: 'Strona internetowa dla kawiarni, bez znajomości IT.', customer: 'Wyszukiwarka kawiarni Caffenacci' },
}

const en: LandingCopy = {
  meta: {
    title: 'Café Website Builder – Menu, Orders & Bookings | Caffenacci',
    description: 'A ready-made, Google-optimised website for your café: menu, table bookings, online orders and loyalty. No IT skills needed. From €5/month.',
    ogLocale: 'en_GB',
  },
  nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', register: 'Create profile', customer: 'Looking for a café?' },
  hero: {
    eyebrow: 'For café owners',
    h1: 'A professional website for your café, ready in minutes',
    lead: 'Menu, opening hours, bookings, online orders and a loyalty programme in one place. Your site is optimised for Google as if it were your own, and you manage it without any IT knowledge.',
    cta: 'Create your café profile',
    ctaSecondary: 'I already have an account',
    points: ['No developer or hosting needed', 'Menu changes go live instantly', 'All features for €5 a month'],
  },
  trial: 'Sign up by {date} and get your first month free. After creating your account, enter the code {code} in the “Billing” tab.',
  benefits: {
    title: 'What your café gets',
    items: [
      { title: 'A website optimised for Google', text: 'Every site is ready-made HTML with Schema.org structured data, a sitemap and fast images: the foundation you would normally pay an SEO agency for.' },
      { title: 'Manage it without IT', text: 'Change menu, prices, hours and photos in a simple panel. No code, no server and no plugins to update.' },
      { title: 'Guests do more than read', text: 'They order for pickup, book a table, collect points and leave reviews.' },
    ],
  },
  features: {
    title: 'Everything a café needs online',
    intro: 'Turn on only what you use. The rest stays out of your guests’ way.',
    items: [
      { icon: 'palette', title: '10 templates, 12 palettes', text: 'Generate a palette from your logo’s colours in one click. Live preview on phone, tablet and desktop.' },
      { icon: 'menu', title: 'Menu with labels', text: 'Sections, prices, descriptions, VEGE and HOT tags. Sold out? Mark the item as unavailable.' },
      { icon: 'orders', title: 'Online orders', text: 'Guests order for pickup and you complete orders in one click.' },
      { icon: 'reservations', title: 'Table bookings', text: 'A simple mode with approval, or an advanced one with tables, time slots and communal tables.' },
      { icon: 'loyalty', title: 'Loyalty programme', text: 'Points for purchases with rewards, or digital stamps. Enter the customer’s code at the till.' },
      { icon: 'stats', title: 'Cookie-free analytics', text: 'Page views, traffic sources (Google, QR, flyers), devices and the path from visit to order.' },
      { icon: 'languages', title: 'A second site language', text: 'Generate a file, translate it with Google Translate or DeepL and upload it. We handle the rest.' },
      { icon: 'app', title: 'App for your team', text: 'Staff handle orders and bookings and change product availability, without access to the café profile.' },
    ],
    bonus: 'Your café also appears in the Caffenacci search, with a map, filters and badges (e.g. Wi-Fi, pet-friendly).',
    bonusLink: 'Browse the café finder',
  },
  seo: {
    title: 'Technically prepared for search engines',
    intro: 'A typical site builder ships a JavaScript app that crawlers read poorly. Every Caffenacci café page is served so Google understands it from the very first request:',
    items: [
      'ready-made HTML with your content (menu, hours, reviews), not an empty app',
      'Schema.org structured data: address, hours, menu, prices and ratings',
      'automatic sitemap and a clean name-city address',
      'WebP images in several sizes and social sharing previews',
      'language versions with correct hreflang tags',
      'city and filter pages (e.g. cafés with Wi-Fi in your city) linking to you',
    ],
    note: 'Nobody can honestly guarantee Google rankings, but you get a solid technical foundation from day one.',
  },
  steps: {
    title: 'How to get started',
    items: [
      { title: 'Create an account', text: 'Enter your café details and address. Time zone and currency are set automatically.' },
      { title: 'Complete your profile', text: 'Add a logo, opening hours, menu and photos, then pick a template and colours.' },
      { title: 'Publish', text: 'Activate your subscription and publish in one click. You can unpublish at any time.' },
    ],
  },
  pricing: {
    title: 'One simple price',
    intro: 'All features in a single price. No fees for extra modules.',
    perMonth: '/ month',
    includes: [
      'Website with 10 templates', 'Menu, orders and bookings', 'Loyalty programme',
      'Analytics and guest reviews', 'Staff app', 'Second-language version', 'Listing in the Caffenacci search',
    ],
    notes: [
      'Cancel in the panel (at the latest one day before renewal). Access lasts until the end of the paid period.',
      'You choose the billing currency (PLN, EUR or USD) until your first payment.',
    ],
    cta: 'Create your café profile',
    others: 'or',
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'Do I need IT skills?', a: 'No. You do everything in the panel by filling in forms: add your menu, pick a template and click “Publish”. There is no code, server or plugins.' },
      { q: 'How much does Caffenacci cost?', a: 'The subscription costs 20 PLN, 5 EUR or 5 USD per month and includes every feature. Cafés that register by 28 February 2027 get the first month free.' },
      { q: 'Will my site show up in Google?', a: 'We provide the technical SEO basics: ready HTML, Schema.org data, a sitemap and fast images. Rankings also depend on competition and content, so we cannot guarantee them.' },
      { q: 'What address will my site have?', a: 'The address is created automatically from your café name and city, e.g. caffenacci.com/kawiarnia/pod-lipa-warszawa. If you rename the café, the old address redirects to the new one.' },
      { q: 'Can the site be in two languages?', a: 'Yes. System labels translate automatically. Your own texts (menu, description, news) are translated with a file in Google Translate or DeepL and uploaded to the panel.' },
      { q: 'What about my staff?', a: 'Invite them by email to the Caffenacci Business app. They handle orders, bookings and product availability, but cannot change the café profile.' },
    ],
  },
  final: {
    title: 'Start by creating your café profile',
    text: 'Registration takes a few minutes. Publish the site when you are ready.',
    cta: 'Create your café profile',
  },
  footer: { tagline: 'A website for your café, no IT skills needed.', customer: 'Caffenacci café finder' },
}

export const COPY: Record<LandingLang, LandingCopy> = { pl, en }