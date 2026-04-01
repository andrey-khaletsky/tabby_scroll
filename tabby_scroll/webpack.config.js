const path = require('path')

module.exports = {
  target: 'node',
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
      },
    ],
  },
  externals: [
    /^@angular/,
    /^@ng-bootstrap/,
    /^rxjs/,
    /^tabby-/,
    /^ngx-toastr/,
    'fs',
    'path',
  ],
}
