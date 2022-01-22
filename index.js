

export function unparse(_input, _config) {
  // Default configuration

  /** whether to surround every datum with quotes */
  var _quotes = false;

  /** whether to write headers */
  var _writeHeader = true;

  /** delimiting character(s) */
  var _delimiter = ',';

  /** newline character(s) */
  var _newline = '\r\n';

  /** quote character */
  var _quoteChar = '"';

  /** escaped quote character, either "" or <config.escapeChar>" */
  var _escapedQuote = _quoteChar + _quoteChar;

  /** whether to skip empty lines */
  var _skipEmptyLines = false;

  /** the columns (keys) we expect when we unparse objects */
  var _columns = null;

  /** whether to prevent outputting cells that can be parsed as formulae by spreadsheet software (Excel and LibreOffice) */
  var _escapeFormulae = false;

  unpackConfig();

  var quoteCharRegex = new RegExp(escapeRegExp(_quoteChar), 'g');

  if (typeof _input === 'string')
    _input = JSON.parse(_input);

  if (Array.isArray(_input)) {
    if (!_input.length || Array.isArray(_input[0]))
      return serialize(null, _input, _skipEmptyLines);
    else if (typeof _input[0] === 'object')
      return serialize(_columns || Object.keys(_input[0]), _input, _skipEmptyLines);
  }
  else if (typeof _input === 'object') {
    if (typeof _input.data === 'string')
      _input.data = JSON.parse(_input.data);

    if (Array.isArray(_input.data)) {
      if (!_input.fields)
        _input.fields = _input.meta && _input.meta.fields;

      if (!_input.fields)
        _input.fields = Array.isArray(_input.data[0])
          ? _input.fields
          : typeof _input.data[0] === 'object'
            ? Object.keys(_input.data[0])
            : [];

      if (!(Array.isArray(_input.data[0])) && typeof _input.data[0] !== 'object')
        _input.data = [_input.data];	// handles input like [1,2,3] or ['asdf']
    }

    return serialize(_input.fields || [], _input.data || [], _skipEmptyLines);
  }

  // Default (any valid paths should return before this)
  throw new Error('Unable to serialize unrecognized input');


  function unpackConfig() {
    if (typeof _config !== 'object')
      return;

    if (typeof _config.delimiter === 'string'
      && !BAD_DELIMITERS.filter(function (value) { return _config.delimiter.indexOf(value) !== -1; }).length) {
      _delimiter = _config.delimiter;
    }

    if (typeof _config.quotes === 'boolean'
      || typeof _config.quotes === 'function'
      || Array.isArray(_config.quotes))
      _quotes = _config.quotes;

    if (typeof _config.skipEmptyLines === 'boolean'
      || typeof _config.skipEmptyLines === 'string')
      _skipEmptyLines = _config.skipEmptyLines;

    if (typeof _config.newline === 'string')
      _newline = _config.newline;

    if (typeof _config.quoteChar === 'string')
      _quoteChar = _config.quoteChar;

    if (typeof _config.header === 'boolean')
      _writeHeader = _config.header;

    if (Array.isArray(_config.columns)) {

      if (_config.columns.length === 0) throw new Error('Option columns is empty');

      _columns = _config.columns;
    }

    if (_config.escapeChar !== undefined) {
      _escapedQuote = _config.escapeChar + _quoteChar;
    }

    if (typeof _config.escapeFormulae === 'boolean' || _config.escapeFormulae instanceof RegExp) {
      _escapeFormulae = _config.escapeFormulae instanceof RegExp ? _config.escapeFormulae : /^[=+\-@\t\r].*$/;
    }
  }

  /** The double for loop that iterates the data and writes out a CSV string including header row */
  function serialize(fields, data, skipEmptyLines) {
    var csv = '';

    if (typeof fields === 'string')
      fields = JSON.parse(fields);
    if (typeof data === 'string')
      data = JSON.parse(data);

    var hasHeader = Array.isArray(fields) && fields.length > 0;
    var dataKeyedByField = !(Array.isArray(data[0]));

    // If there a header row, write it first
    if (hasHeader && _writeHeader) {
      for (var i = 0; i < fields.length; i++) {
        if (i > 0)
          csv += _delimiter;
        csv += safe(fields[i], i);
      }
      if (data.length > 0)
        csv += _newline;
    }

    // Then write out the data
    for (var row = 0; row < data.length; row++) {
      var maxCol = hasHeader ? fields.length : data[row].length;

      var emptyLine = false;
      var nullLine = hasHeader ? Object.keys(data[row]).length === 0 : data[row].length === 0;
      if (skipEmptyLines && !hasHeader) {
        emptyLine = skipEmptyLines === 'greedy' ? data[row].join('').trim() === '' : data[row].length === 1 && data[row][0].length === 0;
      }
      if (skipEmptyLines === 'greedy' && hasHeader) {
        var line = [];
        for (var c = 0; c < maxCol; c++) {
          var cx = dataKeyedByField ? fields[c] : c;
          line.push(data[row][cx]);
        }
        emptyLine = line.join('').trim() === '';
      }
      if (!emptyLine) {
        for (var col = 0; col < maxCol; col++) {
          if (col > 0 && !nullLine)
            csv += _delimiter;
          var colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
          csv += safe(data[row][colIdx], col);
        }
        if (row < data.length - 1 && (!skipEmptyLines || (maxCol > 0 && !nullLine))) {
          csv += _newline;
        }
      }
    }
    return csv;
  }

  /** Encloses a value around quotes if needed (makes a value safe for CSV insertion) */
  function safe(str, col) {
    if (typeof str === 'undefined' || str === null)
      return '';

    if (str.constructor === Date)
      return JSON.stringify(str).slice(1, 25);

    var needsQuotes = false;

    if (_escapeFormulae && typeof str === "string" && _escapeFormulae.test(str)) {
      str = "'" + str;
      needsQuotes = true;
    }

    var escapedQuoteStr = str.toString().replace(quoteCharRegex, _escapedQuote);

    needsQuotes = needsQuotes
      || _quotes === true
      || (typeof _quotes === 'function' && _quotes(str, col))
      || (Array.isArray(_quotes) && _quotes[col])
      || hasAny(escapedQuoteStr, BAD_DELIMITERS)
      || escapedQuoteStr.indexOf(_delimiter) > -1
      || escapedQuoteStr.charAt(0) === ' '
      || escapedQuoteStr.charAt(escapedQuoteStr.length - 1) === ' ';

    return needsQuotes ? _quoteChar + escapedQuoteStr + _quoteChar : escapedQuoteStr;
  }

  function hasAny(str, substrings) {
    for (var i = 0; i < substrings.length; i++)
      if (str.indexOf(substrings[i]) > -1)
        return true;
    return false;
  }
}

/** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const BAD_DELIMITERS = ['\r', '\n', '"', '\ufeff'];