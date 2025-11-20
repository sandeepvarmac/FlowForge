const ts = require('typescript');
const fs = require('fs');
const file = 'src/app/(routes)/data-assets/explorer/page.tsx';
const source = fs.readFileSync(file, 'utf8');
const result = ts.transpileModule(source, {
  reportDiagnostics: true,
  fileName: file,
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 }
});
if (result.diagnostics && result.diagnostics.length) {
  for (const diag of result.diagnostics) {
    const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log((pos.line + 1) + ':' + (pos.character + 1) + ' - ' + message);
  }
} else {
  console.log('No diagnostics');
}
