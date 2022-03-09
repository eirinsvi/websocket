const net = require('net');
const fs = require('fs');
const crypto = require("crypto");

const HTTPPORT  = 3000;
const WSPORT = 3001;

var clients = [];

const fileHTML = 'chat.html';

/**
 * Reads index.html file and writes it to client
 */
const httpServer = net.createServer((connection) => {
    connection.on('data', () => {
        try{
            fs.readFile(fileHTML, (err, data) => {
                if(err){
                    console.log("Error during reading");
                }
                connection.write('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ' + data.length + '\r\n\r\n' + data);

            });
        }catch(error){
            console.log("Couldn't open HTML file");
        }

    });
});

httpServer.listen(HTTPPORT, () => {
    console.log("HTTP server listening on port: " + HTTPPORT);
});

httpServer.on("error", (error) =>{
    console.log(error);
});

const wsServer = net.createServer((connection) => {
    console.log("Client connected");

    connection.on('data', (data) => {
        string = data.toString();
        // Checks to see if it trying to connect to the WS server
        if((/GET \/ HTTP\//i).test(string)){
            if(!checkHeaderFields(string)){
                connection.write("HTTP/1.1 400 Bad Request\r\n");
                console.log(string);
                connection.end();
            }
            // Reads key from  client's GET-request
            let key = string.match(/Sec-WebSocket-Key: (.+)?\s/i)[1].toString();
            // Creates acceptKey
            let acceptKey = createAcceptKey(key);

            // Writes answer with acceptKey to client
            connection.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n`+
                `Connection: Upgrade\r\nSec-WebSocket-Accept: ${acceptKey}\r\n\r\n`);
            // Adds client to an array of clients/sockets
            clients.push(connection);
        }
        else{
            //Checks opcode for connection closing
            if((data[0] & 0b1111) === 0x8) {
                connection.end();
                return;
            };
            // Client message
            let message = parseData(data);
            console.log(message);
            // Finds client index and creates a response
            let response = "";
            if((/chat/).test(fileHTML)){
                for(let i = 0; i < clients.length; i++){
                    if(clients[i] === connection){
                        response = `Client ${i+1}: ${message}`;
                    }
                }
            }
            else response = message;

            // Creates the answer with protocol
            let buf = createMessage(response);
            // Writes message to all open clients
            for(socket of clients){
                if(socket) socket.write(buf);
            }
        }
    });
    // Removes clients from array when they close connection
    connection.on('end', () => {
        for(let i = 0; i < clients.length; i++){
            if(clients[i] === connection){
                clients.splice(i);
            }
        }
        console.log("Client disconnected");
    });
});

wsServer.on("error", (error) => {
    console.log("Error: ", error);
});

wsServer.on("close", () => {

})

wsServer.listen(WSPORT, () => {
    console.log('Websocket server listening on port: ', WSPORT);
})

/**
 *
 * @param clientKey
 * @returns acceptKey
 */

function createAcceptKey(clientKey){
    acceptKey = clientKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    acceptKey = crypto.createHash("sha1").update(acceptKey,"binary").digest("base64");
    return acceptKey;
}

/**
 *
 * @param {*} text that is being converted
 * @returns a buffer with bytes
 */

function createMessage(text){
    // Byte length
    let textByteLength = Buffer.from(text).length;

    // datalength bits into a single byte
    let secondByte, buffer1;
    if(textByteLength < 126){
        secondByte = textByteLength;
        buffer1 = Buffer.from([0b10000001, secondByte]);
    }
    else if(textByteLength > 125 && textByteLength < 65535){
        secondByte = 126;
        buffer1 = Buffer.alloc(4);
        buffer1.writeUInt8(0b10000001,0)
        buffer1.writeUInt8(secondByte,1);
        buffer1.writeUInt16BE(textByteLength,2);
    }
    else {
        // should be : if(textByteLenth > 125 && textByteLength < max(64-bit integer))
        // secondByte = (1 << 7) | 127;
        // buffer1 = Buffer.alloc(10);
        // buffer1.writeUInt8(0b10000001,0)
        // buffer1.writeUInt8(secondByte,1);
        // Doesnt work...
        // buffer1.writeBigUInt64BE(textByteLength,2);
        throw Error("Message was too long");
    }

    const buffer2 = Buffer.from(text);

    // Concatenates all buffers into one
    const buffer = Buffer.concat([buffer1,buffer2]);
    return buffer;

}

/**
 * Parses masked data from client
 * @param data masked
 * @returns parsed data in a string
 */

function parseData(data){
    // Checks if the first bit in the second byte is a 1 or 0. Masked or not.
    let masked = data[1]>>7 === 1;
    let length, maskStart;

    // If byte length is less than 126 the data length is equal to the 7 least significant
    // bits of the second byte.
    length = data[1] & 0b1111111;

    // Two first bits are used for meta data.
    maskStart = 2;

    if(length === 126){
        // Creates a 16 bit number from two bytes
        length = ((data[2] << 8)| data[3]);

        // Two more bits are being used
        maskStart = 4;
    }
    else if(length === 127){
        length = data[2];
        // Creates a 64 bit number from 8 bytes.
        for(let i = 3; i<10;i++){
            length = (length << 8)|data[i];
        }

        maskStart = 10;
    }
    let result = "";
    if(masked){
        // Four bytes used for masking
        let dataStart = maskStart + 4;
        for(let i = dataStart; i< dataStart+length; i++){
            // XORs the payload with the mask bytes going circularly.
            let byte = data[i] ^ data[maskStart + ((i - dataStart) % 4)]
            result += String.fromCharCode(byte);
        }
    }else{
        // No mask bytes, and no masking.
        for(let i = maskStart; i<maskStart+length; i++){
            result += String.fromCharCode(data[i]);
        }
    }

    return result;

}

/**
 * Checks that alle necessary headerfields was sent by client
 * @param headers from HTTP-GET request
 * @returns boolean
 */

function checkHeaderFields(headers){
    let connectionReg = /Connection:.+Upgrade.*?\s/i
    let hostReg = /Host:/i
    let upgradeReg = /Upgrade:.+websocket.*?\s/i
    let keyReg = /Sec-WebSocket-Key:/i
    let versionReg = /Sec-WebSocket-Version: 13\s/i
    if(connectionReg.test(headers) && hostReg.test(headers) && upgradeReg.test(headers) && keyReg.test(headers) && versionReg.test(headers))
        return true;

    return false;
}