import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import circuit from './quartets_hand_zkproof.json';
import { decompressSync, compressSync } from 'fflate';
import { blake2s } from '@noble/hashes/blake2s';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;

export async function handNoir() {
	const noir = await Noir();

	return {
		destroy: noir.destroy,
		async proof(hand: number[], card: number) {
			hand = hand.map(h => h + 1);
			hand = padArray(hand, 32);

			const input: Record<ParamWitness, any> = {
				hand,
				handHash: blake2s(Uint8Array.from(hand)),
				card: card + 1,
			};

			const initialWitness = getInitialWitness(circuit.abi.param_witnesses, input);
			const witness = await noir.generateWitness(initialWitness);
			const proof = await noir.generateProof(witness);
			return compressSync(proof).join(',');
		},
		async verify(proofStr: string) {
			const proof = decompressSync(Uint8Array.from(proofStr.split(',').map(Number)));
			return await noir.verifyProof(proof);
		},
	};
}
