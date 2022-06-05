const {resolve} = require('path');
const {defineConfig} = require('vite');
const {postcssPlugin} = require('uncss');

let root = 'front/'

module.exports = defineConfig({
  root: root,
  build: {
    outDir: '../dist/',
    emptyOutDir: true,
    rollupOptions: {
      input: {
	index: resolve(__dirname, root, 'index.html'),
	app: resolve(__dirname, root, 'app.html'),
	privacy: resolve(__dirname, root, 'privacy.html')
      }
    }
  },
  css: {
    postcss: {
      plugins: [ postcssPlugin({html: "front/*.html"}) ],
    }
  }
});
