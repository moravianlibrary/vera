#!/bin/bash

DIR="/tmp/dk_vera_pg_dump"
KUBE_DIR=$(echo $DIR | sed 's/^\///')

psql -h localhost -d vera -U veraAdmin -c "DO \$\$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop all views
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;

    -- Drop all sequences
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;

    -- Drop all types
    FOR r IN (
        SELECT t.typname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'  -- 'e' for enum types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;

END \$\$;"

kubectl exec -it postgres-0 -n dk-vera -- \
	rm -r $DIR
kubectl exec -it postgres-0 -n dk-vera -- \
	pg_dump -h localhost -U veraAdmin -d vera -F d -f $DIR
kubectl cp dk-vera/postgres-0:$KUBE_DIR $DIR

pg_restore -h localhost -d vera -U veraAdmin $DIR
rm -r $DIR
