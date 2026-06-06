// iisnode entry point — CJS wrapper ที่ dynamic-import ESM server
import('./index.js').catch(function(err) {
  process.stderr.write('CRM API startup error: ' + err.message + '\n' + err.stack + '\n');
  process.exit(1);
});
