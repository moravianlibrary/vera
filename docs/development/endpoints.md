# Endpoints

## Authorization

- Roles
- Users
- User Groups

## Documents

- Catalog Search
- Catalog Records
- Proposals
- Additions
- Documents
- Document Iterations

## Documents Organization

- Categories
- Cateogries Distributions
- Categories Proportions
- Projects

### Categories

---

#### Search Categories

> **POST `/categories/search`**
> 
> **Permission required:** `OwnershipPermission.ReadCategories`

Users can search categories they have read access to — this includes categories they *own* directly or indirectly (e.g., through parent ownership).

An `IndexerRequest` can be used to filter and paginate the results.

---

#### Create a Category

> **POST `/categories`**
> 
> **Permission required:** `OwnershipPermission.CreateCategories`

Allows users to create a new category under a parent category they *own*.

If no parent is specified, the new category is created at the top level. In such case the ownership required is *all*.

The authenticated user becomes the owner of the newly created category.

---

#### Update a Category

> **PUT `/categories/{category_id}`**
> 
> **Permission required:** `OwnershipPermission.ManageCategories`

Updates an existing category’s details.

The user has to have ownership of *this category*.

---

#### Change Category Assignment

> **PATCH `/categories/{category_id}/change-assignment`**
> 
> **Permission required:** `OwnershipPermission.ManageCategories`

Lets user reassign assignment of category for different users or user groups.

The user has to have ownership of the *parent category*.

---

#### Change Category Parent

> **PATCH `/categories/{category_id}/change-parent`**
> 
> **Permission required:** `OwnershipPermission.ManageCategories`

Moves a category to a different parent in the hierarchy.

The user has to have ownership of the *current parent category*, as well as the *target parent category*.

---

#### Delete a Category

> **DELETE `/categories/{category_id}`**
> 
> **Permission required:** `OwnershipPermission.ManageCategories`

Permanently deletes a category.

The user has to have ownership of *this category* to perform this action.

Used to remove obsolete or mistakenly created categories.

---

### Categories Distributions

---

## Digitization Organization

- Digitization Lists
- Intentions

### Digitization List

#### Search Digitization Lists

> **POST `/digitization-lists/search`**

> **Permission required:** `GeneralPermission.ReadDigitizationLists`

A user with the `ReadDigitizationLists` permission can search for digitization lists. They can pass in a query object to filter lists based on indexed fields.

This is useful for displaying existing lists and create summaries based on lists.

---

#### Create a Digitization List

> **POST `/digitization-lists`**

> **Permission required:** `GeneralPermission.CreateDigitizationLists`

A user with the `CreateDigitizationLists` permission can create a new digitization list.

They provide an `IndexerQuery` that defines which documents to include. Optionally, they can:

* Attach intention IDs to the list (to associate it with specific digitization goals).
* They can specify digitization states inclusion to allow documents that are already in progress, completed, or otherwise excluded by default. Normally, only not digitized items are included.

The resulting list is authored by the authenticated user who initiated the creation.

---

#### Change Intentions for a List

> **PATCH `/digitization-lists/{id}/change-intentions`**

> **Permission required:** `GeneralPermission.ManageDigitizationLists`

A user with `ManageDigitizationLists` permission can update the list of intention IDs for an existing digitization list.

This allows revising the objectives or purposes linked to the list—e.g., changing which digitization project the list serves.

---

#### Add Documents to a List

> **PATCH `/digitization-lists/{id}/add-documents`**

> **Permission required:** `GeneralPermission.ManageDigitizationLists`

This allows a user with `ManageDigitizationLists` permission to add more documents to an existing list using a search query.

By default, only documents that have not yet been digitized are considered.
However, users can override this by explicitly specifying digitization states to include — for example, to allow documents that are already in progress or completed.

---

#### Remove Documents from a List

> **PATCH `/digitization-lists/{id}/remove-documents`**
>
> **Permission required:** `GeneralPermission.ManageDigitizationLists`

A user with `ManageDigitizationLists` permission can remove documents from a digitization list.

This operation uses a query to define which documents to remove, offering flexible bulk-editing capabilities.

---

#### Delete a Digitization List

> **DELETE `/digitization-lists/{id}`**
> 
> **Permission required:** `GeneralPermission.ManageDigitizationLists`

A user with `ManageDigitizationLists` permission can permanently delete a digitization list.

This is a destructive action that should be used when the list was created in error.

---

## Tasks