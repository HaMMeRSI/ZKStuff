import { Noir } from './noir';
import { getInitialWitness, padArray } from '@/utils';
import { decompressSync, compressSync } from 'fflate';
import circuit from './target/draw_zkproof.json';

type ParamWitness = keyof typeof circuit.abi.param_witnesses;

export async function DrawNoirNoirInit() {
	const noir = await Noir(circuit);

	return {
		noir,
		async proof(decryptedCard: number, encryptedCard: bigint, keys: bigint[], prime: bigint, oldHand: number[]) {
			const newHand = [...oldHand].concat(Number(decryptedCard)).map(h => h + 1);

			const input: Record<ParamWitness, any> = {
				newHash: (await noir.pedersenHash(padArray(newHand, 32, 0))).value,
				oldHand: padArray(oldHand.map(h => h + 1), 32, 0),
				keys: padArray(keys, 8, 0n),
				encryptedCard,
				prime,
			};

			const initialWitness = getInitialWitness(circuit.abi.param_witnesses, input);
			const witness = await noir.generateWitness(initialWitness);
			const proof = await noir.generateProof(witness);

			return [input.newHash, compressSync(proof).join()];
		},
		verify(proofStr: string, _handHash: bigint, _encryptedCard: bigint, _prime: bigint) {
			const proof = decompressSync(Uint8Array.from(proofStr.split(',').map(Number)));
			const { encryptedCard, prime, newHash } = noir.extractProofPublicParams(proof);

			if (encryptedCard[0] !== _encryptedCard || newHash[0] !== _handHash || prime[0] !== _prime) {
				throw new Error('handHash does not match');
			}

			return noir.verifyProof(proof);
		},
	};
}

export type DrawNoir = Awaited<ReturnType<typeof DrawNoirNoirInit>>;
