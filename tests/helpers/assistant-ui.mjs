export const assistantSamples={
  plain:'Inspect the input contract.',
  markdown:'# Result\n\n**Bold** and `inline code`.\n\n- first\n- second',
  quote:'> Preserve the contract.',
  code:'```js\nconst value = 42;\n```',
  indented:'    const value = 42;\n    return value;',
  tabs:'\tconst value = 42;\n\treturn value;',
  whitespace:'\n\n trailing spaces  \n\n',
  unicode:'CAF\u00c9 and \u65e5\u672c\u8a9e',
  long:Array(70).fill('path/value').join(' '),
  partial:'## Checking\n\nThe value is **part',
};
export const withoutZones=lines=>lines.map(line=>line.replace(/\x1b\]133;[ABC]\x07/g,''));
