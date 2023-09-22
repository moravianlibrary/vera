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
};
