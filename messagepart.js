'use strict';

var PassThrough = require('stream').PassThrough;

var MessagePart = function () {
  PassThrough.call(this);
  this.headers = {};
  this.parts = [];
}

MessagePart.prototype = Object.create(PassThrough.prototype);

MessagePart.prototype.part = function (part) {
  part = part || new MessagePart();

  if (this.parts.length > 0) {
    this.parts[this.parts.length - 1].end();
  }
  this.parts.push(part);
  this.emit('part', part);
  return part;
};

MessagePart.prototype.trailer = function () {
  if (this.parts.length > 0) {
    this.parts[this.parts.length - 1].end();
  }
  this.emit('trailer', this);
  return this;
};

module.exports = MessagePart;
