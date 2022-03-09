const { createHash } = require('crypto');
const http = require('http');
const client = require('./webclient');

const server = http.createServer(client.requestListener);
server.listen(3000);

const sockets = [];

server.on('upgrade', (req, socket) => {
    sockets.push(socket);
    // Read the websocket key provided by the client:
    const clientkey = req.headers['sec-websocket-key'];
    // Generate the response value to use in the response:
    const hash = createHash('sha1')
        .update(clientkey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

    const responseHeaders = [ 'HTTP/1.1 101 Web Socket Protocol Handshake', 'Upgrade: WebSocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${hash}` ];

    // Write the response back to the client socket
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

    //is run when client calls ws.send
    socket.on("data", (req, socket) => {
        let response = [];
        //if it is a message
        if(req[0] == parseInt("81", 16)){
            //masked if first bit is 1
            //length in bytes given by next seven bits
            let length = (req[1] & 127);
            let dataStart = 6;
            for(let i = dataStart; i < dataStart + length; i++){
                //rotate through the 4 masking bits
                let byte = req[i] ^ req[2 + ((i - dataStart) % 4)];
                response[i - dataStart] = (String.fromCharCode(byte));
            }
            //send pixel which was colored to all clients
            for(let i = 0; i < sockets.length; i++){
                try{
                    sockets[i].write(getReplyBuffer(response.join("")))
                } catch(error){
                    //error is thrown when we are unable to write to it, in that case just delete the socket at fault
                    sockets.splice(i, 1);
                    //since we are removing a socket we need to reduce the index in order to not skip any sockets
                    i--;
                }
            }
        }
    });
});

function getReplyBuffer(data) {
    //it is a text message
    let bytes = [0x81];
    bytes.push(data.length);
    for (let i = 0; i < data.length; i += 1) {
        bytes.push(data.charCodeAt(i));
    }
    return Buffer.from(bytes);
}