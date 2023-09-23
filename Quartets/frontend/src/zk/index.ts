// import circuit from './quartets_hand_zkproof.json';
// import { decompressSync } from 'fflate';
// import { Buffer } from 'buffer';
// import { Crs, newBarretenbergApiAsync, RawBuffer } from '@aztec/bb.js/dest/node/index.js';
// import initACVM, { executeCircuit, compressWitness } from '@noir-lang/acvm_js';
// import { ethers } from 'ethers'; // I'm lazy so I'm using ethers to pad my input

// export async function quartetsZk() {
// 	await initACVM();
// 	const acirBuffer = Buffer.from(circuit.bytecode, 'base64');
// 	const acirBufferUncompressed = decompressSync(acirBuffer);

// 	const api = await newBarretenbergApiAsync(4);

// 	// const [exact, circuitSize, subgroup] = await api.acirGetCircuitSizes(acirBufferUncompressed);
// 	const [, circuitSize] = await api.acirGetCircuitSizes(acirBufferUncompressed);
// 	const subgroupSize = Math.pow(2, Math.ceil(Math.log2(circuitSize)));
// 	const crs = await Crs.new(subgroupSize + 1);
// 	await api.commonInitSlabAllocator(subgroupSize);
// 	await api.srsInitSrs(new RawBuffer(crs.getG1Data()), crs.numPoints, new RawBuffer(crs.getG2Data()));

// 	const acirComposer = await api.acirNewAcirComposer(subgroupSize);

// 	async function generateWitness(input: any, acirBuffer: Buffer): Promise<Uint8Array> {
// 		const initialWitness = new Map<number, string>();
// 		initialWitness.set(1, ethers.utils.hexZeroPad(`0x${input.x.toString(16)}`, 32));
// 		initialWitness.set(2, ethers.utils.hexZeroPad(`0x${input.y.toString(16)}`, 32));

// 		const witnessMap = await executeCircuit(acirBuffer, initialWitness, () => {
// 			throw Error('unexpected oracle');
// 		});

// 		const witnessBuff = compressWitness(witnessMap);
// 		return witnessBuff;
// 	}

// 	async function generateProof(witness: Uint8Array) {
// 		const proof = await api.acirCreateProof(acirComposer, acirBufferUncompressed, decompressSync(witness), false);
// 		return proof;
// 	}

// 	async function verifyProof(proof: Uint8Array) {
// 		await api.acirInitProvingKey(acirComposer, acirBufferUncompressed);
// 		const verified = await api.acirVerifyProof(acirComposer, proof, false);
// 		return verified;
// 	}

// 	async function test() {
// 		const input = {
// 			card: 23,
// 			hand: [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 			handHash: [
// 				54, 238, 82, 11, 108, 68, 186, 108, 12, 242, 71, 39, 15, 236, 24, 186, 59, 108, 253, 246, 138, 4, 122, 197, 38, 129, 45, 75, 201, 185, 107, 199,
// 			],
// 		};
// 		const witness = await generateWitness(input, acirBuffer);
// 		console.log('Witness generated!');
// 		const proof = await generateProof(witness);
// 		console.log('Proof generated!');
// 		await verifyProof(proof);
// 		console.log('Proof verified!');
// 		api.destroy();
// 	}

// 	return test;
// }
