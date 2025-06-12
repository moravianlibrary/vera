from marcdantic import MarcIssue, MarcRecord

from vera_plugins.specs.digitization_registry_adapter import (
    DigitizationRecord,
    DigitizationRecordState,
    DigitizationRegistryAdapterPlugin,
    RegistrationError,
    StateChangeError,
)


class Skeleton(DigitizationRegistryAdapterPlugin):
    """
    Skeleton class for a plugin that interacts with a digitization registry.

    Methods
    -------
    is_available() -> bool
        Check whether the external resource is available.

    fetch(registry_issue_id: str) -> DigitizationRecord | None:
        Retrieve digitization information for a specific issue
        from the registry.

    find_for_marc_record(record: MarcRecord) -> DigitizationRecord | None:
        Find digitization records matching a given MARC record.

    find_for_marc_issue(
        record: MarcRecord, issue: MarcIssue
    ) -> DigitizationRecord | None:
        Find digitization records matching a given MARC record and issue.

    register_digitization(
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState
    ) -> DigitizationRecord:
        Register a new digitization record in the registry.

    change_state(
        record_id: str, issue_id: str, state: DigitizationRecordState
    ) -> None:
        Change the digitization state of a specific record and issue.
    """

    def is_available(self) -> bool:
        """
        Check whether the external resource is available.

        Returns
        -------
        bool
            True if the resource is available, False otherwise.
        """
        raise NotImplementedError(
            "Implement the availability check logic here."
        )

    def fetch(self, registry_issue_id: str) -> DigitizationRecord | None:
        """
        Retrieve digitization information
        for a specific issue from the registry.

        Parameters
        ----------
        registry_issue_id : str
            The unique identifier of the issue in the digitization registry.

        Returns
        -------
        DigitizationRecord | None
            The digitization record if found, otherwise None.
        """
        raise NotImplementedError(
            "Implement the fetch logic for digitization records here."
        )

    def find_for_marc_record(
        self, record: MarcRecord
    ) -> DigitizationRecord | None:
        """
        Find digitization records matching a given MARC record.

        Parameters
        ----------
        marc_record : MarcRecord
            The MARC record to search for digitization records.

        Returns
        -------
        DigitizationRecord | None
            The digitization record if found, otherwise None.
        """
        raise NotImplementedError(
            "Implement the logic to find digitization records for "
            "a MARC record here."
        )

    def find_for_marc_issue(
        self, record: MarcRecord, issue: MarcIssue
    ) -> DigitizationRecord | None:
        """
        Find digitization records matching a given MARC record and issue.

        Parameters
        ----------
        record : MarcRecord
            The MARC record associated with the issue.
        issue : MarcIssue
            The specific MARC issue to search for digitization records.

        Returns
        -------
        DigitizationRecord | None
            The digitization record if found, otherwise None.
        """
        raise NotImplementedError(
            "Implement the logic to find digitization records for "
            "a MARC issue here."
        )

    def register_digitization(
        self,
        record: MarcRecord,
        issue: MarcIssue | None,
        state: DigitizationRecordState,
    ) -> DigitizationRecord:
        """
        Register a new digitization record in the registry.

        Parameters
        ----------
        record : MarcRecord
            The MARC record to register for digitization.

        issue : MarcIssue | None
            Optional issue within the MARC record to register.

        state : DigitizationRecordState
            Initial digitization state to assign.

        Returns
        -------
        DigitizationRecord
            The newly created digitization record.

        Raises
        ------
        RegistrationError
            If the registration fails due to an error.
        """
        raise NotImplementedError(
            "register_digitization not implemented in this plugin"
        )

    def change_state(
        self, record_id: str, issue_id: str, state: DigitizationRecordState
    ) -> None:
        """
        Change the digitization state of a specific record and issue.

        Parameters
        ----------
        record_id : str
            The unique identifier of the record in the digitization registry.
        issue_id : str
            The unique identifier of the issue in the digitization registry.
        state : DigitizationRecordState
            The new state to assign to the digitization record.

        Raises
        ------
        StateChangeError
            If the state change operation fails.
        """
        raise NotImplementedError(
            "change_state not implemented in this plugin"
        )
