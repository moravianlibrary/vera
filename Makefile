BUILD_SERVER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-server:$(BUILD_IMAGE_TAG)
BUILD_WORKER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-worker:$(BUILD_IMAGE_TAG)
BUILD_CLIENT_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/digboard-client:$(BUILD_IMAGE_TAG)

TARGET_SERVER_IMAGE_TEMPLATE_NAME := mzk.cz/vera-server
TARGET_WORKER_IMAGE_TEMPLATE_NAME := mzk.cz/vera-worker
TARGET_CLIENT_IMAGE_TEMPLATE_NAME := mzk.cz/vera-client

server:
	docker-compose down server
	docker-compose build server
	docker-compose up -d server
start:
	docker-compose up -d
stop:
	docker-compose down
build:
	docker-compose build
clean:
	docker-compose down --volumes
tag:
	docker tag vera-server:latest registry.gitlab.mzk.cz/osdd/vera/vera-server:$(VERSION)
	docker tag vera-worker:latest registry.gitlab.mzk.cz/osdd/vera/vera-worker:$(VERSION)
	docker tag vera-client:latest registry.gitlab.mzk.cz/osdd/vera/vera-client:$(VERSION)
push:
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-server:$(VERSION)
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-worker:$(VERSION)
	docker push registry.gitlab.mzk.cz/osdd/vera/vera-client:$(VERSION)
image:
	docker build -t vera-server:latest server/Dockerfile
	docker build -t vera-worker:latest server/Dockerfile_celery
	docker build -t vera-client:latest webclient/Dockerfile
