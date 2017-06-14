var http = require('http');

var ContentDisposition = require('content-disposition')

var MultiParser = require('../index');

http.createServer(function(req, res) {
  // process the file upload
  if (req.url === '/upload' && req.method === 'POST') {
    var parser = MultiParser.create(req);
    var disposition;

    res.writeHead(200, {'content-type': 'text/plain'});

    parser.message.on('part', function (part) {
      process.nextTick(function () {
        if (part.headers['content-disposition']) {
          res.write('-- Received a part');
          disposition = ContentDisposition.parse(part.headers['content-disposition']);
          if (disposition.parameters['name']) {
            res.write(' with name ' + disposition.parameters['name'] + ' and contents:\n');
          }
          if (disposition.parameters['filename']) {
            res.write('received attachment with name ' + disposition.parameters['filename'] + ':\n');
          }
          part.pipe(res, { end: false });
        }
      });
    });

    setTimeout(function () { res.end(); }, 500);

    req.pipe(parser);
  } else {
    // show a file upload form
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(
      '<form action="/upload" enctype="multipart/form-data" method="post">'+
      '<input type="text" name="title"><br>'+
      '<input type="file" name="upload" multiple="multiple"><br>'+
      '<input type="submit" value="Upload">'+
      '</form>'
    );
  }
}).listen(3000);
