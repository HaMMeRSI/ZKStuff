import * as url from 'url';
function isURLInstance(fileURLOrPath) {
	return fileURLOrPath != null && fileURLOrPath.href && fileURLOrPath.origin;
}

function getPathFromURLPosix(url) {
	if (url.hostname !== '') {
		throw new TypeError('File URL host must be "localhost" or empty on darwin');
	}
	var pathname = url.pathname;
	for (var n = 0; n < pathname.length; n++) {
		if (pathname[n] === '%') {
			var third = pathname.codePointAt(n + 2) | 0x20;
			if (pathname[n + 1] === '2' && third === 102) {
				throw new TypeError('File URL path must not include encoded / characters');
			}
		}
	}
	return decodeURIComponent(pathname);
}

function fileURLToPath(path) {
	if (typeof path === 'string') {
		path = urlParse(path);
	} else if (!isURLInstance(path)) {
		throw new TypeError('The "path" argument must be of type string or an instance of URL. Received ' + path);
	}
	if (path.protocol !== 'file:') {
		throw new TypeError('The URL must be of scheme file');
	}
	return getPathFromURLPosix(path);
}

module.exports = { fileURLToPath,  };
