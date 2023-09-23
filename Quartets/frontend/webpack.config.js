const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
	const isProduction = argv.mode === 'production';
	process.env.NODE_ENV = argv.mode;

	const plugins = [
		new HtmlWebpackPlugin({
			template: './src/index.html',
		}),
		new webpack.ProvidePlugin({
			// Buffer: ['buffer', 'Buffer'],
			// process: 'process/browser',
		}),
	];

	const config = {
		entry: './src/index',
		output: {
			path: path.join(__dirname, '/dist'),
			filename: 'bundle.js',
		},
		resolve: {
			extensions: ['.ts', '.tsx', '.js'],
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
			fallback:{
				// Buffer: require.resolve('buffer'),
			}
		},
		module: {
			noParse: /gun\.js$/,
			rules: [
				{
					test: /\.(ts|m?js)x?$/,
					loader: 'babel-loader',
					resolve: {
						fullySpecified: false,
					},
				},
				{
					test: /\.(png|jpg|gif|svg)$/,
					use: [
						{
							loader: 'url-loader',
							options: {
								limit: 12000, // if less than 12000 bytes, add base64 encoded
								// image to css
								name: file => `/[path][name].[ext]`,
							},
						},
					],
				},
				{
					test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
					use: [
						{
							loader: 'file-loader',
							options: {
								name: '[name].[ext]',
								outputPath: 'fonts/',
							},
						},
					],
				},
				{
					test: /\.css$/i,
					use: ['style-loader', 'css-loader'],
				},
			],
		},
		plugins,
	};

	if (isProduction) {
		Object.assign(config, {
			optimization: {
				minimize: true,
				minimizer: [
					new TerserJSPlugin({
						terserOptions: { output: { comments: false } },
						extractComments: false,
					}),
				],
			},
		});

		config.plugins.push(new CleanWebpackPlugin());
	} else {
		Object.assign(config, {
			stats: 'minimal',
			devtool: 'cheap-module-source-map',
			devServer: {
				compress: true,
				port: 8888,
				historyApiFallback: true,
			},
		});

		config.plugins.push(
			new ForkTsCheckerWebpackPlugin({
				async: true,
			})
		);
	}

	return config;
};
