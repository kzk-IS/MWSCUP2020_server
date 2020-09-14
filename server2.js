var http = require('http');
var html = require('fs').readFileSync('index.html');
 
http.createServer(function(req, res) {
 
  if(req.method === 'GET') {
    res.writeHead(200, {'Content-Type' : 'text/html'});
    res.end(html);
  }else if(req.method === 'POST') { // POST受信処理
     console.log("rcv POST request");
     var data = '';
    
   //POSTデータを受けとる
   req.on('data', function(chunk) {data += chunk})
      .on('end', function() {

         console.log(data);
         res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.end("chinenyuuichiro");
        //res.setAttribute('result', '12');
 
      })
  }
 
}).listen(4000);
