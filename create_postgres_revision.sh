#!/bin/bash

echo "Enter revision message:"
read -r message
cd server/ && alembic revision -m "$message"
