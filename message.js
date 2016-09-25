'use strict';

var PassThrough = require('stream').PassThrough;

var Message = function () {
  PassThrough.call(this);
  this.headers = {};
  this.parts = [];
}

Message.prototype = Object.create(PassThrough.prototype);

Message.prototype.part = function () {
  var part = new Message();
  if (this.parts.length > 0) {
    this.parts[this.parts.length - 1].end();
  }
  this.parts.push(part);
  this.emit('part', part);
  return part;
};

Message.prototype.trailer = function () {
  if (this.parts.length > 0) {
    this.parts[this.parts.length - 1].end();
  }
  this.emit('trailer', this);
  return this;
};

module.exports = Message;
