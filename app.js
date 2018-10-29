'use strict'
const express = require('express');
const app = express();
const port = 3000;
const controller = require('./controller');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.post('/getAll', (req, res) => controller.getAll(req, res));
app.post('/getAllPaginated', (req, res) => controller.getAllPaginated(req, res));
app.post('/filter', (req, res) => controller.filter(req, res));
app.post('/filters', (req, res) => controller.filters(req, res));

app.listen(port);