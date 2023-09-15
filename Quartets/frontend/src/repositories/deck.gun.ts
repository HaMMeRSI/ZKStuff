import { gun } from '@/gun';
import { APP, DECKS as DECK, KEYS, REQUEST, ROOMS } from './tables.index';
import { Key, keyFromString, shamir3pass } from 'shamir3pass';
import { Accessor, createSignal } from 'solid-js';
import { RSA, gunOn } from '@/utils';

export enum ShuffleState {
	NOT_ENCRYPTED,
	ENCRYPTED,
	EACH_ENCRYPTED,
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
	draw: (turn: number) => void;
	off: () => void;
	clean: VoidFunction;
	shuffle: (onEnd: VoidFunction) => void;
}

interface IRequestPayload {
	type: 'draw';
	requestedBy: string;
	turn: number;
	publicRsa: JsonWebKey;
}

function deckGun(roomId: string, player: string): IDecksGun {
	const rsa = RSA();
	const { encrypt, decrypt, generateKeyFromPrime } = shamir3pass();

	const [shuffleState, setShuffleState] = createSignal<ShuffleState>(ShuffleState.NOT_ENCRYPTED);
	const [deck, setDeck] = createSignal<BigInt[]>(Array.from(new Array(52), (_, i) => BigInt(i + 2)));

	let key: Key;
	let eachKey: string[] = [];
	let playerOrder: string[] = [];
	let turnOf = '';
	let turn = 0;
	let prime = 0n;
	let onShuffleEnd = () => {};

	let publicRsa: JsonWebKey;
	let privateRsa: JsonWebKey;

	rsa.generateKey().then(({ privateKey, publicKey }) => {
		publicRsa = publicKey;
		privateRsa = privateKey;
	});

	const requestGun = gun.get(APP).get(ROOMS).get(roomId).get(REQUEST).get('draw');
	const roomDeckGun = gun.get(APP).get(ROOMS).get(roomId).get(DECK);
	const deckGun = roomDeckGun.get('deck');
	const keysGun = roomDeckGun.get(KEYS);

	const offShuffle = gunOn(deckGun, (data: string) => {
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

	const requestOff = gunOn(requestGun, async (data: string, _key: any) => {
		if (!data) {
			return;
		}

		const { turn: turnN, publicRsa, requestedBy } = JSON.parse(data) as IRequestPayload;
		turnOf = requestedBy;
		turn = turnN;

		const message = new TextEncoder().encode(eachKey![turn].toString());
		const encrypted = await rsa.encrypt(message, publicRsa);

		keysGun.get(player).put(encrypted.join(','));
	});

	const keysoff = gunOn(keysGun, async (data: Record<string, any>, _key: any) => {
		const { _, ...rest } = data;

		const ok = Object.values(rest).filter(val => !!val).length === playerOrder?.length && turnOf === player;

		if (ok) {
			turnOf = '';

			function decode(str: string) {
				const arr = str.split(',').map(val => +val);
				const u8 = Uint8Array.from(arr);

				return rsa.decrypt(u8, privateRsa);
			}

			const keys = await Promise.all(playerOrder.map(player => decode(data[player] ?? eachKey![turn].toString())));
			const decoder = new TextDecoder();
			const decryptedKeys = keys.map(key => decoder.decode(key));

			const card = deck()[turn];
			const decrypted = decryptedKeys.reduce((acc, val) => decrypt(acc, keyFromString(val)), card);
			console.log(turn, decrypted.valueOf() - 2n);
			requestGun.put(null);

			const nulled = Object.fromEntries(Object.entries(rest).map(([key]) => [key, null]));
			keysGun.put(nulled);
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
		draw(turn: number) {
			requestGun.put(JSON.stringify({ type: 'draw', requestedBy: player, turn, publicRsa }));
		},
		off() {
			requestOff.current?.();
			offShuffle.current?.();
			keysoff.current?.();
			requestGun.put(null);
			deckGun.put(null);
		},
		clean() {},
	};
}

export default function (roomId: string, player: string) {
	let decks: ReturnType<typeof deckGun> | null = null;

	if (!decks) {
		decks = deckGun(roomId, player);
	}

	return decks;
}
