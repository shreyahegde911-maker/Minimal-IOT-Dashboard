import os

import psycopg


DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "miniot")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def insert_reading(reading):
    """Insert one telemetry reading into TimescaleDB."""

    connection = psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO telemetry_logs
                    (time, device_id, temperature, humidity, status)
                VALUES
                    (%s, %s, %s, %s, %s)
                """,
                (
                    reading["time"],
                    reading["device_id"],
                    reading["temperature"],
                    reading["humidity"],
                    reading["status"],
                ),
            )

        connection.commit()

    finally:
        connection.close()