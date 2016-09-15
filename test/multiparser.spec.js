'use strict'

var chai = require('chai');
var sinon = require('sinon');

chai.use(require('sinon-chai'));

var expect = chai.expect;

var MultiParser = require('../multiparser.js');

describe('The MultiParser caching mechanism', function () {
  var parser, output;
  beforeEach(function () {
    var boundary = 'boundary';
    output = '';
    parser = new MultiParser(boundary);
    parser.on('data', function (data) {
      output += data.toString();
    });
  });
  it('should contain a newline in it\'s initial state', function () {
    expect(parser.state).to.equal(MultiParser.states.start);
    expect(parser.buffer.toString()).to.equal('\r\n');
    expect(output).to.equal('');
  });
  it('should contain a newline after writing an empty string', function () {
    parser.write('');
    expect(parser.state).to.equal(MultiParser.states.start);
    expect(parser.buffer.toString()).to.equal('\r\n');
    expect(output).to.equal('');
  });
  it('should append writes if the maximum cache length isn\'t reached', function () {
    parser.write(new Buffer('multi'));
    parser.write(new Buffer('part'));
    expect(parser.state).to.equal(MultiParser.states.start);
    expect(parser.buffer.toString()).to.equal('\r\nmultipart');
    expect(output).to.equal('');
  });
  describe('when no boundary is encountered', function () {
    it('should only keep a buffer with the length of the boundary plus seven', function () {
      parser.write(new Buffer('some body text before the buffer contents'));
      expect(parser.state).to.equal(MultiParser.states.body);
      expect(parser.buffer.toString()).to.equal('buffer contents');
      expect(output).to.equal('some body text before the ');
    });
  });
  describe('after encountering a boundary', function () {
    beforeEach(function () {
      parser.write('Body header\r\n--boundary\r\n');
    });
    it('should not process the boundary yet if no more than one additional byte is written', function () {
      expect(parser.state).to.equal(MultiParser.states.body);
      expect(parser.buffer.toString()).to.equal('r\r\n--boundary\r\n');
      expect(output).to.equal('Body heade');
      parser.write('h');
      expect(parser.state).to.equal(MultiParser.states.body);
      expect(parser.buffer.toString()).to.equal('\r\n--boundary\r\nh');
      expect(output).to.equal('Body header');
    });
    it('should process the boundary when at least two additional bytes are written', function () {
      parser.write('he');
      expect(parser.state).to.equal(MultiParser.states.headers);
      // The last line feed is still in the cache because the string search
      // algorithm didn't confirm yet if it starts a double CRLF sequence or
      // not. This could be the case if the header was empty.
      expect(parser.buffer.toString()).to.equal('\nhe');
      expect(output).to.equal('Body header');
    });
  });
});

describe('The MultiParser boundary processor', function () {
  var parser, output;
  var path, current;
  var parts;
  beforeEach(function () {
    var boundary = 'boundary';
    parser = new MultiParser(boundary);
    path = [parser];
    parts = [];
    var onPart = function (part) {
      current = part;
      output = '';
      current.on('data', function (data) {
        output += data.toString();
      });
      current.on('multi', function () {
        path.push(current);
      });
      current.on('part', function (part) {
        parts.push(part);
        onPart(part);
      });
      current.on('trailer', function (message) {
        path.pop();
        current = message;
      });
    }
    onPart(parser);
  });
  describe('in the start state', function () {
    beforeEach(function () {
      // Check the initial state.
      expect(parts.length).to.equal(0);
      expect(parser.margin).to.equal(15);
      expect(parser.state).to.equal(MultiParser.states.start);
    });
    it('should start a new part when encountering a boundary', function () {
      // The boundary excluding the trailing newline should be consumed.
      expect(parser.process(new Buffer('\r\n--boundary\r\nhe'), 0)).to.equal(12);
      // An additional part should have been produced.
      expect(parts.length).to.equal(1);
      expect(parser.margin).to.equal(3);
      expect(parser.state).to.equal(MultiParser.states.headers);
    });
    it('should transition to the body state if the data length equals the margin', function () {
      expect(parser.process(new Buffer('\r\nfourteen chars'), 0)).to.equal(2);
      expect(output).to.equal('');
      expect(parser.state).to.equal(MultiParser.states.body);
    });
    it('should skip the first two bytes when parsing a preamble', function () {
      expect(parser.process(new Buffer('\r\npreamble contents'), 0)).to.equal(4);
      expect(output).to.equal('pr');
      expect(parser.state).to.equal(MultiParser.states.body);
    });
  });
});
