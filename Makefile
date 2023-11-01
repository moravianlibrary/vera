VERSION := $(shell cat VERSION)

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
	docker tag digiboard-client:latest registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(VERSION)
push:
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-server:$(VERSION)
	docker push registry.gitlab.mzk.cz/osdd/digiboard/digiboard-client:$(VERSION)
