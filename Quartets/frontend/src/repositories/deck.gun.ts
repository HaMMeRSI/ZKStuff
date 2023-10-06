import { gun } from '@/gun';
import { APP, DECKS as DECK, KEYS, REQUEST, ROOMS } from './tables.index';
import { Key, keyFromString, shamir3pass } from 'shamir3pass';
import { Accessor, createSignal } from 'solid-js';
import { RSA, defer, gunOn } from '@/utils';
import { IDeferedObject } from '@/utils/types';
import { CARDS } from '@/utils/cards';

export enum ShuffleState {
	NOT_ENCRYPTED,
	ENCRYPTED,
	EACH_ENCRYPTED,
	DRAW1,
	DRAW2,
	DRAW3,
	DRAW4,
}

function toDeck(deck: string) {
	return deck.split(',').map(card => BigInt(card));
}

interface IDrawResult {
	card: number;
	encryptedCard: bigint;
	keys: Key[];
}

interface IRequestPayload {
	type: 'draw';
	requestedBy: string;
	drawCount: number;
	publicKeyRsa: JsonWebKey;
}

export interface IDecksGun {
	deck: Accessor<BigInt[]>;
	init: (prime: BigInt, order: string[]) => void;
	draw: () => Promise<IDrawResult>;
	off: () => void;
	shuffle: () => Promise<bigint[]>;
}

function deckGun(roomId: string, player: string): IDecksGun {
	const { encrypt, decrypt, generateKeyFromPrime } = shamir3pass();

	const [shuffleState, setShuffleState] = createSignal<ShuffleState>(ShuffleState.NOT_ENCRYPTED);
	const [deck, setDeck] = createSignal<bigint[]>(Array.from(new Array(CARDS.length), (_, i) => BigInt(i + 2)));

	const rsa = RSA();
	let drawDefer: IDeferedObject<IDrawResult>;
	let shuffleDefer: IDeferedObject<bigint[]>;
	let key: Key;
	let eachKey: string[] = [];
	let playerOrder: string[] = [];
	let drawCount = -1;
	let requestedBy = '';
	let prime = 0n;

	let publicKeyRsa: JsonWebKey;
	let privateKeyRsa: JsonWebKey;

	rsa.generateKey().then(({ privateKey, publicKey }) => {
		publicKeyRsa = publicKey;
		privateKeyRsa = privateKey;
	});

	const drawRequestGun = gun.get(APP).get(ROOMS).get(roomId).get(REQUEST).get('draw');
	const roomDeckGun = gun.get(APP).get(ROOMS).get(roomId).get(DECK);
	const deckGun = roomDeckGun.get('deck');
	const keysGun = roomDeckGun.get(KEYS);

	const offShuffle = gunOn(deckGun, async (data: string) => {
		if (!data) {
			return;
		}

		const [turn, deckStr] = data.split('|');

		const deck = toDeck(deckStr);
		setDeck(deck);

		const myTurn = playerOrder.indexOf(player) === +turn;
		const nextTurn = (+turn + 1) % playerOrder.length;

		if (myTurn) {
			if (shuffleState() === ShuffleState.NOT_ENCRYPTED) {
				console.log('NOT_ENCRYPTED', turn);
				key = generateKeyFromPrime(prime);
				eachKey = deck.map(_ => generateKeyFromPrime(prime!).toString());
				const encryptedDeck = deck.map(card => encrypt(card, key!)).sort(() => Math.random() - 0.5);

				deckGun.put(`${nextTurn}|` + encryptedDeck.join());
				setShuffleState(ShuffleState.ENCRYPTED);
			} else if (shuffleState() === ShuffleState.ENCRYPTED) {
				console.log('ENCRYPTED', turn);
				const decryptedDeck = deck.map(card => decrypt(card, key!));
				const eachEncryptedDeck = decryptedDeck.map((card, i) => encrypt(card, keyFromString(eachKey![i])));

				setDeck(eachEncryptedDeck);

				deckGun.put(`${nextTurn}|` + eachEncryptedDeck.join());
				setShuffleState(ShuffleState.EACH_ENCRYPTED);
			} else if (shuffleState() === ShuffleState.EACH_ENCRYPTED) {
				console.log('EACH_ENCRYPTED', turn);

				if (+turn === 0) {
					shuffleDefer?.resolve(deck);
				} else {
					deckGun.put(`${nextTurn}|${deckStr}`);
				}
			}
		}
	});

	const drawRequestOff = gunOn(drawRequestGun, async (data: string, _key: any) => {
		if (!data) {
			return;
		}

		const { drawCount: _drawCount, publicKeyRsa, requestedBy: _requestedBy } = JSON.parse(data) as IRequestPayload;
		requestedBy = _requestedBy;
		drawCount = _drawCount;

		const message = new TextEncoder().encode(eachKey[drawCount].toString());
		const encrypted = await rsa.encrypt(message, publicKeyRsa);

		keysGun.get(player).put(encrypted.join());
	});

	const keysoff = gunOn(keysGun, async (data: Record<string, any>, _key: any) => {
		const { _, ...encodedKeys } = data;
		const ok = Object.values(encodedKeys).filter(Boolean).length === playerOrder?.length && requestedBy === player;

		if (ok) {
			const decoder = new TextDecoder();
			requestedBy = '';

			function decode(str: string) {
				const arr = str.split(',').map(Number);
				const u8 = Uint8Array.from(arr);

				return rsa.decrypt(u8, privateKeyRsa);
			}

			const keys = await Promise.all(playerOrder.map(player => decode(data[player] ?? eachKey[drawCount].toString())));
			const decryptedKeys = keys.map(key => keyFromString(decoder.decode(key)));

			const card = deck()[drawCount];
			const decrypted = decryptedKeys.reduce((acc, val) => decrypt(acc, val), card);
			const nulled = Object.fromEntries(Object.entries(encodedKeys).map(([key]) => [key, null]));

			drawRequestGun.put(null);
			keysGun.put(nulled, () =>
				drawDefer.resolve({
					keys: decryptedKeys,
					encryptedCard: card,
					card: Number(decrypted.valueOf() - 2n),
				})
			);
		}
	});

	return {
		deck,
		init(_prime: BigInt, order: string[]) {
			prime = _prime.valueOf();
			playerOrder = order;
		},
		shuffle() {
			shuffleDefer = defer();
			deckGun.put(`1|${deck().join()}`);
			return shuffleDefer;
		},
		async draw() {
			drawDefer = defer();
			drawRequestGun.put(JSON.stringify({ type: 'draw', requestedBy: player, drawCount: drawCount + 1, publicKeyRsa }));
			return drawDefer;
		},
		off() {
			drawRequestOff.current?.();
			offShuffle.current?.();
			keysoff.current?.();
			drawRequestGun.put(null);
			deckGun.put(null);
		},
	};
}

export default function (roomId: string, player: string) {
	let decks: ReturnType<typeof deckGun> | null = null;

	if (!decks) {
		decks = deckGun(roomId, player);
	}

	return decks;
}
