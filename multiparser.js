'use strict'

var Message = require('./message.js');

var ContentType = require('content-type');
var EventEmitter = require('events');

var HTTPParser = process.binding('http_parser').HTTPParser;

var MultiParser = function (boundary) {
  this.current = new Message();

  // Set up a path of arrays representing the parts of each of the ancestors of
  // the current message part. The first element is a root array containing the
  // root HTTP message as its only part.
  this.path = [];
  // And don't forget to keep track of the boundaries separating their parts.
  this.boundaries = [];

  // Initialize a parser for the root message.
  this.initialize();
  if (boundary) {
    this.multi(new Buffer('\r\n--' + boundary));
  }
  this.buffer = new Buffer('');
  // Skip the headers.
  this.parser.execute(new Buffer('\r\n\r\n'));

  this.output = this.current;
}

MultiParser.prototype = Object.create(EventEmitter.prototype);

var onHeaders = function (list) {
  var key;
  var content;

  for (var i = 0; i < list.length; i = i + 2) {
    key = list[i].toString().toLowerCase();
    this.multiparser.current.headers[key] = list[i + 1];
  }
};

var onHeadersComplete = function (major, minor, list) {
  var message = this.multiparser.current;
  var content, boundary, last;

  onHeaders.call(this, list);

  // Check whether a content-type header was received.
  if (message.headers['content-type']) {
    content = ContentType.parse(message.headers['content-type']);
    boundary = content.parameters.boundary;
    if (content.type.slice(0, 9) === 'multipart' && boundary) {
      // The CR and LF characters should be considered part of the boundary.
      this.multiparser.multi(new Buffer('\r\n--' + boundary));
    }
  }

  this.complete = true;
};

var onBody = function (chunk, start, length) {
  this.multiparser.current.write(chunk.slice(start, start + length));
};

/**
 * Initialize a new message parser.
 */
MultiParser.prototype.initialize = function () {
  // Reset the parser.
  this.parser = new HTTPParser(HTTPParser.RESPONSE);
  this.parser.multiparser = this;
  this.parser.complete = false;

  // Initialize the HTTP parser.
  this.parser[HTTPParser.kOnHeaders] = onHeaders;
  this.parser[HTTPParser.kOnHeadersComplete] = onHeadersComplete;
  this.parser[HTTPParser.kOnBody] = onBody;
  this.parser.execute(new Buffer('HTTP/1.1 200 OK'));
}

/**
 * Initialize a new multipart message. This method should be called when
 * encountering a multipart content type, as this requires the body to include
 * the closing boundary.
 */
MultiParser.prototype.multi = function (boundary) {
  // Add the parts array to the current path in the message tree.
  this.path.push(this.current);
  this.boundaries.push(boundary);
  this.boundary = boundary;
  this.emit('multi', this.current);
}

MultiParser.prototype.part = function () {
  this.current = this.path[this.path.length - 1].part();
}

MultiParser.prototype.trailer = function () {
  this.current = this.path[this.path.length - 1].trailer();
}

/**
 * Close the current multipart message. To be called when encountering the
 * closing multipart boundary.
 */
MultiParser.prototype.pop = function () {
  // The parser is currently in the body parsing state. This means we can
  // continue using this parser for parsing the body of the parent message.
  this.current = this.path.pop();
  this.boundaries.pop();
}

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
    this.emit('error', Error());
    consumed = result.bytesParsed;
  }

  return consumed;
}

var onBoundary = function (chunk, boundary, start) {
  var consumed = boundary.length;
  var a, b, c, d;

  var temp = start;

  if (this.parser.complete) {
    start += consumed;

    a = chunk[start + 0];
    b = chunk[start + 1];
    c = chunk[start + 2];
    d = chunk[start + 3];

    if (a === 13 && b === 10) {
      this.initialize();
      this.part();
    } else if (a === 45 && b === 45 && c === 13 && d === 10) {
      this.trailer();
      this.pop();
      consumed += 4;
    } else {
      start -= consumed;
      onData.call(this, chunk, start, start + consumed);
    }
  } else {
    onData.call(this, chunk, start, start + consumed);
  }

  return consumed;
};

/**
 * Write a chunk of data to the parser.
 */
MultiParser.prototype.write = function (chunk, encoding, callback) {
  chunk = new Buffer(chunk);

  // The index is a positional variable inside the buffer, while start
  // represents the number of bytes processed from the new chunk of data.
  var start = 0, index;

  // The center is a temporary buffer consisting of the concatenated relevant
  // parts of those chunks. The split buffer contains the current data at which
  // the parsing should be interrupted.
  var center, split;

  var found = false;

  var length, margin, head, tail;

  // Allow for four extra characters after the boundary (two dashes, a
  // carriage return and a line feed at most). Like this we can check the
  // presence of a boundary at once and we don't have to cycle the parser
  // through different states.
  margin = this.parser.complete ? 4 : 0;
  split = this.parser.complete ? this.boundary : new Buffer('\r\n\r\n');

  // The length of the context needed to check for a boundary occurence.
  length = split.length + margin - 1;
  head = Math.min(length, chunk.length);
  tail = head;

  // The starting position is negative if the lookbehind buffer is not empty.
  start -= this.buffer.length;

  center = Buffer.concat([this.buffer, chunk.slice(0, head)]);

  // Try to find a boundary starting before the beginning of the new chunk.
  index = center.indexOf(split);
  if (found = index >= 0 && index < center.length - length) {
    start += onData.call(this, this.buffer, 0, index);
    start += onBoundary.call(this, center, split, index);
  } else {
    start += onData.call(this, this.buffer, 0, center.length - length);
  }

  margin = this.parser.complete ? 4 : 0;
  split = this.parser.complete ? this.boundary : new Buffer('\r\n\r\n');

  length = split.length + margin - 1;
  tail = length;

  while (start < chunk.length - tail) {
    // Find the next boundary occurence.
    index = chunk.indexOf(split, start);
    if (found = index >= 0 && index < chunk.length - tail) {
      start += onData.call(this, chunk, start, index);
      start += onBoundary.call(this, chunk, split, index);
    } else {
      start += onData.call(this, chunk, start, chunk.length - tail);
    }

    margin = this.parser.complete ? 4 : 0;
    split = this.parser.complete ? this.boundary : new Buffer('\r\n\r\n');

    length = split.length + margin - 1;
    tail = length;
  }

  // Set a new lookbehind buffer, adding the data that wasn't parsed yet.
  center = Buffer.concat([this.buffer, chunk.slice(start)]);
  this.buffer = center.slice(center.length - chunk.length + start);
};

MultiParser.prototype.end = function (chunk, encoding, callback) {
  if (chunk) {
    this.write(chunk, encoding, callback);
  }

  this.current.end();

  if (this.path.length > 0) {
    this.emit('error', Error('Not all messages were closed'));
  }
}

module.exports = MultiParser;
