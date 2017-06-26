'use strict'

var MessagePart = require('./messagepart.js');

var ContentType = require('content-type');
var EventEmitter = require('events');

var HTTPParser = process.binding('http_parser').HTTPParser;

var singleNewline = new Buffer('\r\n');
var doubleNewline = new Buffer('\r\n\r\n');

var MultiParser = function (boundary, options) {
  var that = this;

  this.drain = function (size) {
    //console.log('listening with state ' + that.parser.result);
    if (this === that.current && !that.parser.result) {
      that.emit('drain');
    }
  }

  this.initialize = function () {
    MultiParser.prototype.initialize.call(this, options);
  };

  // Set up a path of arrays representing the parts of each of the ancestors of
  // the current message part. The first element is a root array containing the
  // root HTTP message as its only part.
  this.path = [];
  // And don't forget to keep track of the boundaries separating their parts.
  this.boundaries = [];
  // Initialize a parser for the root message.
  this.initialize();

  if (boundary) {
    // Skip the headers.
    this.parser.execute(doubleNewline);
    this.state = MultiParser.states.start;
    this.buffer = Buffer.from(singleNewline);
    this.multi(Buffer.from('\r\n--' + boundary));

    // Allow for four extra characters after the boundary (two dashes, a
    // carriage return and a line feed at most). Like this we can check the
    // presence of a boundary at once and we don't have to cycle the parser
    // through different states.
    this.margin = this.boundary.length + 3;
  } else {
    throw Error('A boundary should be supplied to the multiparser.');
  }
};

MultiParser.prototype = Object.create(EventEmitter.prototype);

var onHeaders = function (list) {
  var key;

  for (var i = 0; i < list.length; i = i + 2) {
    key = list[i].toString().toLowerCase();
    this.multiparser.current.headers[key] = list[i + 1];
  }
};

var onHeadersComplete = function (major, minor, list) {
  var message = this.multiparser.current;
  var parent = this.multiparser.path[this.multiparser.path.length - 1];
  var header = message.headers['content-type'];
  var content, boundary;

  onHeaders.call(this, list);

  // Check whether a content-type header was received.
  if (header) {
    content = ContentType.parse(header);
    boundary = content.parameters.boundary;
    if (content.type.slice(0, 10) === 'multipart/' && boundary) {
      // The CR and LF characters should be considered part of the boundary.
      this.multiparser.multi(new Buffer('\r\n--' + boundary));
    }
  }

  // Transition the MultiParser to the start state.
  this.multiparser.state = MultiParser.states.start;
  // Let the parent message know that we found another part.
  parent.parts.push(message);
  parent.emit('part', message);
};

var onBody = function (chunk, start, length) {
  var message = this.multiparser.current;

  this.result = message.push(chunk.slice(start, start + length));
};

/**
 * Put the current message stream in flowing mode.
 */
MultiParser.prototype.flow = function () {
  this.current.resume();
};

/**
 * Initialize a new message parser.
 */
MultiParser.prototype.initialize = function (options) {
  // Reset the parser.
  this.parser = new HTTPParser(HTTPParser.RESPONSE);
  this.parser.multiparser = this;
  this.parser.result = true;
  this.parser.execute(new Buffer('HTTP/1.1 200 OK'));

  this.current = new MessagePart(options);
  this.current.on('read', this.drain);

  // Set up the body callbacks.
  this.parser[HTTPParser.kOnBody] = onBody;
};

MultiParser.prototype.part = function () {
  this.current.removeListener('read', this.drain);
  if (this.current !== this.path[this.path.length - 1]) {
    this.current.push(null);
  }

  this.initialize();

  // Set up the header callbacks.
  this.parser[HTTPParser.kOnHeaders] = onHeaders;
  this.parser[HTTPParser.kOnHeadersComplete] = onHeadersComplete;

  // Put the Parser in the headers state.
  this.state = MultiParser.states.headers;
  // Only three bytes of context are needed to find the end of the
  // headers in the next body part.
  this.margin = 3;
};

/**
 * Initialize a new multipart message. This method should be called when
 * encountering a multipart content type, as this requires the body to include
 * the closing boundary.
 */
MultiParser.prototype.multi = function (boundary) {
  this.path.push(this.current);
  this.boundaries.push(boundary);
  this.boundary = boundary;
  this.current.emit('multi');

  // Allow for four extra characters after the boundary (two dashes, a
  // carriage return and a line feed at most). Like this we can check the
  // presence of a boundary at once and we don't have to cycle the parser
  // through different states.
  this.margin = this.boundary.length + 3;
};

/**
 * Close the current multipart message. To be called when encountering the
 * closing multipart boundary.
 */
