import re
from enum import Enum
from pathlib import Path
from typing import List

import typer

from .cli_schemas import (
    BaseInstanceRow,
    BaseMetaRow,
    DiscoveryInstanceRow,
    DiscoveryMetaRow,
    LintingInstanceRow,
    LintingMetaRow,
)
from .definitions import VERSION_PATTERN, PluginType
from .schemas import MetaDiscoveryResult
from .tools import discovery, validator

app = typer.Typer(help="vera-plugins CLI tool")


PluginLocationArgument = typer.Argument(
    ...,
    help="Path or git URL to plugins (local directory or git repository)",
)

PluginNameArgument = typer.Argument(
    None,
    help="Specific plugin name to operate on "
    "(if not provided, all plugins will be used)",
)

IncludeInstancesOption = typer.Option(
    False,
    "--include-instances",
    "-i",
    help="Also process plugin instances in the specified location",
)


class OutputFormat(str, Enum):
    Table = "table"
    JSON = "json"
    YAML = "yaml"


OutputFormatOption = typer.Option(
    case_sensitive=False,
    show_default=True,
    default=OutputFormat.Table,
    help="Output format for results",
)


def snakify(s: str) -> str:
    s = re.sub(r"[-\s]+", "_", s)
    s = re.sub(r"(?<!^)(?=[A-Z])", "_", s)
    return s.lower()


def _echo_meta_rows(
    meta_rows: List[BaseMetaRow], title: str, no_results_message: str
):
    if not meta_rows:
        typer.echo(no_results_message)
        return

    meta_rows.sort(key=lambda r: (r.path, r.name, r.version), reverse=False)

    typer.echo(f"{title}:\n")
    typer.echo("\n".join(repr(row) for row in meta_rows))


def _echo_instance_rows(
    instance_rows: List[BaseInstanceRow], title: str, no_results_message: str
):
    if not instance_rows:
        typer.echo(no_results_message)
        return

    instance_rows.sort(
        key=lambda r: (r.path, r.plugin_name, r.instance_name), reverse=False
    )

    typer.echo(f"{title}:\n")
    typer.echo("\n".join(repr(row) for row in instance_rows))


