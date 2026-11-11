from datetime import timedelta
from app.core.cafe_time import cafe_datetime, zone
from app.core.opening_hours import sessions_for


def _fn(table):
    return lambda ds: table.get(ds, (None, None))


def test_overnight_session_spills_to_next_day():
    fn = _fn({"2026-11-13": ("20:00", "02:00")})
    assert sessions_for("2026-11-13", fn) == [(1200, 1560)]
    assert sessions_for("2026-11-14", fn) == [(-240, 120)]
    assert sessions_for("2026-11-15", fn) == []


def test_normal_and_closed_day():
    fn = _fn({"2026-11-13": ("08:00", "20:00")})
    assert sessions_for("2026-11-13", fn) == [(480, 1200)]
    assert sessions_for("2026-11-12", fn) == []


def test_wall_time_uses_cafe_zone():
    dt = cafe_datetime("2026-11-11", "12:00", zone("Asia/Phnom_Penh"))
    assert dt.utcoffset() == timedelta(hours=7)