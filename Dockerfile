# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install curl and uv (no pip for deps)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
RUN curl -Ls https://astral.sh/uv/install.sh | sh

# Copy project metadata first for dependency install
COPY pyproject.toml README.md /app/

# Install dependencies into a managed venv
RUN uv sync --no-dev

# Copy application code
COPY . /app

# Environment
ENV FLASK_APP=app.py
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 5000

# Run the application via uv
CMD ["uv", "run", "flask", "--app", "app.py", "run", "--host=0.0.0.0"]
