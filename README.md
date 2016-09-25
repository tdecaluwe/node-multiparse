[![view on npm](http://img.shields.io/npm/v/multiparse.svg)](https://www.npmjs.org/package/multiparse)
[![npm module downloads per month](http://img.shields.io/npm/dm/multiparse.svg)](https://www.npmjs.org/package/multiparse)
[![Code Climate](https://codeclimate.com/github/tdecaluwe/node-multiparse/badges/gpa.svg)](https://codeclimate.com/github/tdecaluwe/node-multiparse)
[![Test Coverage](https://codeclimate.com/github/tdecaluwe/node-multiparse/badges/coverage.svg)](https://codeclimate.com/github/tdecaluwe/node-multiparse/coverage)

# node-multiparse

A simple library to parse multipart messages the right way. The parser is
implemented as a `WritableStream` expecting the body of a multipart message. It
supports nested multipart messages out of the box.

## Usage

The parser exposes the standard `WritableStream` interface including the methods
`write()` and `end()`.

```javascript
var MultiParser = require('multiparse');

// Parse our message with 'boundary' as it's boundary
var parser = new MultiParser('boundary');

parser.write(...);
parser.end();

parser.on('part', function (part) {

});
```

## Architecture

Dependencies are minimal, only the `content-type` package is used. Parsing
headers is done with the native HTTP parser included in node. Searching for
boundaries is done using the native Boyer-Moore-Horspool implementation as
provided through `String.indexOf`. A small cache accounts for boundaries
splitted over several chunks.

## Classes

Class | Description
----: | :----------
[MultiParser](#MultiParser) | The `MultiParser` class is a `WritableStream` which will parse the provided message and will emit a new `ReadableStream` for each message part it encounters.
[MessagePart](#MessagePart) | This is the `IncomingMessage` analog for message parts. It implements the `ReadableStream` interface.

## Reference

<a name="MultiParser"></a>
### MultiParser

The `MultiParser` constructor accepts one mandatory string argument to be used as the boundary of the message being parsed:

```
new MultiParser(boundary)
```

Function | Description
-------: | :----------
`on(event,callback)` | Add a listener for a specific event. The event can be any of `data`, `part`, `trailer` and `error`.
`write(chunk)` | Write a chunk of data to the parser.
`end()` | Terminate the multipart message. This method will emit an error if the root message was not properly finished (no closing boundary was found).

<a name="MessagePart"></a>
### MessagePart

A new `MessagePart` will be constructor each time the `MultiParser` encounters a message part. The main difference with the interface of an `IncomingMessage` is the presence of an optional `parts` property.

Property | Description
-------: | :----------
`headers` | Contains all the message headers where the keys correspond to the lowercase header names.
`parts` | If the message part is also a multipart message, this property will contain an array of `MessagePart` instances corresponding with the parts.

Function | Description
-------: | :----------
`on(event,callback)` | Add a listener for a specific event. The event can be any of `data`, `part`, `trailer` and `error`.
`pipe(stream)` | Pipe the stream to a `WritableStream`.

The `MultiParser` class emits the same events as the `MessagePart` and provides a way to listen to events emitted by the root message.
