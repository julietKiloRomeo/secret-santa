FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1

COPY pyproject.toml uv.lock .python-version README.md /app/
RUN uv sync --frozen --no-dev --no-install-project

COPY . /app

EXPOSE 5000
# One process on purpose: draw, logins and game state live in module globals.
CMD ["uv", "run", "--no-dev", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers", "--forwarded-allow-ips", "*"]
