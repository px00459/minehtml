const express = require('express');
const path = require('path');

const app = express();
const PORT = 8000;

// Serve static files from public and src directories
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

app.listen(PORT, () => {
    console.log(`Voxel Sandbox server running at http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop');
});
