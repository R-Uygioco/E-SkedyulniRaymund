from datetime import date, datetime, timedelta, timezone

import pytest

from admin.core.validation import (
    require_text,
    validate_capacity,
    validate_event_times,
    validate_registration_deadline,
    validate_repeat_until,
)
from admin.core.errors import InvalidInputError
from admin.core.timekeeping import from_utc, get_zone
from admin.schemas.event import EventCreate

def test_event_times_require_end_after_start():
    start = datetime(2026, 10, 8, 9, 0)
    with pytest.raises(InvalidInputError):
        validate_event_times(start, start)

def test_registration_deadline_must_be_before_start():
    start = datetime(2026, 10, 8, 9, 0)
    with pytest.raises(InvalidInputError):
        validate_registration_deadline(start + timedelta(minutes=1), start)

def test_capacity_must_be_positive():
    with pytest.raises(InvalidInputError):
        validate_capacity(0)

def test_required_text_is_trimmed_and_rejects_whitespace():
    assert require_text("  Choir rehearsal  ", "Event title") == "Choir rehearsal"
    with pytest.raises(InvalidInputError, match="Event title is required"):
        require_text("   ", "Event title")

def test_repeat_until_is_required_only_for_recurring_events():
    start = datetime(2026, 10, 8, 9, 0)
    validate_repeat_until("none", None, start)
    with pytest.raises(InvalidInputError, match="Repeat until is required"):
        validate_repeat_until("weekly", None, start)

def test_repeat_until_accepts_the_event_start_date():
    validate_repeat_until("weekly", date(2026, 10, 8), datetime(2026, 10, 8, 9, 0))

def test_repeat_until_cannot_precede_the_event_start_date():
    with pytest.raises(InvalidInputError, match="event start date"):
        validate_repeat_until("monthly", date(2026, 10, 7), datetime(2026, 10, 8, 9, 0))

def test_event_payload_accepts_empty_optional_dates_from_frontend():
    event = EventCreate(
        organizationId="org-1",
        title="Sunday Mass",
        startsAt="2026-10-08T09:00",
        endsAt="2026-10-08T10:30",
        location="Main Church",
        registrationDeadline="",
        repeatUntil="",
    )
    assert event.registrationDeadline is None
    assert event.repeatUntil is None

def test_manila_timezone_converts_utc_to_frontend_local_date_and_time():
    value = datetime(2026, 10, 7, 16, 0, tzinfo=timezone.utc)
    local = from_utc(value, get_zone("Asia/Manila"))
    assert local.isoformat(timespec="minutes") == "2026-10-08T00:00+08:00"

def test_invalid_organization_timezone_returns_client_validation_error():
    with pytest.raises(InvalidInputError, match="valid IANA timezone"):
        get_zone("Not/A_Timezone")
