import { Buffer } from 'buffer';
import { decompressSync } from 'fflate';
import type { Barretenberg } from '@aztec/bb.js';

import acvmJsBgWasmInput from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import circuit from './quartets_hand_zkproof.json';

export async function Noir(debug: boolean = false) {
	const { Barretenberg, RawBuffer, Crs } = await import('@aztec/bb.js');
	const { default: initACVM, executeCircuit, compressWitness } = await import('@noir-lang/acvm_js');

	const acirBuffer: Uint8Array = Buffer.from(circuit.bytecode, 'base64');
	const acirBufferUncompressed: Uint8Array = decompressSync(acirBuffer);
	const api: Barretenberg = await Barretenberg.new(4);

	await initACVM(acvmJsBgWasmInput);

	const [, total] = await api.acirGetCircuitSizes(acirBufferUncompressed);
	const subgroupSize = Math.pow(2, Math.ceil(Math.log2(total)));
	const acirComposer = await api.acirNewAcirComposer(subgroupSize);

	const crs = await Crs.new(subgroupSize + 1);
	await api.commonInitSlabAllocator(subgroupSize);
	await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));

	async function generateWitness(initialWitness: Map<number, string>): Promise<Uint8Array> {
		const witnessMap = await executeCircuit(acirBuffer, initialWitness, () => {
			throw Error('unexpected oracle');
		});

		const witnessBuff = compressWitness(witnessMap);
		if (debug) console.log('witnessBuff: ', witnessBuff);
		return witnessBuff;
	}

	async function generateProof(witness: Uint8Array) {
		const proof = await api.acirCreateProof(acirComposer, acirBufferUncompressed, decompressSync(witness), false);
		if (debug) console.log('proof: ', proof);
		return proof;
	}

	async function verifyProof(proof: Uint8Array) {
		await api.acirInitProvingKey(acirComposer, acirBufferUncompressed);
		const verified = await api.acirVerifyProof(acirComposer, proof, false);
		if (debug) console.log('verified: ', verified);
		return verified;
	}

	function destroy() {
		return api.destroy();
	}

	return {
		generateWitness,
		generateProof,
		verifyProof,
		destroy,
	};
}
