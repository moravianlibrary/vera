workspace "VERA" {

    !identifiers hierarchical

    model {
        user = person "User"

        vera = softwareSystem "VERA" {
            client = container "React Client" {
                documents = component "Documents Component"
                addDocuments = component "Add Documents Component"    
            }
            app = container "Application"
            broker = container "Redis Broker"
            worker = container "Celery Worker"
            index = container "Elasticsearch Index"
            db = container "PostgreSQL Database"
        }

        user -> vera ""

        vera.client -> vera.app "make API calls to"
        vera.app -> vera.index "reads/writes to"
        vera.app -> vera.db "reads/writes to"
        vera.app -> vera.broker "sends messages to"

        vera.worker -> vera.index "reads/writes to"
        vera.worker -> vera.db "reads/writes to"
        vera.worker -> vera.broker "sends messages to"

        vera.broker -> vera.worker "deliver messages to"
        vera.broker -> vera.app "deliver messages to"
    }

    views {
        properties {
            "mermaid.url" "https://mermaid.ink"
            "mermaid.format" "svg"
        }
        
        systemLandscape system {
            include user
            include vera
            autoLayout lr
        }

        container vera {
            include vera.client
            include vera.app
            include vera.broker
            include vera.worker
            include vera.index
            include vera.db
            autoLayout lr
        }

        component vera.client {
            include vera.client.documents
            include vera.client.addDocuments
            autoLayout lr
        }

        image vera.client.documents {
            mermaid https://docs.structurizr.com/dsl/cookbook/image-view/component1.mmd
            title "Class diagram for Component1"
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
