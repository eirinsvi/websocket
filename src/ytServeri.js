const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8082})
wss.on("connection", ws => {
    console.log("new client connected");
    ws.on("close", () => {
        console.log("client has disconnected");
    });
    ws.on("message", data => {
        console.log('Data received from client: ', data.toString());
        ws.send(data);
    });
});