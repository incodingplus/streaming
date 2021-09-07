const path = require("path")

module.exports = {
  mode: "production",
  entry: {
    index: "./src/lambda.ts"
  },
  target: 'node14',
  output: {
    libraryTarget: "commonjs2",
    path: path.join(__dirname, "dist_webpack"),
    filename: "[name].js",
  },
  externalsPresets: { node: true },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        exclude: /node_modules/,
        use: [
            {
                loader: 'ts-loader',
                options: {
                    onlyCompileBundledFiles: true
                }
            }
        ],
      },
    ],
  },
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  optimization: {
    nodeEnv: false
  },
  devtool: 'source-map',
}