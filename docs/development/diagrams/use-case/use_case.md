# Use case

## Catalog Record List
- User with sufficient permissions can create a catalog record list, which is a named query
- User that created the catalog record list can manage it
- User with sufficient permissions can manage the catalog record list
- User should be able to set some notifications settings - this should be probably settable in user preferences
- System should sent email notifications based on the settings when the records are added to the list

## Project:
- User with sufficient permissions can create a project
- User that created the project can update basic project information
- User that created the project can add or remove project members (invite by email?)
- User that created the project and has sufficient permissions to list user groups can add or remove project member groups
- User with sufficient permissions can manage all projects - information and members
- User with sufficient permissions can change project status

## Document Proposals:
- Search in Catalog with some query
- List results from Catalog Search
- Choose Catalog Record from results
- Get proposal eligibility for specific issues, either after choosing record or for all records in current page of search results (this can maybe be limited, that if there is small number of results than automatically load also eligibility)
- Choose record from catalog search results
- Choose issue(s) from record to be proposed. The issues has to be eligible for proposal.
- If the issue is not eligible for proposal, beacuse it is in digitization process or was processed before, make it possible to request exception.
- Second option how to propose documents would be by using specific identifier and then providing values to be processed later. Either manually copied from somewhere or from file.
- There should also be option to propose documents for project. If the document is proposed for project either use project category or if the project category is more hierarchical then let the user choose to which project category should the proposal go.
- If the project is in the state Proposed then simply add proposed documents. If it is in Accepted state, then show warning that it is in this state but still allow proposing documents. If it is in the state Rejected than do not allow proposing to this project.
