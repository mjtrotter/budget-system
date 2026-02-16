# Keswick Cart Scraper - Cloud Run Dockerfile
# Uses Microsoft's Playwright image for browser support

FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Firefox for better stealth against Amazon bot detection)
RUN playwright install firefox

# Copy application code
COPY . .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Run the application
CMD ["python", "main.py"]
