'use strict'

var MultiParser = require('multiparse');

var input = require('fs').createReadStream('examples/message.txt', {
  highWaterMark: 10
});
var parser = new MultiParser('boundary text');

parser.message.on('data', function () {});
parser.message.on('part', function (part) { console.log(part.headers); });

input.pipe(parser);
