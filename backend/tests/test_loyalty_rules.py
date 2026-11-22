import pytest
from app.core.loyalty_rules import default_unit, compute_points


@pytest.mark.parametrize("code,expected", [
    ("PLN", 1), ("EUR", 1), ("USD", 1),
    ("JPY", 100), ("KRW", 100), ("HUF", 100),
    ("VND", 10_000), ("IDR", 10_000),
    ("KHR", 4_000),          # było: == 1
    (None, 1), ("", 1), ("khr", 4_000),
])
def test_default_unit(code, expected):
    assert default_unit(code) == expected


def test_khr_points_follow_unit():
    # 30 pkt za każde 4000 KHR; 8000 KHR => 60 pkt, 3999 KHR => 0 pkt
    assert compute_points(8000, "KHR", 30, default_unit("KHR")) == 60
    assert compute_points(3999, "KHR", 30, default_unit("KHR")) == 0