'use strict'

var ContentType = require('content-type');

var MultiParser = require('./multiparser.js');

MultiParser.create = function (message) {
  var content;

  if (message.headers && message.headers['content-type']) {
    content = ContentType.parse(message.headers['content-type']);
    if (content.type.slice(0, 9) === 'multipart') {
      return new MultiParser(content.parameters.boundary);
    } else {
      throw Error('This is not a multipart message');
    }
  } else {
    throw Error('This message does not have a content-type header');
  }
}

module.exports = MultiParser;
