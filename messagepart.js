'use strict';

var Readable = require('stream').Readable;

var MessagePart = function (parser) {
  Readable.call(this, {
    read: function (size) {
      this.emit('read', size);
      parser.pull(size);
      parser.emit('drain');
    }
  });

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

module.exports = MessagePart;
