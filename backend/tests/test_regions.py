from app.core.regions import currency_for_country, valid_time_zone


def test_currency_for_country():
    assert currency_for_country("Polska") == "PLN"
    assert currency_for_country("Niemcy") == "EUR"
    assert currency_for_country("Kambodża") == "KHR"
    assert currency_for_country("Japan") == "JPY"
    assert currency_for_country("Wielka Brytania") == "GBP"
    assert currency_for_country("Atlantyda") == "USD"
    assert currency_for_country("") == "USD"


def test_valid_time_zone():
    assert valid_time_zone("Asia/Phnom_Penh") == "Asia/Phnom_Penh"
    assert valid_time_zone("Nie/Istnieje") == "Europe/Warsaw"
    assert valid_time_zone("../etc/passwd") == "Europe/Warsaw"
    assert valid_time_zone(None) == "Europe/Warsaw"