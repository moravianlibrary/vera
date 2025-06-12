from abc import ABC, abstractmethod
from typing import Generic

from ..definitions.data_property import InputType, PropertyType


class PluginBase(ABC):
    """
    Abstract base class for all plugins.
    """


class ExternalResourcePluginBase(PluginBase):
    """
    Abstract base class for plugins that depend on external resources.

    Defines an interface for plugins that interact with external services
    such as databases, APIs, or remote systems.

    Methods
    -------
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
    parse(input_data: InputType) -> PropertyType
        Extract a property from the given input data.
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
    is_available() -> bool
        Check if the external resource is available.

    parse(input_data: InputType) -> PropertyType
        Extract the property using both the input and external resources.
    """
