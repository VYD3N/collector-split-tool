const webpack = require('webpack');
const path = require('path');

module.exports = function override(config) {
  // Fallback for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    assert: require.resolve('assert'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process/browser'),
    path: require.resolve('path-browserify'),
    fs: false,
    net: false,
    tls: false,
    zlib: require.resolve('browserify-zlib'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify/browser'),
    url: require.resolve('url'),
  };

  // Add process alias to resolve any fully specified imports of process/browser
  config.resolve.alias = {
    ...config.resolve.alias,
    'process/browser': require.resolve('process/browser'),
  };

  // Add plugins to provide Buffer and process
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  // Ignore source-map warnings from node_modules
  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
}; 