const dataEntryDialog = document.getElementById('dataEntryDialog');
const dataEntryForm = document.getElementById('dataEntryForm');

function populateTable() {
    // Fetch data from the server (replace with your API endpoint)
    fetch("http://localhost:8000/records")
    // fetch("/records")
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector("#boardTable tbody");

            // Loop through the data and populate the table
            data.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${item.sysno}</td>
                    <td>${item.volume_number || ''}</td>
                    <td>${item.item_number || ''}</td>
                    <td>${item.category}</td>
                    <td>${item.title}</td>
                    <td>${item.pages_count}</td>
                    <td>${item.signature || ''}</td>
                    <td>${item.issn || ''}</td>
                    <td>${item.isbn || ''}</td>
                    <td>${item.barcode || ''}</td>
                    <td>${item.creator}</td>
                    <td>${item.created_at}</td>
                    <td>${item.extractor || ''}</td>
                    <td>${item.extracted_at || ''}</td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error("Error fetching data:", error);
        });
}

function initBoard() {
    populateTable();

    // Function to open the dialog
    document.getElementById('insertDocButton').addEventListener('click', () => {
        dataEntryDialog.showModal();
    });

    // Function to close the dialog
    document.getElementById('cancelButton').addEventListener('click', () => {
        dataEntryDialog.close();
    });

    // Function to handle form submission
    dataEntryForm.addEventListener('submit', (event) => {
        event.preventDefault();

        // Collect form data
        const formData = new FormData(dataEntryForm);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        // Make an API call (replace with your actual API endpoint and method)
        fetch('https://your-api-endpoint.com', {
            method: 'POST', // Use the appropriate HTTP method
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data), // Convert data to JSON
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('API request failed');
            }
            return response.json();
        })
        .then((responseData) => {
            // Handle the API response as needed
            console.log('API response:', responseData);
            // Close the dialog after a successful API call
            dataEntryDialog.close();
        })
        .catch((error) => {
            console.error('API error:', error);
            // Handle errors or display a message to the user
        });
    });
};
