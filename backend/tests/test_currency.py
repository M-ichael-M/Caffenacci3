from app.core.currency import currency_exponent, round_money
from app.core.languages import CURRENCIES


def test_exponents():
    for code in ("JPY", "KRW", "VND", "CLP", "ISK"):
        assert currency_exponent(code) == 0
    for code in ("PLN", "EUR", "USD", "KHR", "IDR"):
        assert currency_exponent(code) == 2
    assert currency_exponent(None) == 2


def test_rounding_half_up_per_currency():
    assert round_money(12.345, "PLN") == 12.35
    assert round_money(12.5, "JPY") == 13.0
    assert round_money(12.4, "JPY") == 12.0
    assert round_money(0.1 * 3, "PLN") == 0.3          # bez błędu float


def test_khr_is_selectable():
    assert "KHR" in CURRENCIES