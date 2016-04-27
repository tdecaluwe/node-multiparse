# node-multiparse

A simple library to parse multipart messages the right way.

No dependencies are needed, parsing headers is done with the native HTTP parser
included in node. Searching for boundaries is done using the native
Boyer-Moore-Horspool implementation as provided through `String.indexOf`. A
small cache accounts for boundaries over several chunks.

```javascript
var MultiParser = require('node-multiparse');

// Parse our message with 'boundary' as it's boundary
var parser = new MultiParser('boundary');

parser.write(...);
parser.end();

parser.on('part', function (part) {
  process.stdout.write('New part encountered\r\n');
  process.stdout.write('--------------------\r\n\r\n');
  part.pipe(process.stdout);
});
```

##
