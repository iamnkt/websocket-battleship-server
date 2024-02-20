import { httpServer } from "./src/http_server/index";
import { mouse } from "@nut-tree/nut-js";
import { connectionHandler } from "./src/websocket_server";
import { WebSocketServer } from 'ws';

const HTTP_PORT = 8181;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({ port: 3000, clientTracking: true });
console.log(`Start websocket server at ws://localhost:${wss.options.port}!`);
wss.on('connection', connectionHandler);
  