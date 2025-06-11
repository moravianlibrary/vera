from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, List, Type, TypeVar


class PluginBase(ABC):
    """
    Abstract base class for all plugins.

    Defines a common interface for plugins, including an optional method
    to provide a configuration schema. Plugins that do not support
    configuration should return None.

    Methods
    -------
    get_config_schema() -> dict or None
        Return a JSON-compatible configuration schema, or None if the plugin
        does not support configuration.
    """

    def get_config_schema(self) -> Dict[str, Any] | None:
        """
        Return the configuration schema for the plugin.

        This method should return a JSON-compatible dictionary describing
        the expected configuration structure. If the plugin does not support
        configuration, it should return None.

        Returns
        -------
        dict or None
            A dictionary representing the plugin's configuration schema,
            or None if configuration is not supported.
        """
        return None


class ExternalResourcePluginBase(PluginBase):
    """
    Abstract base class for plugins that depend on external resources.

    Defines an interface for plugins that interact with external services
    such as databases, APIs, or remote systems.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    is_available() -> bool
        Check whether the external resource is available.
    """

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        pass


JSONScalar = str | int | float | bool | None
JSONType = JSONScalar | List["JSONType"] | Dict[str, "JSONType"]

InputType = TypeVar("InputType")
PropertyType = TypeVar("PropertyType", bound=JSONType)
ExtractedProperties = Dict[str, PropertyType]


class DataPropertyPluginBase(PluginBase, Generic[InputType, PropertyType]):
    """
    Abstract base class for plugins that extract a property from input data.

    Designed for plugins that derive a JSON-serializable property
    from structured input.

    Type Parameters
    ---------------
    InputType : type
        The type of input data to parse.
    PropertyType : type
        The JSON-compatible type of the extracted property.

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    parse(input_data: InputType) -> PropertyType
        Extract a property from the given input data.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.
    """

    @abstractmethod
    def parse(self, input_data: InputType) -> PropertyType:
        """
        Extract a property from the given input data.

        Parameters
        ----------
        input_data : InputType
            The input data from which to extract the property.

        Returns
        -------
        PropertyType
            The extracted property.
        """
        pass

    @property
    @abstractmethod
    def property_name(self) -> str:
        """
        The name or identifier of the extracted property.

        Returns
        -------
        str
            The property name.
        """
        pass

    @property
    @abstractmethod
    def property_type(self) -> Type[PropertyType]:
        """
        The Python type of the extracted property.

        Returns
        -------
        type
            The Python type of the property.
        """
        pass


class ExternalDataPropertyPluginBase(
    DataPropertyPluginBase[InputType, PropertyType], ExternalResourcePluginBase
):
    """
    Abstract base class for plugins that extract properties using external
    resources.

    Combines the interfaces of `DataPropertyPluginBase` and
    `ExternalResourcePluginBase` to support property extraction that depends
    on external systems (e.g., APIs, databases).

    Methods
    -------
    get_config_schema() -> dict or None
        Return the plugin's configuration schema, or None if unsupported.

    is_available() -> bool
        Check if the external resource is available.

    parse(input_data: InputType) -> PropertyType
        Extract the property using both the input and external resources.

    property_name() -> str
        Return the name/identifier of the extracted property.

    property_type() -> type
        Return the Python type of the extracted property.
    """

    pass
