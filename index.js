const http = require('http');
require('dotenv').config();
const debug = require('debug')('app:server');
const app = require('./app');

const port = process.env.PORT ?? 4000;

const server = http.createServer(app);

server.listen(port, () => {
  debug(`API started on port ${port}`);
  debug(`API Docs here : http://pmangeot-server.eddi.cloud:80/api-docs/`);
  console.log(`API Docs here : http://pmangeot-server.eddi.cloud:80/api-docs/`);
});
