import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import circuit from './target/pick_hand_zkproof.json';
import { decompressSync, compressSync } from 'fflate';
import { CARDS } from '@/utils/cards';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;
async function execute(noir: any, input: Record<ParamWitness, any>) {
	const initialWitness = getInitialWitness(circuit.abi.param_witnesses, input);
	console.log('0x' + input.handHash.toString(16));

	const witness = await noir.generateWitness(initialWitness);
	const proof = await noir.generateProof(witness);

	console.log(compressSync(proof));
	console.log(decompressSync(compressSync(proof)));

	const verification = await noir.verifyProof(proof);

	console.log(verification);

	await noir.destroy();
}

let hand = [1, 4, 7, 10];
hand = hand.map(card => card + 0);
hand = padArray(hand, 32, 0);
export async function zkQuartetsExample() {
	const noir = await Noir(circuit);

	return execute(noir, {
		hand,
		handHash: (await noir.pedersenHash(hand)).value,
		card: 7 + 1,
		cardsPerSymbol: CARDS.length / 4,
	});
}
