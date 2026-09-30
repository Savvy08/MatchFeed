FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir curl_cffi

COPY server_relay.py /app/server_relay.py

ENV MATCHFEED_PORT=8089
ENV MATCHFEED_HOST=0.0.0.0

EXPOSE 8089

CMD ["python3", "server_relay.py", "--port", "8089", "--host", "0.0.0.0"]
