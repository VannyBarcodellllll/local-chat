# Local Chat

A chatbot website for locally installed Ollama models. Includes streamed replies, saved conversation history, model selection, response preferences, text-file attachments, code formatting, copying, export, a stop button, and light and dark themes.

## Start

Requires Node.js 24 or later and Ollama with a downloaded local model. Open Ollama, then run `npm start` from this folder. Visit http://127.0.0.1:4176.

No dependency installation, cloud API, or API key is required. The app lists locally installed models and prefers `gemma3:4b` when available. It does not download models automatically.

The Node.js server connects to Ollama at http://127.0.0.1:11434. Set `OLLAMA_URL` for another local HTTP address or `PORT` for another app port. Remote model services and cloud models are excluded.

Conversations and settings are stored in browser local storage. They can be exported as Markdown. Closing or refreshing the page stops a running response. The initial request may take longer while Ollama loads the model into memory. Each request uses up to the last 30 messages with an 8,192-token context and a 2,048-token response limit; long conversations or attachments can exceed the model's context window.

The app binds to loopback and is intended for personal use on one computer. It has no account system. Browser history storage is not encrypted and can be lost when browser data is cleared.

## Files

- `server.mjs`: local Ollama proxy, validation, streaming, static file server.
- `public/`: chatbot interface, conversation management, and styles.
- `test/server.test.mjs`: model filtering, streaming, validation, and origin checks using a mock model service.

Run `npm test` for the automated checks. Live model responses should also be checked manually. Response quality and speed depend on the selected model and hardware.
