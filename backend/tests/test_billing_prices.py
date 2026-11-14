from app.core.billing_prices import BILLING_PRICES_MINOR, default_billing_currency


def test_prices():
    assert BILLING_PRICES_MINOR == {"PLN": 2000, "EUR": 500, "USD": 500}


def test_default_currency():
    assert default_billing_currency("Polska") == "PLN"
    assert default_billing_currency(" poland ") == "PLN"
    for c in ("Niemcy", "Germany", "Österreich", "Hiszpania", "Włochy", "Łotwa"):
        assert default_billing_currency(c) == "EUR"
    for c in ("Kambodża", "Cambodia", "Szwajcaria", "", None):
        assert default_billing_currency(c) == "USD"