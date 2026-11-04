from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.storage import LocalStorage


def test_local_storage_roundtrip_and_traversal(tmp_path):
    storage = LocalStorage(tmp_path)
    storage.put("gallery/item.bin", b"image", "application/octet-stream")
    assert storage.get_bytes("gallery/item.bin") == b"image"
    assert storage.exists("gallery/item.bin")
    storage.delete("gallery/item.bin")
    assert not storage.exists("gallery/item.bin")
    with pytest.raises(ValueError):
        storage.put("../outside", b"no")


def test_expiration_cancels_old_pending_order(monkeypatch, tmp_path):
    from app.core import jobs
    from app.core.database import Base
    from app.models.cafe import Cafe
    from app.models.order import Order, OrderStatus

    test_engine = create_engine(f"sqlite:///{tmp_path / 'jobs.db'}")
    Base.metadata.create_all(test_engine)
    TestingSession = sessionmaker(bind=test_engine, autoflush=False)
    monkeypatch.setattr(jobs, "SessionLocal", TestingSession)
    monkeypatch.setattr(jobs, "engine", test_engine)
    with TestingSession() as db:
        cafe = Cafe(owner_name="A", email="a@example.test", password_hash="x", phone="1", cafe_name="Test",
                    country="PL", city="Warszawa", street="X", building_number="1", postal_code="00-001")
        db.add(cafe); db.flush()
        order = Order(cafe_id=cafe.id, client_nick="Gość", date=(date.today()-timedelta(days=1)).isoformat(), start_time="10:00", status=OrderStatus.pending)
        db.add(order); db.commit(); order_id=order.id
    assert jobs.run_expiration_job() == (1, 0)
    with TestingSession() as db:
        order = db.get(Order, order_id)
        assert order.status == OrderStatus.cancelled
        assert order.cancelled_by == "system"
