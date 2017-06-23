'use strict';

var Readable = require('stream').Readable;

var MessagePart = function (parser) {
  var that = this;

  Readable.call(this, {
    highWaterMark: 10,
    read: function (size) {
      console.log('read from', that.headers);
      that.emit('read', size);
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

MessagePart.prototype.ignore = function () {
  this.resume();
  this.on('part', function (part) {
    part.ignore();
  });

  return this;
};

MessagePart.prototype.ignore = function () {
  this.resume();
  this.on('part', function (part) {
    part.ignore();
  });
};

module.exports = MessagePart;
