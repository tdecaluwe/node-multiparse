'use strict'

var expect = require('chai').expect;

var MultiParser = require('../multiparser.js');

describe('MultiParser', function () {
  var parser;
  beforeEach(function () {
    var boundary = 'boundary';
    parser = new MultiParser(boundary);
  });
  describe('while parsing a root preamble', function () {
    it('should keep a lookbehind buffer with the length of the boundary plus seven', function () {
      parser.write(new Buffer('some body text before the buffer contents'));
      expect('buffer contents').to.deep.equal(parser.buffer.toString());
    });
    it('should append writes if the buffer limit isn\'t reached', function () {
      parser.write(new Buffer('multi'));
      parser.write(new Buffer('part'));
      expect(parser.buffer.slice(-9).toString()).to.deep.equal('multipart');
  it('should accept non-multipart messages', function () {
    var event;
    parser.on('data', function (data) {
      console.log(data.toString());
    });
    parser.on('finish', function () {
      event = 'finish';
    });
    parser.write(new Buffer('header: value\r\n\r\nBody text'));
    parser.end();
    expect(event).to.equal('finish');
  });    });
  });
  it('should emit a part event after writing the boundary plus two bytes', function () {
    var event;
    parser.on('part', function () { event = 'part'; });
    parser.write(new Buffer('\r\n--boundary\r\nco'));
    expect(event).to.equal('part');
  });
  it('should start a new multipart message when completing a header with an appropriate content type', function () {
    var event;
    parser.on('multi', function () { event = 'multi'; });
    parser.write(new Buffer('--boundary\r\nContent-Type: multipart/report; boundary=text\r\n\r\nmore body text'));
    expect(event).to.equal('multi');
  });
  it('should be able to apply a new boundary while parsing the same chunk of data', function () {
    var count = 0;
    var text = '';
    text += '--boundary\r\n';
    text += 'content-type: multipart/mixed; boundary=text\r\n\r\n';
    text += '--text\r\nco';
    parser.part = function () {
      MultiParser.prototype.part.call(this);
      count++;
    };
    parser.write(new Buffer(text));
    expect(count).to.equal(2);
  });
  it('should close the last part when the multipart message is closed', function () {
    var event;
    parser.on('part', function (part) {
      part.on('finish', function () { event = 'finish'; });
    });
    parser.write(new Buffer('\r\n--boundary\r\n\r\n\r\n--boundary--\r\n'));
    expect(event).to.equal('finish');
  });
  it('should close a message part when another boundary is encountered', function () {
    var event;
    parser.on('part', function (part) {
      part.on('finish', function () { event = 'finish'; });
    });
    parser.write(new Buffer('\r\n--boundary\r\n\r\n\r\n--boundary\r\nheader: value\r\n'));
    expect(event).to.equal('finish');
  });
  it('should parse boundaries without a trailing CRLF as body text', function () {
    var output = '';
    parser.on('data', function (chunk) {
      output += chunk;
    });
    parser.write(new Buffer('\r\n--boundary body text'));
    expect(output.slice(0, 12)).to.equal('\r\n--boundary');
  });
});
