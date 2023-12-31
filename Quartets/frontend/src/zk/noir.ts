import { Buffer } from 'buffer';
import { decompressSync } from 'fflate';
import type { Barretenberg } from '@aztec/bb.js';
import { acvm } from '@noir-lang/noir_js';
import { Fr } from './fields';
import { bytesToNumber } from '@/utils';

import acvmJsBgWasmInput from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';

interface IZKProof {
	backend: string;
	abi: {
		parameters: {
			name: string;
			type: { kind: string; length?: number; type?: { kind: string }; sign?: string; width?: number };
			visibility: string;
		}[];
		param_witnesses: Record<string, number[]>;
		return_type: { kind: string } | null;
		return_witnesses?: number[];
	};
	bytecode: string;
}

export async function Noir(zkProof: IZKProof, debug: boolean = false) {
	const { Barretenberg, RawBuffer, Crs } = await import('@aztec/bb.js');

	const acirBuffer: Uint8Array = Buffer.from(zkProof.bytecode, 'base64');
	const acirBufferUncompressed: Uint8Array = decompressSync(acirBuffer);
	const api: Barretenberg = await Barretenberg.new(4);

	await acvm.default(acvmJsBgWasmInput);

	const [_exact, circuitSize, _subgroup] = await api.acirGetCircuitSizes(acirBufferUncompressed);

	const subgroupSize = Math.pow(2, Math.ceil(Math.log2(circuitSize)));
	const acirComposer = await api.acirNewAcirComposer(subgroupSize);

	const crs = await Crs.new(subgroupSize + 1);

	await Promise.all([
		api.commonInitSlabAllocator(subgroupSize),
		api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data())),
	]);

	async function generateWitness(initialWitness: Map<number, string>): Promise<Uint8Array> {
		const witnessMap = await acvm.executeCircuit(acirBuffer, initialWitness, () => {
			throw Error('unexpected oracle');
		});

		const witnessBuff = acvm.compressWitness(witnessMap);
		if (debug) console.log('witnessBuff: ', witnessBuff);
		return witnessBuff;
	}

	async function generateProof(witness: Uint8Array) {
		const proof = await api.acirCreateProof(acirComposer, acirBufferUncompressed, decompressSync(witness), false).catch(e => {
			console.error(e);
			throw e;
		});

		if (debug) console.log('proof: ', proof);
		return proof;
	}

	function extractProofPublicParams(proof: Uint8Array) {
		const accessMap = Object.fromEntries(zkProof.abi.parameters.map(p => [p.name, p.visibility === 'public']));

		const publicParamsWitnesses = Object.entries(zkProof.abi.param_witnesses).filter(([key]) => accessMap[key]);

		const orderedParamsWitnesses = publicParamsWitnesses.sort((wit1, wit2) => wit1[1][0] - wit2[1][0]);
		let count = 0;
		const remapedParamsWitnesses = orderedParamsWitnesses.map(([key, value]) => [key, value.map(() => count++)] as const);
		// const minWitnessIndex = Math.min(...publicParamsWitnesses.flatMap(([, value]) => value));
		// const adjustedWitnesses = publicParamsWitnesses.map(([key, value]) => [key, value.map((v: number) => v - minWitnessIndex)] as const);

		return Object.fromEntries(remapedParamsWitnesses.map(([key, value]) => [key, value.flatMap(i => bytesToNumber(proof.slice(i * 32, (i + 1) * 32)))]));
	}

	async function verifyProof(proof: Uint8Array) {
		await api.acirInitProvingKey(acirComposer, acirBufferUncompressed).catch(e => {
			console.error(e);
			throw e;
		});

		const verified = await api.acirVerifyProof(acirComposer, proof, false).catch(e => {
			console.error(e);
			throw e;
		});

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
