import { Buffer } from 'buffer';

export const randomBytes = (len: number) => {
	const getWebCrypto = () => {
		if (typeof window !== 'undefined' && window.crypto) return window.crypto;
		if (typeof self !== 'undefined' && self.crypto) return self.crypto;
		return undefined;
	};

	const crypto = getWebCrypto();
	if (!crypto) {
		throw new Error('randomBytes UnsupportedEnvironment');
	}

	const buf = new Uint8Array(len);

	// limit of Crypto.getRandomValues()
	// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
	const MAX_BYTES = 65536;

	if (len > MAX_BYTES) {
		// this is the max bytes crypto.getRandomValues
		// can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
		for (let generated = 0; generated < len; generated += MAX_BYTES) {
			// buffer.slice automatically checks if the end is past the end of
			// the buffer so we don't have to here
			crypto.getRandomValues(buf.subarray(generated, generated + MAX_BYTES));
		}
	} else {
		crypto.getRandomValues(buf);
	}

	return buf;
};

export function toBigIntBE(bytes: Uint8Array) {
	// A Buffer in node, *is* a Uint8Array. We can't refuse it's type.
	// However the algo below only works on an actual Uint8Array, hence we make a new one to be safe.
	bytes = new Uint8Array(bytes);
	let bigint = BigInt(0);
	const view = new DataView(bytes.buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		bigint = (bigint << BigInt(8)) + BigInt(view.getUint8(i));
	}
	return bigint;
}

export function toBufferBE(value: bigint, byteLength = 32) {
	const bytes = new Uint8Array(byteLength);
	const view = new DataView(bytes.buffer);
	for (let i = 0; i < byteLength; i++) {
		view.setUint8(byteLength - i - 1, Number(value & BigInt(0xff)));
		value >>= BigInt(8);
	}
	return bytes;
}

export class Fr {
	static ZERO = new Fr(0n);
	static MODULUS = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
	static MAX_VALUE = this.MODULUS - 1n;
	static SIZE_IN_BYTES = 32;

	constructor(public readonly value: bigint) {
		if (value > Fr.MAX_VALUE) {
			throw new Error(`Fr out of range ${value}.`);
		}
	}

	static random() {
		const r = toBigIntBE(randomBytes(64)) % Fr.MODULUS;
		return new this(r);
	}

	static fromBuffer(buffer: Uint8Array | BufferReader) {
		const reader = BufferReader.asReader(buffer);
		return new this(toBigIntBE(reader.readBytes(this.SIZE_IN_BYTES)));
	}

	static fromBufferReduce(buffer: Uint8Array | BufferReader) {
		const reader = BufferReader.asReader(buffer);
		return new this(toBigIntBE(reader.readBytes(this.SIZE_IN_BYTES)) % Fr.MODULUS);
	}

	static fromString(str: string) {
		return this.fromBuffer(Buffer.from(str.replace(/^0x/i, ''), 'hex'));
	}

	toBuffer() {
		return toBufferBE(this.value, Fr.SIZE_IN_BYTES);
	}

	toString() {
		return '0x' + uint8ArrayToHexString(this.toBuffer());
	}

	equals(rhs: Fr) {
		return this.value === rhs.value;
	}

	isZero() {
		return this.value === 0n;
	}
}

export class Fq {
	static MODULUS = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
	static MAX_VALUE = this.MODULUS - 1n;
	static SIZE_IN_BYTES = 32;

	constructor(public readonly value: bigint) {
		if (value > Fq.MAX_VALUE) {
			throw new Error(`Fq out of range ${value}.`);
		}
	}

	static random() {
		const r = toBigIntBE(randomBytes(64)) % Fq.MODULUS;
		return new this(r);
	}

	static fromBuffer(buffer: Uint8Array | BufferReader) {
		const reader = BufferReader.asReader(buffer);
		return new this(toBigIntBE(reader.readBytes(this.SIZE_IN_BYTES)));
	}

	static fromBufferReduce(buffer: Uint8Array | BufferReader) {
		const reader = BufferReader.asReader(buffer);
		return new this(toBigIntBE(reader.readBytes(this.SIZE_IN_BYTES)) % Fr.MODULUS);
	}

	static fromString(str: string) {
		return this.fromBuffer(Buffer.from(str.replace(/^0x/i, ''), 'hex'));
	}

	toBuffer() {
		return toBufferBE(this.value, Fq.SIZE_IN_BYTES);
	}

	toString() {
		return '0x' + this.value.toString(16);
	}

	equals(rhs: Fq) {
		return this.value === rhs.value;
	}

	isZero() {
		return this.value === 0n;
	}
}

export function uint8ArrayToHexString(uint8Array: Uint8Array) {
	return uint8Array.reduce((accumulator, byte) => accumulator + byte.toString(16).padStart(2, '0'), '');
}

export class BufferReader {
	private index: number;
	constructor(
		private buffer: Uint8Array,
		offset = 0
	) {
		this.index = offset;
	}

	public static asReader(bufferOrReader: Uint8Array | BufferReader) {
		return bufferOrReader instanceof BufferReader ? bufferOrReader : new BufferReader(bufferOrReader);
	}

	public readNumber(): number {
		const dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.index, 4);
		this.index += 4;
		return dataView.getUint32(0, false);
	}

	public readBoolean(): boolean {
		this.index += 1;
		// return Boolean(this.buffer.at(this.index - 1));
		return Boolean(this.buffer[this.index - 1]);
	}

	public readBytes(n: number): Uint8Array {
		this.index += n;
		return this.buffer.slice(this.index - n, this.index);
	}

	public readNumberVector(): number[] {
		return this.readVector({
			fromBuffer: (reader: BufferReader) => reader.readNumber(),
		});
	}

	public readVector<T>(itemDeserializer: { fromBuffer: (reader: BufferReader) => T }): T[] {
		const size = this.readNumber();
		const result = new Array<T>(size);
		for (let i = 0; i < size; i++) {
			result[i] = itemDeserializer.fromBuffer(this);
		}
		return result;
	}

	public readArray<T>(
		size: number,
		itemDeserializer: {
			fromBuffer: (reader: BufferReader) => T;
		}
	): T[] {
		const result = new Array<T>(size);
		for (let i = 0; i < size; i++) {
			result[i] = itemDeserializer.fromBuffer(this);
		}
		return result;
	}

	public readObject<T>(deserializer: { fromBuffer: (reader: BufferReader) => T }): T {
		return deserializer.fromBuffer(this);
	}

	public peekBytes(n?: number) {
		return this.buffer.subarray(this.index, n ? this.index + n : undefined);
	}

	public readString(): string {
		return new TextDecoder().decode(this.readBuffer());
	}

	public readBuffer(): Uint8Array {
		const size = this.readNumber();
		return this.readBytes(size);
	}

	public readMap<T>(deserializer: { fromBuffer: (reader: BufferReader) => T }): { [key: string]: T } {
		const numEntries = this.readNumber();
		const map: { [key: string]: T } = {};
		for (let i = 0; i < numEntries; i++) {
			const key = this.readString();
			const value = this.readObject<T>(deserializer);
			map[key] = value;
		}
		return map;
	}
}
