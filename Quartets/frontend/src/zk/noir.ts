import { Buffer } from 'buffer';
import { decompressSync } from 'fflate';
import type { Barretenberg } from '@aztec/bb.js';
import { acvm } from '@noir-lang/noir_js';
import acvmJsBgWasmInput from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import { Fr } from './fields';
import { bytesToNumber } from '@/utils';

interface IZKProof {
	backend: string;
	abi: {
		parameters: any[];
		param_witnesses: Record<string, number[]>;
		return_type: any;
		return_witnesses: any;
	};
	bytecode: string;
}

export async function Noir(zkProof: IZKProof, debug: boolean = false) {
	const { Barretenberg, RawBuffer, Crs } = await import('@aztec/bb.js');
	const acirBuffer: Uint8Array = Buffer.from(zkProof.bytecode, 'base64');
	const acirBufferUncompressed: Uint8Array = decompressSync(acirBuffer);
	const api: Barretenberg = await Barretenberg.new(4);

	await acvm.default(acvmJsBgWasmInput);

	const [, total] = await api.acirGetCircuitSizes(acirBufferUncompressed);
	const subgroupSize = Math.pow(2, Math.ceil(Math.log2(total)));
	const acirComposer = await api.acirNewAcirComposer(subgroupSize);

	const crs = await Crs.new(subgroupSize + 1);
	await api.commonInitSlabAllocator(subgroupSize);
	await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));

	async function generateWitness(initialWitness: Map<number, string>): Promise<Uint8Array> {
		const witnessMap = await acvm.executeCircuit(acirBuffer, initialWitness, () => {
			throw Error('unexpected oracle');
		});

		const witnessBuff = acvm.compressWitness(witnessMap);
		if (debug) console.log('witnessBuff: ', witnessBuff);
		return witnessBuff;
	}

	async function generateProof(witness: Uint8Array) {
		const proof = await api.acirCreateProof(acirComposer, acirBufferUncompressed, decompressSync(witness), false);
		if (debug) console.log('proof: ', proof);
		return proof;
	}

	function extractProofPublicParams(proof: Uint8Array) {
		const bytesToNumber = (byteArray: Uint8Array) => byteArray.reduce((a, b) => a * 256n + BigInt(b), 0n);
		const accessMap = Object.fromEntries(zkProof.abi.parameters.map(p => [p.name, p.visibility === 'public']));

		const publicParamsWitnesses = Object.entries(zkProof.abi.param_witnesses).filter(([key]) => accessMap[key]);

		const minWitnessIndex = Math.min(...publicParamsWitnesses.flatMap(([, value]) => value));
		const adjustedWitnesses = publicParamsWitnesses.map(([key, value]) => [key, value.map((v: number) => v - minWitnessIndex)] as const);

		return Object.fromEntries(adjustedWitnesses.map(([key, value]) => [key, value.flatMap(i => bytesToNumber(proof.slice(i * 32, (i + 1) * 32)))]));
	}

	async function verifyProof(proof: Uint8Array) {
		await api.acirInitProvingKey(acirComposer, acirBufferUncompressed);
		const verified = await api.acirVerifyProof(acirComposer, proof, false);
		if (debug) console.log('verified: ', verified);
		return [verified, extractProofPublicParams(proof)] as const;
	}

	async function pedersenHash(hand: number[]) {
		return api.pedersenPlookupCommit(hand.map(c => new Fr(BigInt(c))));
	}

	function destroy() {
		return api.destroy();
	}

	return {
		extractProofPublicParams,
		generateWitness,
		generateProof,
		pedersenHash,
		verifyProof,
		destroy,
	};
}
