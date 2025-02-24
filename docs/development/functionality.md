# App/Client Configuration

**Client & Backend Configurations**
- Use shared JSON schemas for Pydantic (Python) or Java Spring (validators for client).
- Support YAML-based configurations on both the backend and client side.
- Create configuration validators for all application settings.

**Institution Configuration Entity**

**Comparator Configuration Entity**

**VERA Configuration Entity**
| Field |
|-------|
| Institution |


**Kramerius Configuration Entity**
| Field                      |
|----------------------------|
| Name                       |
| Code                       |
| API URL                    |
| Version                    |
| Use As Digitization Source |

---

# Client Features

#### Mobile & Web App

- Develop a mobile version of the app.
- Scan barcode with the camera.
- Implement data refresh after user actions.

#### Search & Notifications

- Toggleable exact match when searching by searchbox.
- Facet by numbers properties.
- Document view: Option for a single document to be open at once.
- Notifications center for in-app and push notifications.

---

# Modularity

- Use keys to authenticate between modules.
- Use keys for elasticsearch.
- Authenticate postgres.
- Authenticate broker.

#### Modules

- Database(s).
- Index(es).
- Broker (locks and event)
- For digitization state retrieval/saving (multiple registries):
    - For digitization registry.
    - For local registry.
- For catalog records retrieval:
    - Aleph Z39.50.
- For catalog records MARC comparing.
- AI predictors.
- Digitization planner (core):
    - Documents.
    - Categories with Distributions.
    - Intentions (switchable).
    - Locations (switchable).
    - Digitization lists.
    - Repository tasks and periodic tasks.
    - Configurable datasets tasks (used with automatic categories).
    - Authenticate with: Keycloak
    - Get usernames from db.
    - Get specific user json: name, permissions, ownership permissions.
    - Get/save user settings.
    - Emulate permissions.

#### Shared

- Json schemas.

---

## Broker module

- object read/write locks
- transfer events

---

## Digitization state modules

#### Digitization registry module (rd-cz)

- get registry record for specific set of identificators

#### Local Digitization registry module (rd-local)

- get state for specific document identified by barcode or sysno
- set state for specific document

#### Kramerius Digitization registry module (rd-kramerius)

- if document found in specific Kramerius, then flag this document as AlreadyDigitized
- save successfuly paired documents x Kramerius pid to database
- enable defining multiple such modules

**Kramerius Digitization Entity**
| Field             |
|-------------------|
| Identifier Type   |
| Identifier Value  |
| Catalog Record ID |
| Kramerius Code    |
| Pid               |

---

## Catalog Records Retrieval modules

- *Config:* Define catalog properties (e.g., Aleph Z39.50, others in future).
- Get/Search for catalog record by identifiers.

---

## MARC Comparator module

- *Config:* Comparison settings (authority catalogs, join queries, comparator settings).
- Compare two provided records.

---

## Core module: Catalog Records

#### Catalog Record Operations

- Get catalog record: Download (using Retrieval module) and save catalog records.
- Compare catalog records (using MARC Comparator module).
- Search saved catalog records (filter by differences, properties).
- Approve difference.
- Rescind difference approval.
- Set up auto-approve catalog record difference categories.
- Decline digitalization from specific record.
- Cancel declanation of digitization.

#### Predefined Lists & Notifications

- Predefined catalog record lists (based on queries).
- Assign lists to users.
- Notify users via email or in-app when assigned to lists.

---

## Core module: Documents

#### Document Addition

**General Functionality**
- Search through the catalog and select an identifier from search results.
- Two document addition modes:
    - Direct Addition – Use a specific identifier (Barcode, ISXN, Signature, System Number).
    - Search & Select – Search using other identifiers and choose a record/issue from results.
- Display catalog records in search results with highlighted issues.
- Search Box:
    - Guess the identifier based on value format.
    - Search by Title and Author.
- Add Box:
    - Validate identifier value format.
- Add documents by synchronizing via broker (state: `InAddingProcess`).
- Store responses and states of document additions, allowing later searches through them.
- Automatically add missing page count if not present.
- Allow selecting a specific issue of a document before adding.
- Support adding:
    - Units
    - Volumes
    - Bundles
    - Standalone documents
    - *Future: Possibly support CD/DVD, LP — check possibilities in MZK Aleph.*
- Option to reset results (remove all results for a user).
- If a document's digitization state is not `NotDigitized`, allow adding it manually despite being digitized.
- Group Document Additions based on the input file name.
- Display page count origin:
    - Specific location in catalog record
    - Predicted values (if enabled)
- Configuration Options:
    - Auto-remove results after a configurable period.
    - Enable/disable page count prediction

**Functionality with propositions**
- Depending on permissions, either:
    - Directly add a document.
    - Flag it as a proposition instead.
- Create a default category for propositions.
- Always add propositions to a dedicated `Propositions` category.
- If adding as a curator, force category selection.

