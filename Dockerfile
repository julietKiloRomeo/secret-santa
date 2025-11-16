# Use an official Python runtime as a parent image
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Set the working directory in the container
WORKDIR /app


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

# Run the application via gunicorn (4 workers)
# Use `uv run` to execute within the managed environment
CMD ["uv", "run", "gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
