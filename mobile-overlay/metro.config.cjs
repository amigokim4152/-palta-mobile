const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...new Set([...(config.watchFolders ?? []), workspaceRoot]),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const defaultResolve = previousResolveRequest
    ? (name) => previousResolveRequest(context, name, platform)
    : (name) => context.resolveRequest(context, name, platform);

  try {
    return defaultResolve(moduleName);
  } catch (error) {
    const isRelativeCompiledSpecifier =
      (moduleName.startsWith('./') || moduleName.startsWith('../')) &&
      moduleName.endsWith('.js');

    if (!isRelativeCompiledSpecifier) throw error;

    // Canonical core uses NodeNext-compatible `.js` specifiers while source files
    // remain TypeScript. Metro sees the source tree directly, so retry only those
    // unresolved relative specifiers without the emitted extension.
    return defaultResolve(moduleName.slice(0, -3));
  }
};

module.exports = config;
