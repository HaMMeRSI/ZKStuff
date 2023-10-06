import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import { decompressSync, compressSync } from 'fflate';
import { CARDS } from '@/utils/cards';
import circuit from './target/pick_hand_zkproof.json';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;

export async function pickNoirInit() {
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
		verify(proofStr: string, _handHash: bigint) {
			const proof = decompressSync(Uint8Array.from(proofStr.split(',').map(Number)));
			const { handHash } = noir.extractProofPublicParams(proof);

			if (handHash[0] !== _handHash) {
				throw new Error('handHash does not match');
			}

			return noir.verifyProof(proof);
		},
	};
}

export type PickNoir = Awaited<ReturnType<typeof pickNoirInit>>;
