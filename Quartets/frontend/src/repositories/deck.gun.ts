import { gun } from '@/gun';
import { APP, DECKS as DECK, KEYS, REQUEST, ROOMS } from './tables.index';
import { Key, keyFromString, shamir3pass } from 'shamir3pass';
import { Accessor, createSignal } from 'solid-js';
import { RSA, createRef, defer, gunOn } from '@/utils';
import { IDeferedObject, Ref } from '@/utils/types';
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

function toGunDeck(deck: BigInt[]) {
	return deck.join(',');
}

export interface IDecksGun {
	deck: Accessor<BigInt[]>;
	init: (prime: BigInt, order: string[]) => void;
	draw: () => Promise<number>;
	off: () => void;
	shuffle: (onEnd: VoidFunction) => void;
}

interface IRequestPayload {
	type: 'draw';
	requestedBy: string;
	drawCount: number;
	publicRsa: JsonWebKey;
}

function deckGun(roomId: string, player: string): IDecksGun {
	const rsa = RSA();
	const { encrypt, decrypt, generateKeyFromPrime } = shamir3pass();

	const [shuffleState, setShuffleState] = createSignal<ShuffleState>(ShuffleState.NOT_ENCRYPTED);
	const [deck, setDeck] = createSignal<BigInt[]>(Array.from(new Array(CARDS.length), (_, i) => BigInt(i + 2)));

	let drawDefer: Ref<IDeferedObject<number>> = createRef();
	let key: Key;
	let eachKey: string[] = [];
	let playerOrder: string[] = [];
	let drawCount = -1;
	let requestedBy = '';
	let prime = 0n;
	let onShuffleEnd = () => {};

	let publicRsa: JsonWebKey;
	let privateRsa: JsonWebKey;

	rsa.generateKey().then(({ privateKey, publicKey }) => {
		publicRsa = publicKey;
		privateRsa = privateKey;
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

				deckGun.put(`${nextTurn}|` + toGunDeck(encryptedDeck));
				setShuffleState(ShuffleState.ENCRYPTED);
			} else if (shuffleState() === ShuffleState.ENCRYPTED) {
				console.log('ENCRYPTED', turn);
				const decryptedDeck = deck.map(card => decrypt(card, key!));
				const eachEncryptedDeck = decryptedDeck.map((card, i) => encrypt(card, keyFromString(eachKey![i])));
				setDeck(eachEncryptedDeck);

				deckGun.put(`${nextTurn}|` + toGunDeck(eachEncryptedDeck));
				setShuffleState(ShuffleState.EACH_ENCRYPTED);
			} else if (shuffleState() === ShuffleState.EACH_ENCRYPTED) {
				console.log('EACH_ENCRYPTED', turn);

				if (+turn === 0) {
					onShuffleEnd();
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

		const { drawCount: _drawCount, publicRsa, requestedBy: _requestedBy } = JSON.parse(data) as IRequestPayload;
		requestedBy = _requestedBy;
		drawCount = _drawCount;

		const message = new TextEncoder().encode(eachKey[drawCount].toString());
		const encrypted = await rsa.encrypt(message, publicRsa);

		keysGun.get(player).put(encrypted.join(','));
	});

	const keysoff = gunOn(keysGun, async (data: Record<string, any>, _key: any) => {
		const { _, ...encodedKeys } = data;
		const ok = Object.values(encodedKeys).filter(Boolean).length === playerOrder?.length && requestedBy === player;
		const decoder = new TextDecoder();

		if (ok) {
			requestedBy = '';

			function decode(str: string) {
				const arr = str.split(',').map(Number);
				const u8 = Uint8Array.from(arr);

				return rsa.decrypt(u8, privateRsa);
			}

			const keys = await Promise.all(playerOrder.map(player => decode(data[player] ?? eachKey[drawCount].toString())));
			const decryptedKeys = keys.map(key => decoder.decode(key));

			const card = deck()[drawCount];
			const decrypted = decryptedKeys.reduce((acc, val) => decrypt(acc, keyFromString(val)), card);
			const nulled = Object.fromEntries(Object.entries(encodedKeys).map(([key]) => [key, null]));

			drawRequestGun.put(null);
			keysGun.put(nulled, () => drawDefer.current!.resolve(Number(decrypted.valueOf() - 2n)));
		}
	});

	return {
		deck,
		init(_prime: BigInt, order: string[]) {
			prime = _prime.valueOf();
			playerOrder = order;
		},
		shuffle(onEnd: VoidFunction) {
			deckGun.put(`1|${toGunDeck(deck())}`);
			onShuffleEnd = onEnd;
		},
		async draw() {
			drawDefer.current = defer();
			drawRequestGun.put(JSON.stringify({ type: 'draw', requestedBy: player, drawCount: drawCount + 1, publicRsa }));
			return drawDefer.current;
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
