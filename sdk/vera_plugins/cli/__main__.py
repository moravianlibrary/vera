from pathlib import Path
from typing import List

import typer
import yaml

from ..definitions.constants import PLUGIN_META_PATH
from ..definitions.plugin_types import PluginType
from ..dispatchers import get_plugin_type_skeleton
from ..schemas import MetaDiscoveryResult, PluginMeta, Version
from ..tools import discovery, parser, validator
from .prompts import (
    echo_instance_rows,
    echo_meta_rows,
    validate_entrypoint,
    validate_json_schema,
    validate_version,
)
from .schemas import (
    DiscoveryInstanceRow,
    DiscoveryMetaRow,
    LintingInstanceRow,
    LintingMetaRow,
)
from .utils import parse_str_or_none, snakify

app = typer.Typer(help="vera-plugins CLI tool")


PluginLocationArgument = typer.Argument(
    ..., help="Path or git URL to plugins (local directory or git repository)"
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


@app.command()
def list(
    plugin_location: str = PluginLocationArgument,
    include_instances: bool = IncludeInstancesOption,
):
    """
    Discover plugins from a directory or git repository.
    """
    echo_meta_rows(
        [
            DiscoveryMetaRow.from_discovery(path, meta, err)
            for path, meta, err in discovery.discover_plugins(plugin_location)
        ],
        "Discovered Plugins",
        "No plugins found.",
    )

    if not include_instances:
        return

    echo_instance_rows(
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

    echo_meta_rows(
        [
            LintingMetaRow.from_discovery(
                dm.file_path,
                dm.item,
                validator.validate_plugin(dm.file_path.parent, dm.item),
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

    echo_instance_rows(
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

    if not discovered_metas:
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
):
    discovered_metas = discovery.discover_plugins(plugin_location, plugin_name)

    if not discovered_metas:
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


@app.command("init-plugin")
def init_plugin(
    target_dir: Path = typer.Argument(
        Path("."),
        help="Directory where the new plugin will be created",
    ),
    name: str = typer.Option(
        None, prompt="Enter plugin name", help="Name of the plugin"
    ),
    plugin_type: PluginType = typer.Option(
        None, prompt="Choose plugin type", help="Type of plugin"
    ),
    version: Version = typer.Option(
        "0.1.0",
        prompt="Enter version",
        help="Version (format: X.Y.Z or X.Y.Z-suffix)",
        callback=validate_version,
    ),
    author: str | None = typer.Option(
        "None",
        prompt="Enter author name",
        help="Author's name",
        callback=parse_str_or_none,
    ),
    description: str | None = typer.Option(
        "None",
        prompt="Enter plugin description",
        help="Short plugin description",
        callback=parse_str_or_none,
    ),
    entrypoint: str = typer.Option(
        "{snakify(Plugin name)}.py",
        prompt="Enter entry point file (e.g., plugin.py)",
        help="Name of the main plugin implementation file (e.g., plugin.py). "
        "Defaults to a snake_case version of the plugin name plus '.py'.",
        callback=validate_entrypoint,
    ),
    config_schema: str | None = typer.Option(
        "None",
        prompt="Path to config schema",
        help="Path to a JSON schema file describing plugin configuration",
        callback=validate_json_schema,
    ),
    additional: List[str] = typer.Option(
        [],
        help="List of additional files to include with the plugin",
        callback=parse_str_or_none,
    ),
    skeleton: bool | None = typer.Option(
        None,
        "--skeleton/--no-skeleton",
        prompt="Include a minimal skeleton in the plugin entrypoint",
        help="Include a minimal skeleton in the plugin’s entrypoint file, "
        "with imports and a class implementing the required interface",
    ),
    create_missing: bool | None = typer.Option(
        None,
        "--create-missing/--no-create-missing",
        prompt="Create missing directories and files",
        help="Create missing directories and files if they don't exist",
    ),
):
    """
    Create a new plugin project with the specified metadata and structure.
    """

    if entrypoint == "{snakify(Plugin name)}.py":
        entrypoint = f"{snakify(name)}.py"

    additional_str = ", ".join(additional) if additional else None

    typer.echo("\nPlugin configuration:")
    typer.echo(f"  Target directory : {target_dir}")
    typer.echo(f"  Name             : {name}")
    typer.echo(f"  Type             : {plugin_type}")
    typer.echo(f"  Version          : {version}")
    typer.echo(f"  Author           : {author or '-'}")
    typer.echo(f"  Description      : {description or '-'}")
    typer.echo(f"  Entrypoint file  : {entrypoint}")
    typer.echo(f"  Config schema    : {config_schema or '-'}")
    typer.echo(f"  Additional files : {additional_str or '-'}")
    typer.echo(f"  Skeleton         : {'Yes' if skeleton else 'No'}")
    typer.confirm("Is this configuration correct?", default=True, abort=True)

    typer.echo("\nCreating plugin...")

    def _validate_path(path: Path, is_dir: bool) -> bool:
        if path.exists():
            if is_dir and not path.is_dir():
                typer.echo(f"[X] Path '{path}' exists but is not a directory.")
                raise typer.Exit(code=1)
            if not is_dir and not path.is_file():
                typer.echo(f"[X] Path '{path}' exists but is not a file.")
                raise typer.Exit(code=1)
            return True
        return False

    def _ensure_exists(path: Path, is_dir: bool = False):
        nonlocal create_missing

        if _validate_path(path, is_dir):
            return

        if create_missing is None:
            create_missing = typer.confirm(
                "Some directories or files do not exist. "
                "Do you want to create them?",
                default=True,
            )

        if not create_missing:
            target_type = "directory" if is_dir else "file"
            typer.echo(f"[X] Required {target_type} '{path}' does not exist.")
            raise typer.Exit(code=1)

        if is_dir:
            path.mkdir(parents=True, exist_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.touch(exist_ok=True)

    target_dir = target_dir.resolve()
    _ensure_exists(target_dir, is_dir=True)

    meta_path = target_dir / PLUGIN_META_PATH
    if not _validate_path(meta_path, is_dir=False):
        meta_path.touch()

    metas, errors = parser.parse_yaml_config_file(meta_path, PluginMeta)

    if errors:
        typer.echo(f"Errors parsing plugin metadata in {meta_path}:")
        for error in errors:
            typer.echo(f"  - {error}")
        raise typer.Exit(code=1)

    if any(m for m in metas if m.name == name):
        typer.echo(f"Plugin with name '{name}' already exists in {meta_path}.")
        raise typer.Exit(code=1)

    entrypoint_path = target_dir / entrypoint
    if entrypoint_path.exists() and skeleton:
        typer.echo(
            f"Entrypoint file {entrypoint_path} already exists. "
            "It will not be overwritten with a skeleton."
        )
    else:
        _ensure_exists(entrypoint_path)
        if skeleton:
            entrypoint_path.write_text(
                get_plugin_type_skeleton(plugin_type, name)
            )

    if config_schema:
        _ensure_exists(target_dir / config_schema)

    for filename in additional:
        _ensure_exists(target_dir / filename)

    metas.append(
        PluginMeta(
            name=name,
            type=plugin_type,
            version=version,
            author=author or None,
            description=description or None,
            entrypoint_file=entrypoint,
            settings_schema_path=config_schema or None,
            additional_files=additional or None,
        )
    )

    meta_path.write_text(
        yaml.dump_all(
            [
                meta.model_dump(
                    mode="json",
                    exclude_unset=True,
                    exclude_defaults=True,
                    exclude_none=True,
                )
                for meta in metas
            ],
            sort_keys=False,
            explicit_start=True,
        )
    )

    typer.echo(f"Plugin '{name}' initialized successfully.")


def main():
    app()


if __name__ == "__main__":
    main()
