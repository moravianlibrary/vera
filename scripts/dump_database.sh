#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <backup-directory>"
    exit 1
fi

dir=$1

if [ ! -d "$dir" ]; then
    echo "Error: $dir is not a valid directory."
    exit 1
fi

pg_dump -h localhost -U veraAdmin -d vera -F d -f $dir
