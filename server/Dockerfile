# Use the official Python image as the base image
FROM python:3.12-slim

# Set environment variables for Python to run in unbuffered mode
ENV PYTHONUNBUFFERED 1

# Create and set the working directory in the container
WORKDIR /app

# Install YAZ C library
RUN apt-get update && \
    apt-get install -y --no-install-recommends libyaz5

# Copy the requirements file to the container and install dependencies
COPY requirements_server.txt /app/
COPY mzk_libs /app/mzk_libs
RUN pip install --no-cache-dir -r requirements_server.txt

# Copy the entire project directory into the container
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

COPY datatypes /app/datatypes
COPY dispatchers /app/dispatchers
COPY exceptions /app/exceptions
COPY models /app/models
COPY routers /app/routers
COPY schemas /app/schemas
COPY services /app/services
COPY tasks /app/tasks

COPY config.py /app
COPY vera.py /app
COPY vera_lifespan.py /app
COPY vera_scheduler.py /app
COPY worker.py /app


# Expose port 8000 for the FastAPI application
EXPOSE 8000

# Start the FastAPI application when the container is run
CMD ["uvicorn", "vera:app", "--host", "0.0.0.0", "--port", "8000"]
