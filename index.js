const http = require('http');
require('dotenv').config();
const debug = require('debug')('http');
const app = require('./app');

const port = process.env.PORT ?? 4000;

const server = http.createServer(app);

server.listen(port, () => {
  debug(`API started on port ${port}`);
  console.log(`API Docs here : http://localhost:${port}/api-docs/`);
});
