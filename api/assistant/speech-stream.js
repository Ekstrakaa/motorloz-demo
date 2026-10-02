const assistant = require('../../openai-assistant.cjs');

module.exports = (req, res) => assistant.handle(req, res, 'speech-stream');
