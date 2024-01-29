# BUILD_SERVER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/digiboard-server:$(BUILD_IMAGE_TAG)
# BUILD_WORKER_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/digiboard-worker:$(BUILD_IMAGE_TAG)
# BUILD_CLIENT_IMAGE_NAME := $(CI_REGISTRY_IMAGE)/digboard-client:$(BUILD_IMAGE_TAG)

# TARGET_SERVER_IMAGE_TEMPLATE_NAME := mzk.cz/digiboard-server
# TARGET_WORKER_IMAGE_TEMPLATE_NAME := mzk.cz/digiboard-worker
# TARGET_CLIENT_IMAGE_TEMPLATE_NAME := mzk.cz/digiboard-client

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
	docker tag digiboard-server:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-server:$(BUILD_IMAGE_TAG)
	docker tag digiboard-worker:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-worker:$(BUILD_IMAGE_TAG)
	docker tag digiboard-client:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(BUILD_IMAGE_TAG)
push:
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-server:$(BUILD_IMAGE_TAG)
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-worker:$(BUILD_IMAGE_TAG)
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(BUILD_IMAGE_TAG)
image:
	docker build -t digiboard-server:latest -f server/Dockerfile server/
	docker build -t digiboard-worker:latest -f server/Dockerfile_celery server/
	docker build -t digiboard-client:latest -f webclient/Dockerfile webclient/
# kustomize:
#     kustomize edit set image ${TARGET_SERVER_IMAGE_TEMPLATE_NAME}=${BUILD_SERVER_IMAGE_NAME}
#     kustomize edit set image ${TARGET_WORKER_IMAGE_TEMPLATE_NAME}=${BUILD_WORKER_IMAGE_NAME}
#     kustomize edit set image ${TARGET_CLIENT_IMAGE_TEMPLATE_NAME}=${BUILD_CLIENT_IMAGE_NAME}