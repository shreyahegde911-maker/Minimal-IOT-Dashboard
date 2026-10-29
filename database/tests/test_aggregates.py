
import os
from datetime import datetime, timedelta, timezone

import psycopg
import pytest


@pytest.fixture
def db_connection():
    """Connect to the test database in autocommit mode."""
    conninfo = os.getenv(
        "TEST_DATABASE_URL",
        "host=localhost port=5432 dbname=miniot user=postgres password=postgres",
    )

    try:
        conn = psycopg.connect(
            conninfo,
            connect_timeout=5,
            autocommit=True,
        )
    except psycopg.Error as exc:
        pytest.fail(f"Could not connect to the test database: {exc}")

    try:
        yield conn
    finally:
        conn.close()


def test_continuous_aggregate_views_exist(db_connection):
    """Verify that all required continuous aggregate views exist."""
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT view_name
            FROM timescaledb_information.continuous_aggregates
            """
        )
        views = {row[0] for row in cur.fetchall()}

    assert {
        "telemetry_minute_avg",
        "telemetry_hourly_avg",
        "telemetry_daily_avg",
    }.issubset(views)


@pytest.mark.parametrize(
    ("view_name", "bucket_column", "bucket_size"),
    [
        ("telemetry_minute_avg", "minute_bucket", timedelta(minutes=1)),
        ("telemetry_hourly_avg", "hour_bucket", timedelta(hours=1)),
        ("telemetry_daily_avg", "day_bucket", timedelta(days=1)),
    ],
)
def test_aggregate_calculations(
    db_connection, view_name, bucket_column, bucket_size
):
    """Verify averages, minimum, and maximum for each aggregate."""

    now = datetime.now(timezone.utc)

    if bucket_size == timedelta(days=1):
        # Align with the UTC calendar-day boundary.
        bucket_start = now.replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - timedelta(days=1)
    elif bucket_size == timedelta(hours=1):
        bucket_start = now.replace(
            minute=0, second=0, microsecond=0
        ) - timedelta(hours=2)
    else:
        bucket_start = now.replace(
            second=0, microsecond=0
        ) - timedelta(minutes=2)

    device_id = f"pytest-{os.getpid()}-{view_name}"

    try:
        with db_connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO telemetry_logs
                    (time, device_id, temperature, humidity, status)
                VALUES
                    (%s, %s, 20.0, 60.0, 'NORMAL'),
                    (%s, %s, 30.0, 40.0, 'NORMAL')
                """,
                (
                    bucket_start + timedelta(seconds=10),
                    device_id,
                    bucket_start + timedelta(seconds=20),
                    device_id,
                ),
            )

            cur.execute(
                "CALL refresh_continuous_aggregate(%s, %s, %s)",
                (
                    view_name,
                    bucket_start,
                    bucket_start + bucket_size,
                ),
            )

            cur.execute(
                f"""
                SELECT avg_temp, avg_humidity, min_temp, max_temp
                FROM {view_name}
                WHERE {bucket_column} = %s AND device_id = %s
                """,
                (bucket_start, device_id),
            )
            row = cur.fetchone()

        assert row is not None, f"No aggregate row found in {view_name}"
        assert float(row[0]) == pytest.approx(25.0)
        assert float(row[1]) == pytest.approx(50.0)
        assert float(row[2]) == pytest.approx(20.0)
        assert float(row[3]) == pytest.approx(30.0)

    finally:
        with db_connection.cursor() as cur:
            cur.execute(
                "DELETE FROM telemetry_logs WHERE device_id = %s",
                (device_id,),
            )


def test_raw_telemetry_retention_policy_is_configured(db_connection):
    """Verify that raw telemetry has a 30-day retention policy."""
    with db_connection.cursor() as cur:
        cur.execute(
            """
            SELECT config
            FROM timescaledb_information.jobs
            WHERE proc_name = 'policy_retention'
            """
        )
        policies = [row[0] for row in cur.fetchall()]

    assert any(
        policy and policy.get("drop_after") == "30 days"
        for policy in policies
    ), f"Expected a 30-day retention policy; found: {policies}"
