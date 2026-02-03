FROM python:3.11-slim

# Set environment variables for non-interactive builds
ENV PYTHONUNBUFFERED=True

# Set the working directory
WORKDIR /app

# 1. Install System Dependencies
# These tools are needed to compile packages like numpy, pandas, and psycopg2-binary
RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy and install Python dependencies
# libpq-dev is for psycopg2 (PostgreSQL)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy Application Code
# Copy persistence directory and main script
COPY persistence/ ./persistence/
COPY recommendation_models.py .
COPY main.py .

# 4. Define the Entry Point
# The CMD specifies the command to execute when the container starts.
# We execute the main script that runs the recommendation logic.
# If you run this as a Cloud Run Job, this command runs once and exits.
CMD ["python", "main.py"]