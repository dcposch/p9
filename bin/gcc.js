#!/usr/bin/env node
var compile = require('google-closure-compiler-js/compile.js')
var logger = require('google-closure-compiler-js/logger.js')

var buf = Buffer.alloc(0)

process.stdin.on('data', function (data) {
  buf = Buffer.concat([buf, data])
})

process.stdin.on('end', function () {
  var js = buf.toString('utf8')

  var opts = {
    assumeFunctionWrapper: true,
    compilationLevel: 'ADVANCED',
    jsCode: [{src: js}]
  }

  console.warn('Invoking Google Closure Compiler on ' + Math.round(js.length / 1024) + 'KB of JS')
  var output = compile(opts)
  console.warn('Output: ' + Math.round(output.compiledCode.length / 1024) + 'KB of JS')

  logger(opts, output)
  console.log(output.compiledCode)
})
