FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir requests

COPY simulator/simulator.py .

ENV BACKEND_INGEST_URL=http://backend:3000/api/telemetry
ENV SIMULATION_INTERVAL_SEC=3

CMD ["python", "simulator.py"]
