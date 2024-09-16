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

pg_restore -h localhost -d vera -U veraAdmin $dir
