workspace "VERA interactions" {

    !identifiers hierarchical

    model {
        user = person "User"

        vera = softwareSystem "VERA" {
            client = container "VERA Client" {
                documentsView = component "Documents Client View"    
                addDocumentsView = component "Add Documents Client View"    
            }
        }

        user -> vera "uses"

        documentsView = element "Documents View" "VERA Client View"

        person "User - Read Documents" "User with permissions to read documents." {
            -> documentsView "Searches for documents"
            -> documentsView "Select documents"
            -> documentsView "Export documents"
        }

        person "User - Edit Documents" "User with permissions to edit documents." {
            -> documentsView "Change category of document(s)"
            -> documentsView "Change priority of document(s)"
            -> documentsView "Change page count of document(s)"
            -> documentsView "Delete document(s)"
        }

        person "User - Plan task" "User with permissions to plan tasks." {
            -> documentsView "Predicate page count of document(s)"
            -> documentsView "Reindex document(s)"
            -> documentsView "Synchronize document(s) with Aleph catalogs"
            -> documentsView "Synchronize document(s) with digitization registry"
        }
    }

    views {
        systemLandscape system {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape person
                background "#f4d03f"
                color "#000000"
            }

            element "VERA Client View" {
                shape roundedBox
                background "#aed6f1"
                color "#000000"
            }
        }
    }
}