MultiParser.prototype.pop = function () {
  // The parser is currently in the body parsing state. This means we can
  // continue using this parser for parsing the body of the parent message.

  // Set the parent message as the current message.
  this.current.removeListener('read', this.drain);
  this.current = this.path.pop();
  this.current.on('read', this.drain);

  this.boundaries.pop();

  this.margin = this.boundary.length + 3;
};

MultiParser.prototype.trailer = function () {
  this.current = this.path[this.path.length - 1].trailer();
};

var onData = function (chunk, start, end) {
  var data = chunk.slice(start, end);
  var result, consumed;
  var error = '';

  if (data.length > 0) {
    result = this.parser.execute(data);
  } else {
    result = 0;
  }

  if (typeof result === 'number') {
    consumed = result;
  } else {
    error += result.toString() + ': ' + result.code;
    error += ' after ' + result.bytesParsed + ' bytes';
    this.emit('error', Error(error));
    consumed = result.bytesParsed;
  }

  return consumed;
};

/**
 * The process function contains the inner loop of the parsing infrastructure.
 * It consumes any data which can be guaranteed not to contain a boundary and
 * processes the next boundary if one can be found. This method should generally
 * not be called externally. When the length of the chunk of data provided is
 * shorter than the current parser margin, the behaviour is undefined. The write
 * function guarantees this is never the case.
 */
MultiParser.prototype.process = function (data, start) {
  // The index is a positional variable inside the buffer, while start
  // represents the number of bytes processed from the new chunk of data.
  var index, stop;

  var offset = 0;

  switch (this.state) {
  case MultiParser.states.start:
    this.state = MultiParser.states.body;
    offset = 2;
    // Continue processing the data in the next case.
  case MultiParser.states.body:
    // Find the next boundary occurence.
    index = data.indexOf(this.boundary, start);
    if (index >= 0 && index < data.length - this.margin) {
      var a, b, c, d;

      stop = index;
      index += this.boundary.length;

      a = data[index + 0];
      b = data[index + 1];
      c = data[index + 2];
      d = data[index + 3];

      if (a === 13 && b === 10) {
        start += onData.call(this, data, start + offset, stop);
        // Initialize a parser to accept a new body part.
        this.part();
        // Advance the position in the current data chunk.
        start += this.boundary.length;
      } else if (a === 45 && b === 45 && c === 13 && d === 10) {
        start += onData.call(this, data, start + offset, stop);
        // Warn the multipart message about an upcoming trailer.
        this.trailer();
        // End the current message part.
        this.pop();
        // Advance the position in the current data chunk.
        start += this.boundary.length + 4 + offset;
      } else {
        start += onData.call(this, data, start + offset, index) + offset;
      }
    } else {
      start += onData.call(this, data, start + offset, data.length - this.margin) + offset;
    }
    break;
  case MultiParser.states.headers:
    // Find the next boundary occurence.
    index = data.indexOf(doubleNewline, start);
    if (index >= 0 && index < data.length - this.margin) {
      start += onData.call(this, data, start, index + 4) - 2;
      if (this.state !== MultiParser.states.start) {
        throw new Error('Failed to transition into headers state to parse a new body part');
      }
      this.margin = this.boundary.length + 3;
    } else {
      start += onData.call(this, data, start, data.length - this.margin);
    }
  }

  return start;
};

/**
 * Write a chunk of data to the parser.
 */
MultiParser.prototype.write = function (chunk, encoding, callback) {
  if (encoding instanceof Function) {
    callback = encoding;
    encoding = undefined;
  }

  if (!(chunk instanceof Buffer || chunk instanceof Uint8Array)) {
    chunk = Buffer.from(chunk, encoding);
  }

  // The index is a positional variable inside the buffer, while start
  // represents the number of bytes processed from the new chunk of data.
  var start = 0, shift;

  // The center is a temporary buffer to work with boundaries split over
  // multiple chunks of data.
  var center;

  center = Buffer.concat([this.buffer, chunk.slice(0, this.margin)]);

  // The starting position is negative if the lookbehind buffer is not empty.
  shift = this.buffer.length;
  start = 0;

  while (start < center.length - this.margin) {
    start = this.process(center, start);
  }

  start -= shift;

  while (start < chunk.length - this.margin) {
    start = this.process(chunk, start);
  }

  // Set a new lookbehind buffer, adding the data that wasn't parsed yet.
  center = Buffer.concat([this.buffer, chunk.slice(Math.max(0, start))]);
  this.buffer = center.slice(center.length - chunk.length + start);

  if (callback instanceof Function) {
    callback();
  }

  return this.parser.result;
};

MultiParser.prototype.end = function (chunk, encoding, callback) {
  if (chunk) {
    this.write(chunk, encoding, callback);
  }

  if (this.path.length > 0) {
    this.emit('error', Error('Not all messages were closed'));
  } else {
    this.current.push(null);
  }
};

MultiParser.states = {
  headers: 0,
  start: 1,
  body: 2
};

module.exports = MultiParser;