@app.command()
def list(
    plugin_location: str = PluginLocationArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Discover plugins from a directory or git repository.
    """
    _echo_meta_rows(
        [
            DiscoveryMetaRow.from_discovery(path, meta, err)
            for path, meta, err in discovery.discover_plugins(plugin_location)
        ],
        "Discovered Plugins",
        "No plugins found.",
    )

    if not include_instances:
        return

    _echo_instance_rows(
        [
            DiscoveryInstanceRow.from_discovery(path, instance, err)
            for path, instance, err in discovery.discover_plugin_instances(
                plugin_location
            )
        ],
        "Discovered Plugin Instances",
        "No plugin instances found.",
    )


@app.command()
def lint(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Lint one or more plugins.
    """
    discovered_metas = discovery.discover_plugins(plugin_location, plugin_name)

    _echo_meta_rows(
        [
            LintingMetaRow.from_discovery(
                dm.file_path,
                dm.item,
                discovery.validate_plugin(
                    dm.item.type, Path(dm.file_path) / dm.item.entrypoint_file
                ),
            )
            for dm in discovered_metas
        ],
        "Results of Plugin Linting",
        "No plugins found.",
    )

    if not include_instances:
        return

    discovered_instances = discovery.discover_plugin_instances(
        plugin_location, plugin_name
    )

    candidate_metas = [meta.item for meta in discovered_metas if meta.item]

    _echo_instance_rows(
        [
            LintingInstanceRow.from_discovery(
                di.file_path,
                di.item,
                validator.validate_instance(
                    di.file_path, di.item, candidate_metas
                ),
            )
            for di in discovered_instances
        ],
        "Results of Plugin Instance Linting",
        "No plugin instances found.",
    )


@app.command()
def describe(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
):
    discovered_metas = discovery.discover_plugins(plugin_location, plugin_name)

    if discovered_metas:
        typer.echo("No plugins found.")
        return

    typer.echo("Discovered Plugins:\n")

    for dm in discovered_metas:
        if dm.error:
            typer.echo(
                f"Error discovering plugin at {dm.file_path}: {dm.error}\n"
            )
            continue

        typer.echo(f"{repr(dm.item)}\n")


@app.command()
def test(
    plugin_location: str = PluginLocationArgument,
    plugin_name: str | None = PluginNameArgument,
    tests_location: str = typer.Option(
        None,
        "--tests-location",
        "-t",
        help="Path to directory with tests for the plugin",
    ),
    format: OutputFormat = OutputFormatOption,
):
    discovered_metas = discovery.discover_plugins(plugin_location, plugin_name)

    if discovered_metas:
        typer.echo("No plugins found.")
        return

    discovered_instances = discovery.discover_plugin_instances(
        plugin_location, plugin_name
    )

    if not discovered_instances:
        typer.echo("No plugin instances found.")
        return

    typer.echo("Discovered Plugins:\n")

    errorless_metas: List[MetaDiscoveryResult] = []

    for dm in discovered_metas:
        if dm.error:
            typer.echo(
                f"Error discovering plugin at {dm.file_path}: {dm.error}"
            )
        else:
            errorless_metas.append(dm)

    for di in discovered_instances:
        if di.error:
            typer.echo(
                f"Error discovering plugin instance at {di.file_path}: "
                f"{di.error}"
            )
            continue

        meta = next(
            (m for m in errorless_metas if m.item.name == di.item.plugin_name),
            None,
        )

        if not meta:
            typer.echo(
                f"Plugin {di.item.plugin_name} metadata "
                f"for instance {di.item.instance_name} not found."
            )
            continue


@app.command()
def init(
    target_dir: Path = typer.Argument(
        Path("."),
        help="Directory where the new plugin will be created",
    ),
    name: str | None = typer.Option(None, "--name", help="Name of the plugin"),
    plugin_type: PluginType | None = typer.Option(
        None, "--type", help="Type of plugin"
    ),
    version: str | None = typer.Option(
        None, "--version", help="Version (format: X.Y.Z or X.Y.Z-suffix)"
    ),
    author: str | None = typer.Option(None, "--author", help="Author's name"),
    description: str | None = typer.Option(
        None, "--description", help="Short plugin description"
    ),
    entrypoint: str = typer.Option(
        None,
        "--entrypoint",
        help="Name of the main plugin implementation file (e.g., plugin.py). "
        "Defaults to a snake_case version of the plugin name plus '.py'.",
    ),
    config_schema: str | None = typer.Option(
        None,
        "--config-schema",
        help="Path to a JSON schema file describing plugin configuration",
    ),
    additional: List[str] = typer.Option(
        [],
        "--additional",
        help="List of additional files to include with the plugin",
    ),
    skeleton: bool | None = typer.Option(
        None,
        "--skeleton/--no-skeleton",
        help="Include a minimal skeleton in the plugin’s entrypoint file, "
        "with imports and a class implementing the required interface",
    ),
    create_missing: bool | None = typer.Option(
        None,
        "--create-missing/--no-create-missing",
        help="Create missing directories and files if they don't exist",
    ),
):
    """
    Create a new plugin project with the specified metadata and structure.
    """
    typer.echo(f"Initializing new plugin in {target_dir}")

    if not name:
        name = typer.prompt("Enter plugin name")

    if not plugin_type:
        plugin_type = typer.prompt("Choose plugin type", type=PluginType)

    if not version:
        version = typer.prompt("Enter version", default="0.1.0")
    while not VERSION_PATTERN.match(version):
        typer.echo("❌ Invalid version format. Use X.Y.Z or X.Y.Z-suffix")
        version = typer.prompt("Enter version", default="0.1.0")

    if not author:
        author = typer.prompt("Enter author name")

    if not description:
        description = typer.prompt("Enter plugin description")

    if not entrypoint:
        entrypoint = typer.prompt(
            "Primary entry file", default=f"{snakify(name)}.py"
        )
    while not entrypoint.endswith(".py"):
        typer.echo("❌ Entrypoint must be a .py file")
        entrypoint = typer.prompt(
            "Primary entry file", default=f"{snakify(name)}.py"
        )

    if not config_schema:
        config_schema = typer.prompt("Path to config schema", default=None)
    while config_schema and not config_schema.endswith("schema.json"):
        typer.echo("Config schema must be a JSON file")
        typer.echo(
            "❌ Config schema must be a JSON file ending with 'schema.json'"
        )
        config_schema = typer.prompt("Path to config schema", default=None)

    if not additional:
        raw = typer.prompt(
            "Additional files to include (comma-separated, optional)",
            default="",
        )
        additional = [f.strip() for f in raw.split(",") if f.strip()]

    if skeleton is None:
        skeleton = typer.confirm(
            "Do you want to include a minimal skeleton "
            "in the plugin entrypoint file?",
            default=True,
        )

    typer.echo("\n✅ Plugin configuration:")
    typer.echo(f"  Name             : {name}")
    typer.echo(f"  Type             : {plugin_type}")
    typer.echo(f"  Version          : {version}")
    typer.echo(f"  Author           : {author or 'None'}")
    typer.echo(f"  Description      : {description or 'None'}")
    typer.echo(f"  Entrypoint file  : {entrypoint}")
    typer.echo(f"  Config schema    : {config_schema or 'None'}")
    typer.echo(f"  Additional files : {', '.join(additional) or 'None'}")
    typer.echo(f"  Skeleton         : {'Yes' if skeleton else 'No'}")
    typer.confirm("Is this configuration correct?", default=True, abort=True)

    typer.echo("\nCreating plugin...")

    def _ensure_exists(path: Path, is_dir: bool = False):
        nonlocal create_missing

        if path.exists():
            if is_dir and not path.is_dir():
                typer.echo(f"❌ Path '{path}' exists but is not a directory.")
                raise typer.Exit(code=1)
            if not is_dir and not path.is_file():
                typer.echo(f"❌ Path '{path}' exists but is not a file.")
                raise typer.Exit(code=1)
            return

        if create_missing is None:
            create_missing = typer.confirm(
                "Some directories or files do not exist. "
                "Do you want to create them?",
                default=True,
            )

        if not create_missing:
            target_type = "directory" if is_dir else "file"
            typer.echo(f"❌ Required {target_type} '{path}' does not exist.")
            raise typer.Exit(code=1)

        if is_dir:
            path.mkdir(parents=True, exist_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch(exist_ok=True)

    target_dir = target_dir.resolve()
    _ensure_exists(target_dir, is_dir=True)

    entrypoint_path = target_dir / entrypoint
    if entrypoint_path.exists() and skeleton:
        typer.echo(
            f"❌ Entrypoint file {entrypoint_path} already exists. "
            "It will not be overwritten with a skeleton."
        )
    else:
        _ensure_exists(entrypoint_path)
        if skeleton:
            pass

    if config_schema:
        _ensure_exists(target_dir / config_schema)

    for filename in additional:
        _ensure_exists(target_dir / filename)

    typer.echo(f"Plugin '{name}' initialized successfully.")


def main():
    app()


if __name__ == "__main__":
    main()
