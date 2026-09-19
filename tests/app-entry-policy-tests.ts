import { resolveAppEntryPolicy } from '../src/runtime/appEntryPolicy.js';

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

assertEqual(resolveAppEntryPolicy({ environment: 'development', preview: undefined, entryMode: undefined, developmentBuild: true }), 'app');
assertEqual(resolveAppEntryPolicy({ environment: 'development', preview: undefined, entryMode: 'auth_qa', developmentBuild: true }), 'auth');
assertEqual(resolveAppEntryPolicy({ environment: 'preview', preview: '1', entryMode: undefined, developmentBuild: false }), 'app');
assertEqual(resolveAppEntryPolicy({ environment: 'preview', preview: '1', entryMode: 'auth_qa', developmentBuild: false }), 'auth');
assertEqual(resolveAppEntryPolicy({ environment: 'preview', preview: undefined, entryMode: undefined, developmentBuild: false }), 'auth');
for (const preview of [undefined, '1']) {
  for (const entryMode of [undefined, 'app', 'auth_qa']) {
    assertEqual(resolveAppEntryPolicy({ environment: 'production', preview, entryMode, developmentBuild: true }), 'auth');
    assertEqual(resolveAppEntryPolicy({ environment: 'production', preview, entryMode, developmentBuild: false }), 'auth');
  }
}
assertEqual(resolveAppEntryPolicy({ environment: undefined, preview: '1', entryMode: undefined, developmentBuild: false }), 'auth');
console.log('PASS: app entry policy separates development, preview, Auth QA and production');
