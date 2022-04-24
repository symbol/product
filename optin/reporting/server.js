require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 5001;

app.use(express.json());

// eslint-disable-next-line no-console
app.listen(port, () => console.log(`Listening on port ${port}`));

// Serve all static files from the dist folder
app.use(express.static(path.join(__dirname, './client/build')));

// GET route
app.use('/api', require('./routers/api'));

// Serve any other file as the distribution index.html
app.get('*', (request, response) => {
	response.sendFile(path.join(__dirname, './client/build/index.html'));
});

module.exports = app;
