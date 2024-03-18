

export const unparse = (_input, _config) => {
  let _quotes = false;
  let _writeHeader = true;
  let _delimiter = ',';
  let _newline = '\r\n';
  let _quoteChar = '"';
  let _escapedQuote = _quoteChar + _quoteChar;
  let _skipEmptyLines = false;
  let _columns = null;
  let _escapeFormulae = false;

  unpackConfig();

  const quoteCharRegex = new RegExp(escapeRegExp(_quoteChar), 'g');

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

  throw new Error('Unable to serialize unrecognized input');

  /**
   * Unpacks the configuration options and assigns them to the corresponding variables.
   * @returns {void}
   */
  function unpackConfig() {
    if (typeof _config !== 'object')
      return;

    if (typeof _config.delimiter === 'string'
      && !BAD_DELIMITERS.some(value => _config.delimiter.includes(value))) {
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
      _escapedQuote = `${_config.escapeChar}${_quoteChar}`;
    }

    if (typeof _config.escapeFormulae === 'boolean' || _config.escapeFormulae instanceof RegExp) {
      _escapeFormulae = _config.escapeFormulae instanceof RegExp ? _config.escapeFormulae : /^[=+\-@\t\r].*$/;
    }
  }

  /**
   * Serializes the given fields and data into a CSV string. The double for loop that iterates the data and writes out a CSV string including header row
   *
   * @param {string | Array<string>} fields - The fields to include in the CSV. Can be a stringified JSON array or an array of strings.
   * @param {string | Array<Array<any>>} data - The data to include in the CSV. Can be a stringified JSON array of arrays or an array of arrays.
   * @param {boolean | string} skipEmptyLines - Determines whether to skip empty lines in the CSV. Can be a boolean or the string 'greedy'.
   * @returns {string} The serialized CSV string.
   */
  function serialize(fields, data, skipEmptyLines) {
    let csv = '';

    if (typeof fields === 'string')
      fields = JSON.parse(fields);
    if (typeof data === 'string')
      data = JSON.parse(data);

    const hasHeader = Array.isArray(fields) && fields.length > 0;
    const dataKeyedByField = !(Array.isArray(data[0]));

    // If there a header row, write it first
    if (hasHeader && _writeHeader) {
      csv += fields.map((field, i) => i > 0 ? `${_delimiter}${safe(field, i)}` : safe(field, i)).join('');
      if (data.length > 0)
        csv += _newline;
    }

    // Then write out the data
    for (let row = 0; row < data.length; row++) {
      const maxCol = hasHeader ? fields.length : data[row].length;

      let emptyLine = false;
      const nullLine = hasHeader ? Object.keys(data[row]).length === 0 : data[row].length === 0;
      if (skipEmptyLines && !hasHeader) {
        emptyLine = skipEmptyLines === 'greedy' ? data[row].join('').trim() === '' : data[row].length === 1 && data[row][0].length === 0;
      }
      if (skipEmptyLines === 'greedy' && hasHeader) {
        const line = [];
        for (let c = 0; c < maxCol; c++) {
          const cx = dataKeyedByField ? fields[c] : c;
          line.push(data[row][cx]);
        }
        emptyLine = line.join('').trim() === '';
      }
      if (!emptyLine) {
        for (let col = 0; col < maxCol; col++) {
          if (col > 0 && !nullLine)
            csv += _delimiter;
          const colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
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

    let needsQuotes = false;

    if (_escapeFormulae && typeof str === "string" && _escapeFormulae.test(str)) {
      str = `'${str}`;
      needsQuotes = true;
    }

    const escapedQuoteStr = str.toString().replace(quoteCharRegex, _escapedQuote);

    needsQuotes = needsQuotes
      || _quotes === true
      || (typeof _quotes === 'function' && _quotes(str, col))
      || (Array.isArray(_quotes) && _quotes[col])
      || BAD_DELIMITERS.some(substring => escapedQuoteStr.includes(substring))
      || escapedQuoteStr.includes(_delimiter)
      || escapedQuoteStr.charAt(0) === ' '
      || escapedQuoteStr.charAt(escapedQuoteStr.length - 1) === ' ';

    return needsQuotes ? `${_quoteChar}${escapedQuoteStr}${_quoteChar}` : escapedQuoteStr;
  }

  function hasAny(str, substrings) {
    return substrings.some(substring => str.includes(substring));
  }
}

/** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const BAD_DELIMITERS = ['\r', '\n', '"', '\ufeff'];