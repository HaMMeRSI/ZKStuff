import { blake2s } from '@noble/hashes/blake2s';
import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import circuit from './quartets_hand_zkproof.json';
import { decompressSync, compressSync } from 'fflate';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;
async function execute(input: Record<ParamWitness, any>) {
	const noir = await Noir();

	const initialWitness = getInitialWitness(circuit.abi.param_witnesses, input);

	const witness = await noir.generateWitness(initialWitness);
	const proof = await noir.generateProof(witness);

	console.log(compressSync(proof));
	console.log(decompressSync(compressSync(proof)));

	const verification = await noir.verifyProof(proof);

	console.log(verification);

	await noir.destroy();
}

let hand = [3, 4, 1, 2, 5, 6];
hand = hand.map(card => card + 1);
hand = padArray(hand, 32);
export function zkQuartetsExample() {
	execute({
		hand,
		handHash: blake2s(Uint8Array.from(hand)),
		card: 32 + 1,
	});
}
