import { IDeferedObject, Ref } from './types';

export function createRef<T>(initial?: T): Ref<T> {
	return {
		current: initial,
	};
}

export function toHex(str: string) {
	return str.split('').map(char => char.charCodeAt(0).toString(16));
}

export const hexToString = (hex: string) => {
	let str = '';
	for (let i = 0; i < hex.length; i += 2) {
		const hexValue = hex.substring(i, i + 2);
		const decimalValue = parseInt(hexValue, 16);
		str += String.fromCharCode(decimalValue);
	}

	return str;
};

export function toShamirMessage(message: string) {
	return BigInt('0x' + toHex(message).join(''));
}

export function RSA() {
	function importKey(key: JsonWebKey, isPrivate: boolean) {
		return window.crypto.subtle.importKey('jwk', key, { name: 'RSA-OAEP', hash: { name: 'SHA-256' } }, true, isPrivate ? ['decrypt'] : ['encrypt']);
	}

	return {
		importKey,
		async generateKey() {
			const { privateKey, publicKey } = await window.crypto.subtle.generateKey(
				{ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]), hash: { name: 'SHA-256' } },
				true,
				['encrypt', 'decrypt']
			);

			const jwkPuKey = await window.crypto.subtle.exportKey('jwk', publicKey);
			const jwkPrKey = await window.crypto.subtle.exportKey('jwk', privateKey);

			return {
				privateKey: jwkPrKey,
				publicKey: jwkPuKey,
			};
		},
		async encrypt(message: BufferSource, publicKey: JsonWebKey) {
			const pKey = await importKey(publicKey, false);
			const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pKey, message);

			return new Uint8Array(encrypted);
		},
		async decrypt(message: BufferSource, privateKey: JsonWebKey) {
			const pKey = await importKey(privateKey, true);
			return window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pKey, message);
		},
	};
}

export function defer<T = unknown>() {
	let resolve: (arg: T) => void = () => {};
	let reject: (arg: unknown) => void = () => {};

	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	}) as IDeferedObject<T>;

	promise.resolve = resolve;
	promise.reject = reject;

	return promise;
}

export function gunOn<T>(chain: any, fn: (data: T, key: any, _: any, ev: any) => void) {
	let ev = createRef(() => {});
	chain.on((_d: T, _k: any, _: any, event: any) => {
		fn(_d, _k, _, event);
		ev.current = () => event.off();
	});

	return ev;
}
