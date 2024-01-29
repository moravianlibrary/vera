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
	docker tag digiboard-server:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-server:$(VERSION)
	docker tag digiboard-worker:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-worker:$(VERSION)
	docker tag digiboard-client:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(VERSION)
push:
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-server:$(VERSION)
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-worker:$(VERSION)
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(VERSION)

