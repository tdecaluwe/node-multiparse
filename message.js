'use strict'

var PassThrough = require('stream').PassThrough;

var Message = function () {
  PassThrough.call(this);
  this.headers = {};
  this.parts = [];
}

Message.prototype = Object.create(PassThrough.prototype);

Message.prototype.part = function () {
  var part = new Message();
  this.parts.push(part);
  this.emit('part', part);
  return part;
};

module.exports = Message;
