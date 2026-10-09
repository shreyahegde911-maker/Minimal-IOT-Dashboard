FROM python:3.10-slim

WORKDIR /app

COPY analytics_alerting/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

CMD ["python", "analytics_alerting/src/main.py"]
