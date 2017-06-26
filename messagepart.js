'use strict';

var Readable = require('stream').Readable;

/**
 * Construct a new multipart message part.
 *
 * @constructs MessagePart
 * @param {Object} options - Options for the underlying Readable stream.
 */
var MessagePart = function (options) {
  var that = this;

  options = options || {};
  options.read = function (size) {
    that.emit('read', size);
  };

  Readable.call(this, options);

  this.headers = {};
  this.parts = [];
};

MessagePart.prototype = Object.create(Readable.prototype);

function closePrevious() {
  if (this.parts.length > 0) {
    this.parts[this.parts.length - 1].push(null);
  }
}

MessagePart.prototype.part = function (part) {
  part = part || new MessagePart(this.source);

  closePrevious.call(this);

  this.parts.push(part);
  this.emit('part', part);
  return part;
};

MessagePart.prototype.trailer = function () {
  closePrevious.call(this);

  this.emit('trailer', this);
  return this;
};

/**
 * Ignore this message and all of it's parts.
 */
MessagePart.prototype.ignore = function () {
  this.resume();
  this.on('part', function (part) {
    part.ignore();
  });

  return this;
};

module.exports = MessagePart;
