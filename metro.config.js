const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
    minifierPath: 'metro-minify-terser',
    minifierConfig: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      mangle: true,
    },
  },
  resolver: {
    alias: {
      '@': './src',
    },
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
  },
  maxWorkers: require('os').cpus().length,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);