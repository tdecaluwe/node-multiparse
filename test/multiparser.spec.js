'use strict'

var chai = require('chai');
var sinon = require('sinon');

chai.use(require('sinon-chai'));

var expect = chai.expect;

var MultiParser = require('../multiparser.js');

describe('The MultiParser constructor', function () {
  it('requires a boundary to be provided', function () {
    expect(function () {
      new MultiParser();
    }).to.throw(Error);
  });
});

describe('The MultiParser caching mechanism', function () {
  var parser, mock;
  beforeEach(function () {
    var boundary = 'boundary';
    var count = 0;
    parser = new MultiParser(boundary);
    mock = sinon.mock(parser).expects('process');
  });
  it('should contain a newline in it\'s initial state', function () {
    expect(mock).to.not.have.been.called;
    expect(parser.buffer.toString()).to.equal('\r\n');
  });
  it('should contain a newline after writing an empty string', function () {
    parser.write('');
    expect(mock).to.not.have.been.called;
    expect(parser.buffer.toString()).to.equal('\r\n');
  });
  it('should append writes if the maximum cache length isn\'t reached', function () {
    parser.write(new Buffer(5));
    parser.write(new Buffer(4));
    expect(mock).to.not.have.been.called;
    expect(parser.buffer.length).to.equal(11);
  });
  it('allows processing data inside the cache margin', function() {
    mock.returns(98);
    parser.buffer = new Buffer('');
    parser.write(new Buffer(100));
    expect(mock).to.have.been.called;
    expect(parser.buffer.length).to.equal(2);
  });
  it('should process the cache when the total data length exceeds the margin', function() {
    mock.returns(7);
    parser.buffer = new Buffer(10);
    parser.write(new Buffer(10));
    expect(mock).to.have.been.called;
    expect(parser.buffer.length).to.equal(13);
  });
});

describe('The MultiParser boundary processor', function () {
  var parser;
  var part, trailer, pop;
  beforeEach(function () {
    var boundary = 'boundary';
    parser = new MultiParser(boundary);
    part = sinon.mock(parser).expects('part');
    trailer = sinon.mock(parser).expects('trailer');
    pop = sinon.mock(parser).expects('pop');
  });
  describe('in the start state parsing a preamble', function () {
    var output = '';
    beforeEach(function () {
      // Check the initial state.
      expect(parser.margin).to.equal(15);
      expect(parser.state).to.equal(MultiParser.states.start);
      parser.on('data', function (data) {
        output += data.toString();
      });
    });
    it('should transition to the body state if the data length equals the margin', function () {
      expect(parser.process(new Buffer('\r\nfourteen chars'), 0)).to.equal(2);
      expect(output).to.equal('');
      expect(parser.state).to.equal(MultiParser.states.body);
    });
    it('should skip the first two bytes when parsing a preamble', function () {
      parser.process(new Buffer('\r\npreamble contents'), 0);
      expect(output).to.equal('pr');
      expect(parser.state).to.equal(MultiParser.states.body);
    });
  });
  describe('in the body state', function () {
    beforeEach(function () {
      parser.state = MultiParser.states.body;
      // Check the initial state.
      expect(parser.margin).to.equal(15);
      expect(parser.state).to.equal(MultiParser.states.body);
    });
    it('should start a new part when encountering a boundary', function () {
      // The boundary excluding the trailing newline should be consumed.
      expect(parser.process(new Buffer('\r\n--boundary\r\nhe'), 0)).to.equal(12);
      // An additional part should have been produced.
      expect(part).to.have.been.called;
    });
    it('should return when encountering a boundary without a trailing CRLF', function () {
      // The boundary excluding the trailing newline should be consumed.
      expect(parser.process(new Buffer('\r\n--boundary----'), 0)).to.equal(12);
      // An additional part should have been produced.
      expect(part).to.not.have.been.called;
      expect(trailer).to.not.have.been.called;
      expect(pop).to.not.have.been.called;
    });
    it('should start a trailer when encountering a closing boundary', function () {
      // The boundary including dashes and trailing newline should be consumed.
      expect(parser.process(new Buffer('\r\n--boundary--\r\n'), 0)).to.equal(16);
      // An additional part should have been produced.
      expect(trailer).to.have.been.called;
      expect(pop).to.have.been.called;
    });
  });
  describe('in the header state', function () {
    var part;
    beforeEach(function () {
      parser.on('part', function (message) {
        part = message;
      });
      MultiParser.prototype.initialize.call(parser);
      MultiParser.prototype.part.call(parser);
      // Check the initial state.
      expect(parser.margin).to.equal(3);
      expect(parser.state).to.equal(MultiParser.states.headers);
    });
    it('should add headers to the Message object', function () {
      parser.write(new Buffer('header: value\r\nanother: '));
      parser.write(new Buffer('another value\r\n\r\n'));
      expect(part.headers.header).to.equal('value');
    });
    it('should throw if it stays in the headers state when the headers are complete', function () {
      // Force the underlying HTTP parser in the body state.
      parser.process(new Buffer('\r\n\r\n'));
      // And then force the MultiParser back in the headers state.
      parser.state = MultiParser.states.headers;
      parser.margin = 3;
      expect(function () {
        parser.process(new Buffer('\r\n\r\n'), 0);
      }).to.throw(Error);
    });
    it('should throw when encountering a malformed header', function () {
      expect(function () {
        parser.process(new Buffer('\r\nheader\r\n\r\n'));
      }).to.throw(Error);
    });
  });
});
