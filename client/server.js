const express = require("express");
const cors = require("cors"); // Import the cors middleware
const app = express();
const port = 8000;

// Use the cors middleware to enable CORS for all routes
app.use(cors());

// Define your routes and other server logic here

app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});

