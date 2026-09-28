const assistant = require('../../gemini-assistant.cjs');

module.exports = (req, res) => assistant.handle(req, res, 'summary');
