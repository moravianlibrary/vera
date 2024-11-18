REACT_APP_ENV ?= local

BUILD_SERVER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-server:$(BUILD_IMAGE_TAG)
BUILD_WORKER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-worker:$(BUILD_IMAGE_TAG)
BUILD_CLIENT_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-client:$(BUILD_IMAGE_TAG)

TARGET_SERVER_IMAGE_TEMPLATE_NAME := mzk.cz/vera-server
TARGET_WORKER_IMAGE_TEMPLATE_NAME := mzk.cz/vera-worker
TARGET_CLIENT_IMAGE_TEMPLATE_NAME := mzk.cz/vera-client

create-env:
	cd server/ && python -m venv .venv && source .venv/bin/activate && pip install -r requirements_server.txt

rm-env:
	rm -r server/.venv/

start-devel:
	docker-compose up -d server worker
stop-devel:
	docker-compose down server worker
build-devel:
	docker-compose build server worker
run-devel: stop-devel build-devel start-devel

start:
	docker-compose up -d server worker client
stop:
	docker-compose down server worker client
build:
	docker-compose build server worker client
run: stop build start

start-ai:
	docker-compose up -d ai
stop-ai:
	docker-compose down ai
build-ai:
	docker-compose build ai
run-ai: stop build start

clean:
	docker-compose down --volumes
tag:
	docker tag vera-server:latest registry.gitlab.mzk.cz/osdd/vera/vera-server:$(BUILD_IMAGE_TAG)
	docker tag vera-worker:latest registry.gitlab.mzk.cz/osdd/vera/vera-worker:$(BUILD_IMAGE_TAG)
	docker tag vera-client:latest registry.gitlab.mzk.cz/osdd/vera/vera-client:$(BUILD_IMAGE_TAG)
push:
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-server:$(BUILD_IMAGE_TAG)
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-worker:$(BUILD_IMAGE_TAG)
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-client:$(BUILD_IMAGE_TAG)
image:
	docker build -t vera-server:latest -f server/Dockerfile server/
	docker build -t vera-worker:latest -f server/Dockerfile_celery server/
	docker build -t vera-client:latest -f webclient/Dockerfile --build-arg REACT_APP_ENV=$(REACT_APP_ENV) webclient/
deploy:
	kustomize edit set 'image' $(TARGET_SERVER_IMAGE_TEMPLATE_NAME)=$(BUILD_SERVER_IMAGE_NAME)
	kustomize edit set 'image' $(TARGET_WORKER_IMAGE_TEMPLATE_NAME)=$(BUILD_WORKER_IMAGE_NAME)
	kustomize edit set 'image' $(TARGET_CLIENT_IMAGE_TEMPLATE_NAME)=$(BUILD_CLIENT_IMAGE_NAME)

create-db-revision:
	./create_postgres_revision.sh
upgrade-db-local:
	cd server/ && alembic upgrade head
schema-generated:
	pg_dump -h localhost -p 5433 -U veraAdmin -d vera-test -s -f generated_schema.sql
schema-actual:
	pg_dump -h localhost -U veraAdmin -d vera -s -f actual_schema.sql
generate-db-backup:
	pg_dump -h localhost -U veraAdmin -d vera > backup.sql
load-db-from-backup:
	pg_dump -h localhost -U veraAdmin -d vera < backup.sql

test:
	cd server/ \
		&& .venv/bin/python -m coverage run -m unittest discover -s tests/ \
		&& coverage html \
		&& coverage report
