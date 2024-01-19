# Use the official Python image as the base image
FROM python:3.8-slim

# Set environment variables for Python to run in unbuffered mode
ENV PYTHONUNBUFFERED 1

# Create and set the working directory in the container
WORKDIR /app

# Copy the requirements file to the container and install dependencies
COPY requirements_server.txt /app/
RUN pip install --no-cache-dir -r requirements_server.txt

# Copy the entire project directory into the container
COPY auth /app/auth
COPY catalogs /app/catalogs
COPY categories /app/categories
COPY departments /app/departments
COPY documents /app/documents
COPY extractions /app/extractions
COPY predictions /app/predictions
COPY roles /app/roles
COPY services /app/services
COPY tasks /app/tasks
COPY celery_worker.py /app
COPY digiboard.py /app


# Expose port 8000 for the FastAPI application
EXPOSE 8000

# Start the FastAPI application when the container is run
CMD ["uvicorn", "digiboard:app", "--host", "0.0.0.0", "--port", "8000"]
