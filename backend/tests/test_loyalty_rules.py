from app.core.loyalty_rules import compute_points, default_unit


def test_example_from_panel():
    assert compute_points(12.5, "PLN", 30, 1) == 375


def test_floor_and_no_float_noise():
    assert compute_points(19.99, "PLN", 30, 1) == 599     # 599.7 → 599
    assert compute_points(1.25, "PLN", 30, 1) == 37       # stary kurs dawał 36 (skok co 10 gr)
    assert compute_points(0.1 * 3, "PLN", 30, 1) == 9


def test_zero_exponent_currencies():
    assert compute_points(1000, "JPY", 30, 100) == 300
    assert compute_points(99, "JPY", 30, 100) == 29
    assert compute_points(12.5, "JPY", 30, 100) == 3      # 12,5 → 13 ¥ → 3,9 → 3
    assert compute_points(50_000, "VND", 30, 10_000) == 150


def test_defaults():
    for c in ("PLN", "EUR", "USD", "KHR"):
        assert default_unit(c) == 1
    assert default_unit("JPY") == default_unit("KRW") == 100
    assert default_unit("VND") == default_unit("IDR") == 10_000