**Document Addition Entity**
| Field                     | Type          | Required | Default value |
|:--------------------------|---------------|----------|---------------|
| Identifier Type           | Enumeration   | Yes      |               |
| Identifier Value          | String        | Yes      |               |
| File Name                 | String        | No       | None          |
| Category                  | Integer (ID)  | Yes      |               |
| Priority                  | Integer [1-5] | No       | 3             |
| Ignore Digitization State | Boolean       | No       | False         |
| Add Again If Present      | Boolean       | No       | False         |

**Enumerations**
- Identifier Type - Barcode, System number, ISXN, Signature (location).

**Activity Diagram**

#### Document Updates & Actions

- Update document category, extraction priority, manual page count.
- Decline digitization for documents (and option to cancel the decline).
- Delete document (flag as deleted, not permanently remove).
- Track digitization state from sources other than the registry.
- Option to add iteration properties for documents (from 1 to *, each extractable once).

#### Document Export

- Export documents in CSV, TXT formats.
- Allow users to choose document fields to export.
- Add preset of fields.
- Choose file location and filename, include preset field options.

#### Documents View

- Filter by facets
- Search box:
    - Checkbox option to search either exact match or use fuzzy search.
    - When searching for exact match try to guess the Identifier Type based on format (e.g. barcode of format `\d{10}`)
- Show recently added documents - from the last batch.
- Displaying details of a document - all parseable properties and VERA properties.
- Generating statistics.

---

## Core module: Categories

#### Category Operations

- Create subcategories, delete subcategories, update subcategories.
- Search categories by name, user group name, digitization list.
- Assign categories to user groups or individual users.
- Set automatic categories from sources like catalog, registry, or Kramerius.

**Category**
| Field               |
|:--------------------|
| Name                |
| Description         |
| Assignable          |
| Extract Whole       |
| Archived            |
| Exclusively owned   |
| Source Dataset Task |

#### Category Distribution

- Manage distributions.
- Keep default distribution - where everything has equal percents.
- Manage distribution percentage for categories.

---

## Core module: Digitization Lists (formally Extractions)
 
#### Pregenerate Digitization list

- Pregenerate digitization list based on categories, distribution, and locations.
- Save pregenerate extraction properties for the last N generations.

#### Digitization List Management

- Merge Extractions and Digitization Lists into one.
- Assign digitization list ID to documents when extracted.

---

## Core module: Intentions

- Manage intentions.
- Intentions based on time periods (start/end)
- Project-based intentions (project name, start/end dates).
- Assign intentions to extracted documents/ to digitization list (all documents in digi list).
- Search intentions.
- Create statistical views based on intentions.

---

## Core module: Locations

#### Location Management

- Manage locations and location groups.

**Category**
| Field       |
|:------------|
| Name        |
| Pattern     |
| Description |
| Groups      |

---

## Core module: Tasks Management

#### Item Tasks

- Reindex items.
- Add documents.
- Sync items with external sources.

#### Dataset Tasks

- Generate datasets based on specific rules.

#### Periodic Tasks

- Schedule tasks based on Elasticsearch query parameters.
- Manage periodic tasks.

---

## System

- Emulate access for testing purposes.
- Export/import entire database or specific entities for backup or migration.

---

## User Management

#### Authentication

- Authenticate with Keycloak (in future maybe add other possibilities too).
- Guest user functionality: Proposal for digitization (save document_id, email, reason?).
- Guest login to see all porposed documents and their states.
- List users present in the database.
- List groups present in the keycloak.
- List roles present in the keycloak.
- List all possible permissions (ownership permissions).
- Manage roles.
- Save users client settings.

#### Roles & Groups

- Define roles and groups in Keycloak.
- Check if roles and groups used in the app are present in Keycloak. [SANITY CHECK]
- Script and GitLab pipeline to set roles and groups from YAML to Keycloak.

#### Permissions

- **Ownership** ('own', 'group', 'all'):
    - Read Documents (must have at least 'own')
    - Manage Documents (also governs comments)
    - Read Categories (must have at least 'own')
    - Manage Categories
- **Non-Ownership**:
    - Propose digitization (also governs remove proposal)
    - Add documents (if present, ignore Propose digitization) [also governs remove document]
    - Accept/Decline proposition
    - Decline/Cancel declanation of digitization
    - Read Catalog Records
    - Review Catalog Records (also governs comments)
    - Manage Catalog Records
    - Run Item Tasks (also governs managing own tasks)
    - Manage Tasks (also governs plan periodic tasks)
    - Create Digitization Lists
    - Manage Digitization Lists (add/remove documents to/from already existing, remove lists)
    - Manage roles.
    - Manage System (emulate access, manage db backups)

#### Entities

**Digitization Proposal Entity** (proposal for future implementation)
| Field           | Req?  |
|:----------------|:-----:|
| Identifier Type |   T   |
| Doc. Identifier |   T   |
| Person email    |   T   |
| Reason for digi |   F   |

**User**
| Field           |
|:----------------|
| Username        |
| Role Name       |
| Permissions     |
| Groups          |
| Client Settings |

**Role**
| Field       | Req?  |
|:------------|:-----:|
| Name        |   T   |
| Permissions |   T   |
