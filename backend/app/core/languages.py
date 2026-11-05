from __future__ import annotations

import re
from dataclasses import dataclass

DEFAULT_PRIMARY_LANGUAGE = "pl"
DEFAULT_CURRENCY = "PLN"
DEFAULT_TIME_ZONE = "Europe/Warsaw"

CURRENCIES = (
    "PLN", "EUR", "USD", "GBP", "CHF", "CZK", "SEK", "NOK", "DKK", "HUF", "RON", "BGN",
    "ISK", "UAH", "TRY", "CAD", "AUD", "NZD", "JPY", "CNY", "HKD", "KRW", "INR", "SGD",
    "THB", "MYR", "IDR", "VND", "PHP", "AED", "SAR", "ILS", "EGP", "ZAR", "MXN", "BRL",
    "ARS", "CLP", "COP",
)

# Bez zoneinfo celowo (na Windows wymaga pakietu tzdata) — walidujemy kształt nazwy IANA.
TIME_ZONE_RE = re.compile(r"^[A-Za-z]+(?:/[A-Za-z0-9_+\-]+){0,2}$")

# Języki pisane od prawej do lewej.
_RTL = {"ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "dv"}

# Kod ISO 639-1 -> tag BCP-47 dla Intl, gdy się różnią.
_INTL_OVERRIDES = {"no": "nb", "tl": "fil"}

# (kod ISO 639-1, nazwa angielska, nazwa własna) — główne języki świata, bez dialektów.
_RAW = (
    ("af", "Afrikaans", "Afrikaans"), ("sq", "Albanian", "Shqip"), ("am", "Amharic", "አማርኛ"),
    ("ar", "Arabic", "العربية"), ("hy", "Armenian", "Հայերեն"), ("az", "Azerbaijani", "Azərbaycanca"),
    ("eu", "Basque", "Euskara"), ("be", "Belarusian", "Беларуская"), ("bn", "Bengali", "বাংলা"),
    ("bs", "Bosnian", "Bosanski"), ("bg", "Bulgarian", "Български"), ("my", "Burmese", "မြန်မာ"),
    ("ca", "Catalan", "Català"), ("ny", "Chichewa", "Chichewa"), ("zh", "Chinese", "中文"),
    ("hr", "Croatian", "Hrvatski"), ("cs", "Czech", "Čeština"), ("da", "Danish", "Dansk"),
    ("dv", "Dhivehi", "ދިވެހި"), ("nl", "Dutch", "Nederlands"), ("en", "English", "English"),
    ("et", "Estonian", "Eesti"), ("fi", "Finnish", "Suomi"), ("fr", "French", "Français"),
    ("fy", "Frisian", "Frysk"), ("gl", "Galician", "Galego"), ("ka", "Georgian", "ქართული"),
    ("de", "German", "Deutsch"), ("el", "Greek", "Ελληνικά"), ("gu", "Gujarati", "ગુજરાતી"),
    ("ha", "Hausa", "Hausa"), ("he", "Hebrew", "עברית"), ("hi", "Hindi", "हिन्दी"),
    ("hu", "Hungarian", "Magyar"), ("is", "Icelandic", "Íslenska"), ("ig", "Igbo", "Igbo"),
    ("id", "Indonesian", "Bahasa Indonesia"), ("ga", "Irish", "Gaeilge"), ("it", "Italian", "Italiano"),
    ("ja", "Japanese", "日本語"), ("jv", "Javanese", "Basa Jawa"), ("kn", "Kannada", "ಕನ್ನಡ"),
    ("kk", "Kazakh", "Қазақша"), ("km", "Khmer", "ខ្មែរ"), ("rw", "Kinyarwanda", "Ikinyarwanda"),
    ("ko", "Korean", "한국어"), ("ku", "Kurdish", "Kurdî"), ("ky", "Kyrgyz", "Кыргызча"),
    ("lo", "Lao", "ລາວ"), ("la", "Latin", "Latina"), ("lv", "Latvian", "Latviešu"),
    ("lt", "Lithuanian", "Lietuvių"), ("lb", "Luxembourgish", "Lëtzebuergesch"),
    ("mk", "Macedonian", "Македонски"), ("mg", "Malagasy", "Malagasy"), ("ms", "Malay", "Bahasa Melayu"),
    ("ml", "Malayalam", "മലയാളം"), ("mt", "Maltese", "Malti"), ("mi", "Maori", "Māori"),
    ("mr", "Marathi", "मराठी"), ("mn", "Mongolian", "Монгол"), ("ne", "Nepali", "नेपाली"),
    ("no", "Norwegian", "Norsk"), ("or", "Odia", "ଓଡ଼ିଆ"), ("ps", "Pashto", "پښتو"),
    ("fa", "Persian", "فارسی"), ("pl", "Polish", "Polski"), ("pt", "Portuguese", "Português"),
    ("pa", "Punjabi", "ਪੰਜਾਬੀ"), ("ro", "Romanian", "Română"), ("ru", "Russian", "Русский"),
    ("sm", "Samoan", "Gagana Sāmoa"), ("gd", "Scottish Gaelic", "Gàidhlig"), ("sr", "Serbian", "Српски"),
    ("st", "Sesotho", "Sesotho"), ("sn", "Shona", "ChiShona"), ("sd", "Sindhi", "سنڌي"),
    ("si", "Sinhala", "සිංහල"), ("sk", "Slovak", "Slovenčina"), ("sl", "Slovenian", "Slovenščina"),
    ("so", "Somali", "Soomaali"), ("es", "Spanish", "Español"), ("su", "Sundanese", "Basa Sunda"),
    ("sw", "Swahili", "Kiswahili"), ("sv", "Swedish", "Svenska"), ("tl", "Tagalog", "Filipino"),
    ("tg", "Tajik", "Тоҷикӣ"), ("ta", "Tamil", "தமிழ்"), ("tt", "Tatar", "Татарча"),
    ("te", "Telugu", "తెలుగు"), ("th", "Thai", "ไทย"), ("tr", "Turkish", "Türkçe"),
    ("tk", "Turkmen", "Türkmen"), ("uk", "Ukrainian", "Українська"), ("ur", "Urdu", "اردو"),
    ("ug", "Uyghur", "ئۇيغۇرچە"), ("uz", "Uzbek", "Oʻzbekcha"), ("vi", "Vietnamese", "Tiếng Việt"),
    ("cy", "Welsh", "Cymraeg"), ("xh", "Xhosa", "isiXhosa"), ("yi", "Yiddish", "ייִדיש"),
    ("yo", "Yoruba", "Yorùbá"), ("zu", "Zulu", "isiZulu"),
)


@dataclass(frozen=True)
class Language:
    code: str
    name_en: str
    native: str
    rtl: bool
    locale: str            # tag BCP-47 do Intl.* (daty, liczby, waluty)

    @property
    def direction(self) -> str:
        return "rtl" if self.rtl else "ltr"

    @property
    def collator_locale(self) -> str:
        # Osobne pole, żeby dało się kiedyś nadpisać sortowanie (np. zh-u-co-stroke)
        # bez ruszania formatowania liczb i dat.
        return self.locale


LANGUAGES: dict[str, Language] = {
    code: Language(code, en, native, code in _RTL, _INTL_OVERRIDES.get(code, code))
    for code, en, native in _RAW
}


def get_language(code: str) -> Language:
    return LANGUAGES.get(code) or LANGUAGES[DEFAULT_PRIMARY_LANGUAGE]