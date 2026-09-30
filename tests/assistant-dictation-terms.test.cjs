const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assistant-dictation-terms.js'), 'utf8'), { window });
const terms = window.MOTORLOZ_DICTATION;

test('corrects Subaru model nicknames only with vehicle context', () => {
  assert.equal(terms.normalize('Tengo un Subaru empresa hockey guatón'), 'Tengo un Subaru Impreza Hawkeye Wagon');
  assert.equal(terms.normalize('Es una Hawkei y es vagón', 'Tengo un Subaru Impreza'), 'Es una Hawkeye y es Wagon');
  assert.equal(terms.normalize('Mi empresa juega hockey'), 'Mi empresa juega hockey');
  assert.equal(terms.normalize('Tengo una Hyundai', 'También tengo un Subaru'), 'Tengo una Hyundai');
});

test('selects a car-model alternative when the conversation already names Subaru', () => {
  const result = [{ transcript: 'Tengo una Hyundai' }, { transcript: 'Tengo una Hawkeye' }];
  assert.equal(terms.choose(result, 'Mi Subaru Impreza tiene 200.000 kilómetros'), 'Tengo una Hawkeye');
  assert.equal(terms.choose(result, 'Mi camioneta necesita mantenimiento'), 'Tengo una Hyundai');
});
