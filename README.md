# WebGL2 Nano Currency Proof of Work Generation

Javascript module to generate the proof of work value for [Nano currency](https://nano.org) transactions with the GPU by using a WebGL2 fragment shader that calculates a Blake2B hash.

See the [demo for a working implementation](https://numtel.github.io/nano-webgl-pow/).

WebGL 2 provides bitwise operators unavailable in WebGL 1. These are required for the Blake2B calculation. As of time of writing, WebGL2 is supported in Chrome and Firefox, on desktop and Android. See the [WebGL2 compatibility table](https://caniuse.com/#feat=webgl2) for more information.

## Installation

Download the source code from the repository or with NPM.

```
npm install nano-webgl-pow
```

## Implements

`window.NanoWebglPow(hashHex, callback, progressCallback);`

Due to using `window.requestAnimationFrame()` to prevent blocking the main thread during generation, the browser tab must remain open during generation.

* `hashHex` `<String>` Previous Block Hash as Hex String
* `callback` `<Function>` Called when work value found. Arguments: `work` work value as hex string, `n` number of frames calculated
* `progressCallback` `<Function>` Optional. Receives single argument: n, number of frames so far. Return true to abort.

`window.NanoWebglPow.width, window.NanoWebglPow.height`

Width, height properties for rendered frames during generation. Larger values will load the graphics card more.

Values must be multiples of 256 but do not need to be the same. (i.e. 512x768 is ok, 510x768 is not)

Default: 512x512

## Acknowledgements

* [jaimehgb/RaiBlocksWebAssemblyPoW](https://github.com/jaimehgb/RaiBlocksWebAssemblyPoW) WASM implementation of proof of work generation
* [dcposch/blakejs](https://github.com/dcposch/blakejs) Javascript blake2b as template

## License

MIT
