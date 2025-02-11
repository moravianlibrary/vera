# App/Client Configuration

#### Client & Backend Configurations

- Use shared JSON schemas for Pydantic (Python) or Java Spring (validators for client).
- Support YAML-based configurations on both the backend and client side.
- Create configuration validators for all application settings.

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

#### Digitization registry module

- get registry record for specific set of identificators

#### Local Digitization registry module

- get state for specific document identified by barcode or sysno
- set state for specific document

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

- Add documents: synchronize using broker ("In Adding Process" state).
- Save responses/state of adding, allow searching through responses/states.
- Add page count to documents missing page count.
- Select specific issue of a document when adding.
- It should be possible to add units, volumes, bundles and standalones (in future maybe cd/dvd, lp) [find out all possibilities from MZK Aleph]
- Option to reset results (remove all results for a user).
- *Config:* Option to automatically remove results after a set period.
- When digitization state is not 'Not Digitized', then give option to add despite.
- Based on permission, either add document or flag it as proposition.

**Add Document**
| Field           |
|:----------------|
| Identifier Type |
| Identifier      |
| Category        |
| Priority        |

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
