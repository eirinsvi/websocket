module.exports.requestListener = function (req, res) {

    res.setHeader("Content-Type", "text/html");
    let content = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />    
        <style>
        
        canvas {
            background: lightgrey;
            width: 664px;
            height: 664px;
        }
        </style>
    </head>
  <body>
    WebSocket Client
    <br>
    <canvas width="664px" height="600px" id="canvas"></canvas>
    <script>
        let ws = new WebSocket('ws://localhost:3000');
        ws.onmessage = (event) => {
            let positions = event.data.toString().split(",");
            colorCanvas(positions[0], positions[1]);
        };
        
        let canvas = document.getElementById("canvas");
        let ctx = canvas.getContext("2d");
        canvas.addEventListener("mousedown", function(e){
            canvas.onmousemove = function(e) {
                mouseMoveFunction(e);
            }
        });
        canvas.addEventListener("mouseup", function(e){
            canvas.onmousemove = null
        });
        
        function mouseMoveFunction(e){
            let pos = getMousePos(canvas, e); 
            let str = pos.x + "," + pos.y;
            ws.send(str);
        }
        function getMousePos(canvas, evt) {
            let rect = canvas.getBoundingClientRect();
            return {
              x: evt.clientX - rect.left,
              y: evt.clientY - rect.top
            };
        }
        function colorCanvas(x, y){
            ctx.fillRect(x, y, 2, 2);
        }
    </script>
  </body>
</html>
`;
    res.writeHead(200);
    res.end(content);
};