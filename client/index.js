function loadSubpage(subpageId) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = ''; // Clear the current content
    
    // Load the subpage using fetch (assuming subpages are in the same directory)
    fetch(subpageId + '.html')
        .then(response => response.text())
        .then(data => {
            contentDiv.innerHTML = data;
        })
        .catch(error => {
            console.error('Error loading subpage', subpageId, ':', error);
        });
}

// Add click event listeners to navbar links
const navbarLinks = document.querySelectorAll('nav ul li a');
navbarLinks.forEach(link => {
    link.addEventListener('click', event => {
        event.preventDefault();
        const targetSubpageId = link.getAttribute('href').substring(1); // Remove the "#" character
        loadSubpage(targetSubpageId);
        switch (targetSubpageId) {
            case 'board':
                initBoard();
                break;
            default:
                contentDiv.innerHTML = '<h1>Page Not Found</h1><p>Sorry, the requested page does not exist.</p>';
        }
    });
});