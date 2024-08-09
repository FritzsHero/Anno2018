const merge = require("webpack-merge");
const common = require("./webpack.common.js");
const webpack = require("webpack");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = merge(common, {
  devServer: {
    hot: true
  },
  devtool: "inline-source-map",
  mode: "development",
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
              configFile: "tsconfig.browser.json"
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
  ]
});
