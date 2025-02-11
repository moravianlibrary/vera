# Structure

/vera
│── /app
│   ├── /ai
│   ├── /catalog-connectors
│   │   ├── /aleph
│   │   │   ├── /z39.50
│   │   ├── /other-connectors (if needed)
│   ├── /catalog-records
│   ├── /database-migrations
│   ├── /digitization-planner (vera / core)
│   ├── /digitization-registries
│   │   ├── /kramerius (maybe ?)
│   │   ├── /local
│   │   ├── /rd
│   ├── /marc-comparator
│   ├── /tasks
│   │   ├── /catalog-records
│   │   ├── /data-source
│   │   ├── /documents
│   ├── /schemas
│   ├── /tests
│── /client
│   ├── /marc-comparator
│   ├── /vera
├── /configs
│── /docs
│── build.sh
│── README.md

## Build

Individual builds for different applications would wrap different parts of the project to container image.

- VERA:
    - MZK App
    - Client
- MARC Comparator:
    - App: catalog-connector, catalog-records, marc-comparator, tasks/catalog-records
    - Client
