VERSION := $(shell cat VERSION)

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
