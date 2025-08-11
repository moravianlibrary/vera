PYTHON_BASE := python3.12
PYTHON_VENV := .venv
PYTHON := $(PYTHON_VENV)/bin/python
PYTHON_PIP := $(PYTHON_VENV)/bin/pip
PYTHON_DEPS := requirements.txt
ADDITIONAL_LIBS := coverage testcontainers mypy
BROWSER_CMD := xdg-open

TESTS_KFLAG=
ifeq ($(strip $(FILTER)),)
	TESTS_KFLAG=
else
	TESTS_KFLAG=-k $(FILTER)
endif

.PHONY: generate-env remove-env regenerate-env test

generate-env:
	$(PYTHON_BASE) -m venv $(PYTHON_VENV)
	$(PYTHON) -m ensurepip
	$(PYTHON_PIP) install --upgrade pip
	$(PYTHON_PIP) install -r $(PYTHON_DEPS)
	$(PYTHON_PIP) install $(ADDITIONAL_LIBS)

remove-env:
	rm -rf $(PYTHON_VENV)

regenerate-env: remove-env generate-env

test-unit:
	@ $(PYTHON) -m coverage run -m unittest discover -s tests/unit -v $(TESTS_KFLAG) \
	&& $(PYTHON) -m coverage html \
	&& $(PYTHON) -m coverage report

test-integration:
	@ $(PYTHON) -m coverage run -m unittest discover -s tests/integration -v $(TESTS_KFLAG) 	\
	&& $(PYTHON) -m coverage html \
	&& $(PYTHON) -m coverage report

test:
	@ $(PYTHON) -m coverage run -m unittest discover -s tests -v $(TESTS_KFLAG) \
	&& $(PYTHON) -m coverage html \
	&& $(PYTHON) -m coverage report

show-coverage:
	$(BROWSER_CMD) htmlcov/index.html

mypy-check:
	$(PYTHON) -m mypy --config-file mypy.ini .

show-mypy:
	$(BROWSER_CMD) htmlmypy/index.html
