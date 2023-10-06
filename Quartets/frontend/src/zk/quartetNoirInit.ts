import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import { decompressSync, compressSync } from 'fflate';
import circuit from './target/quartets_hand_zkproof.json';
import { CARDS } from '@/utils/cards';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;

export async function quartetNoirInit() {
	const noir = await Noir(circuit);

	return {
		noir,
		async proof(hand: number[], card: number) {
			hand = hand.map(h => h + 1);
			hand = padArray(hand, 32, 0);

			const input: Record<ParamWitness, any> = {
				hand,
				handHash: (await noir.pedersenHash(hand)).value,
				card: card + 1,
				cardsPerSymbol: CARDS.length / 4,
			};

			const initialWitness = getInitialWitness(circuit.abi.param_witnesses, input);
			const witness = await noir.generateWitness(initialWitness);
			const proof = await noir.generateProof(witness);
			return compressSync(proof).join();
		},
		verify(proofStr: string) {
			const proof = decompressSync(Uint8Array.from(proofStr.split(',').map(Number)));
			return noir.verifyProof(proof);
		},
	};
}

export type QuartetNoir = Awaited<ReturnType<typeof quartetNoirInit>>;
