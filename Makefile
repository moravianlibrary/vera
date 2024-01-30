BUILD_SERVER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-server:$(BUILD_IMAGE_TAG)
BUILD_WORKER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-worker:$(BUILD_IMAGE_TAG)
BUILD_CLIENT_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/vera-client:$(BUILD_IMAGE_TAG)

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
	docker build -t digiboard-server:latest -f server/Dockerfile server/
	docker build -t digiboard-worker:latest -f server/Dockerfile_celery server/
	docker build -t digiboard-client:latest -f webclient/Dockerfile webclient/
kustomize:
    kustomize edit set 'image' $(TARGET_SERVER_IMAGE_TEMPLATE_NAME)=$(BUILD_SERVER_IMAGE_NAME)
    kustomize edit set 'image' $(TARGET_WORKER_IMAGE_TEMPLATE_NAME)=$(BUILD_WORKER_IMAGE_NAME)
    kustomize edit set 'image' $(TARGET_CLIENT_IMAGE_TEMPLATE_NAME)=$(BUILD_CLIENT_IMAGE_NAME)
