'use strict';

var MessagePart = require('./messagepart.js');

var ContentType = require('content-type');
var EventEmitter = require('events');

var MessageTree = function (boundary) {
  EventEmitter.call(this);
  // Set up a path of arrays representing the parts of each of the ancestors of
  // the current message part. The first element is a root array containing the
  // root HTTP message as its only part.
  this.path = [];
  // And don't forget to keep track of the boundaries separating their parts.
  this.boundaries = [];
};

MessageTree.prototype = Object.create(EventEmitter.prototype);

MessageTree.prototype.pull = function (size) {
  this.emit('drain');
};

MessageTree.prototype.headers = function () {
  // Let the parent message know that we found another part.
  this.path[this.path.length - 1].part(this.current);
};

/**
 * Initialize a new multipart message. This method should be called when
 * encountering a multipart content type, as this requires the body to include
 * the closing boundary.
 */
MessageTree.prototype.multi = function (boundary) {
  // Add the parts array to the current path in the message tree.
  this.path.push(this.current);
  this.boundaries.push(boundary);
  this.boundary = boundary;
  this.current.emit('multi');
};

MessageTree.prototype.trailer = function () {
  this.current = this.path[this.path.length - 1].trailer();
};

/**
 * Close the current multipart message. To be called when encountering the
 * closing multipart boundary.
 */
MessageTree.prototype.pop = function () {
  // The parser is currently in the body parsing state. This means we can
  // continue using this parser for parsing the body of the parent message.
  this.current = this.path.pop();
  this.boundaries.pop();
};

module.exports = MessageTree;
