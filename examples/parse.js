'use strict'

var MultiParser = require('multiparse');

var input = require('fs').createReadStream('examples/message.txt', {
  highWaterMark: 8
});
var parser = new MultiParser('boundary text', {
  highWaterMark: 8
});

parser.current.resume();

var count = 0;

parser.current.on('part', function (part) {
  part.on('data', function (data) {
    count++;
    var that = this;
    process.stdout.write(data.toString());

    if (Math.random() < 0.2) {
      this.pause();
      setTimeout(function () {
        that.resume();
      }, 100 + Math.random()*100);
    }
  });
}).on('end', function () {
  console.log('count ', count);
});

input.pipe(parser);
