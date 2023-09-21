run: start-db run-server

run-server:
	python app/digiboard.py

start-db:
	docker-compose up -d
stop-db:
	docker-compose down
clean-db:
	docker-compose down --volumes
