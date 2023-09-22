run: start run-server

run-server:
	python app/digiboard.py

start:
	docker-compose up -d
stop:
	docker-compose down
restart:
	docker-compose down && docker-compose up -d
clean-db:
	docker-compose down --volumes
