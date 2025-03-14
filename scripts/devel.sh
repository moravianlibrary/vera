#!/bin/sh

# Get project base directory
PROJECT_BASE=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PROJECT_BASE" ]; then
    echo "Error: Could not determine project base directory."
    exit 1
fi

PYTHON_BASE="python3.12"
PYTHON_VENV=$PROJECT_BASE/app/digitization-planner/.venv
PYTHON=$PYTHON_VENV/bin/python
PYTHON_PIP=$PYTHON_VENV/bin/pip
PYTHON_DEPS=$PROJECT_BASE/app/digitization-planner/requirements.txt

check_python_version() {
    if ! command -v "$PYTHON_BASE" >/dev/null 2>&1; then
        echo "Error: $PYTHON_BASE is not installed or not available in PATH."
        exit 1
    fi
}

# Generate virtual environment
generate_venv() {
    if [ -d "$PYTHON_VENV" ]; then
        echo "Virtual environment already exists at $PYTHON_VENV"
    else
        echo "Creating virtual environment..."
        $PYTHON_BASE -m venv "$PYTHON_VENV"
    fi

    if [ ! -f "$PYTHON_DEPS" ]; then
        echo "Error: Requirements file not found at $PYTHON_DEPS"
        exit 1
    fi

    echo "Installing dependencies..."
    $PYTHON_PIP install -r "$PYTHON_DEPS"
}

# Remove virtual environment
remove_venv() {
    if [ -d "$PYTHON_VENV" ]; then
        echo "Removing virtual environment at $PYTHON_VENV..."
        rm -rf "$PYTHON_VENV"
        echo "Virtual environment removed successfully."
    else
        echo "No virtual environment found at $PYTHON_VENV."
    fi
}

# Display help menu
show_help() {
    echo "Usage: $(basename "$0") [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  venv       Create or update the virtual environment"
    echo "  help       Show this help menu"
}

# Main logic
case "$1" in
    venv)
        check_python_version
        generate_venv
        ;;
    reset-venv)
        remove_venv
        check_python_version
        generate_venv
        ;;
    help|*)
        show_help
        ;;
esac
