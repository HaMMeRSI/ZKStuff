import { gun } from '@/gun';
import { APP, DECKS as DECK, KEYS, REQUEST, ROOMS } from './tables.index';
import { Key, keyFromString, shamir3pass } from 'shamir3pass';
import { Accessor, createSignal } from 'solid-js';
import { RSA } from '@/utils';
import { Ref } from '@/utils/types';

export enum GameState {
	NOT_ENCRYPTED,
	ENCRYPTED,
	EACH_ENCRYPTED,
	GAME_STARTED,
}

function toDeck(deck: string) {
	return deck.split(',').map(card => BigInt(card));
}

function toGunDeck(deck: BigInt[]) {
	return deck.join(',');
	// return deck.reduce((acc, val, i) => {
	// 	acc[i] = val.toString();
	// 	return acc;
	// }, {} as GunDeck);
}

export interface IDecksGun {
	deck: Accessor<BigInt[]>;
	gameState: Accessor<GameState>;
	init: () => void;
	draw: VoidFunction;
	off: VoidFunction;
}

interface IRequestPayload {
	type: 'draw';
	player: string;
	turn: number;
	publicRsa: JsonWebKey;
}

function deckGun(roomId: string, players: Accessor<string>, name: Ref<string>): IDecksGun {
	const { encrypt, decrypt, generateKeyFromPrime, randomNBitPrime } = shamir3pass();
	const rsa = RSA();

	const [deck, setDeck] = createSignal<BigInt[]>(Array.from(new Array(52), (_, i) => BigInt(i + 2)));
	const [turn, setTurn] = createSignal(0);
	const [gameState, setGameState] = createSignal(GameState.NOT_ENCRYPTED);

	let prime = 0n;
	let key: Key | null = null;
	let eachKey: string[] = [];
	let playerOrder: string[] = [];
	let turnOf = '';

	let publicRsa: JsonWebKey;
	let privateRsa: JsonWebKey;

	rsa.generateKey().then(({ privateKey, publicKey }) => {
		publicRsa = publicKey;
		privateRsa = privateKey;
		console.log('gen', publicRsa.n?.slice(-10));
	});

	const deckGun = gun.get(APP).get(ROOMS).get(roomId).get(DECK);
	const requestGun = gun.get(APP).get(ROOMS).get(roomId).get(DECK).get(REQUEST);
	const keysGun = gun.get(APP).get(ROOMS).get(roomId).get(DECK).get(KEYS);

	deckGun.get('turn').on((data: number) => setTurn(data));
	deckGun.get('gameState').on((data: GameState) => setGameState(data));
	deckGun.get('prime').on((data: string, _, __, e) => {
		prime = BigInt('0x' + data);
		e.off();
	});
	deckGun.get('playerOrder').on((data: string, _, __, e) => {
		playerOrder = data.split(',');
		e.off();
	});
	deckGun.get('deck').on((data: string, _, __, e) => {
		const [turn, deckStr] = data.split('|');

		const deck = toDeck(deckStr);
		setDeck(deck);

		const myTurn = playerOrder.indexOf(name.current ?? '') === +turn;
		const nextTurn = (+turn + 1) % playerOrder.length;

		if (myTurn) {
			if (gameState() === GameState.NOT_ENCRYPTED) {
				console.log('NOT_ENCRYPTED', turn);
				key = generateKeyFromPrime(prime);
				eachKey = deck.map(_ => generateKeyFromPrime(prime!).toString());
				setGameState(GameState.ENCRYPTED);

				const encryptedDeck = deck.map(card => encrypt(card, key!)).sort(() => Math.random() - 0.5);

				deckGun.get('deck').put(`${nextTurn}|` + toGunDeck(encryptedDeck));
			} else if (gameState() === GameState.ENCRYPTED) {
				console.log('ENCRYPTED', turn);
				const decryptedDeck = deck.map(card => decrypt(card, key!));
				const eachEncryptedDeck = decryptedDeck.map((card, i) => encrypt(card, keyFromString(eachKey![i])));
				setGameState(GameState.EACH_ENCRYPTED);
				setDeck(eachEncryptedDeck);

				deckGun.get('deck').put(`${nextTurn}|` + toGunDeck(eachEncryptedDeck));
			} else if (gameState() === GameState.EACH_ENCRYPTED) {
				console.log('EACH_ENCRYPTED', turn);

				if (+turn === 0) {
					deckGun.get('gameState').put(GameState.GAME_STARTED);
				} else {
					deckGun.get('deck').put(`${nextTurn}|${deckStr}`);
				}

				e.off();
			}
		}
	});

	requestGun.on(async (data: string, _key: any) => {
		const { type, turn, publicRsa, player } = JSON.parse(data || '{}') as IRequestPayload;
		turnOf = player;

		if (name.current && type === 'draw') {
			const message = new TextEncoder().encode(eachKey![turn].toString());
			const encrypted = await rsa.encrypt(message, publicRsa);

			keysGun.get(name.current).put(encrypted.join(','));
		}
	});

	keysGun.on(async (data: Record<string, any>, _key: any) => {
		const { _, ...rest } = data;

		const ok = Object.values(rest).filter(val => !!val).length === playerOrder?.length;

		if (ok && turnOf === name.current) {
			turnOf = '';

			function decode(str: string) {
				const arr = str.split(',').map(val => +val);
				const u8 = Uint8Array.from(arr);

				return rsa.decrypt(u8, privateRsa);
			}

			const keys = await Promise.all(playerOrder.map(player => decode(data[player] ?? eachKey![turn()].toString())));
			const decoder = new TextDecoder();
			const decryptedKeys = keys.map(key => decoder.decode(key));

			const card = deck()[turn()];
			const decrypted = decryptedKeys.reduce((acc, val) => decrypt(acc, keyFromString(val)), card);
			console.log(turn(), decrypted.valueOf() - 2n);
			requestGun.put(null);
			deckGun.get('turn').put(turn() + 1);

			const nulled = Object.fromEntries(Object.entries(rest).map(([key]) => [key, null]));
			keysGun.put(nulled);
		}
	});

	return {
		deck,
		gameState,
		init() {
			const pOrder = [
				name.current,
				...players()
					.split(',')
					.filter(val => val !== name.current),
			].join(',');

			deckGun.get('prime').put(randomNBitPrime(8).toString(16));
			deckGun.get('playerOrder').put(pOrder);
			deckGun.get('turn').put(0);
			deckGun.get('deck').put(`1|${toGunDeck(deck())}`);
		},
		draw() {
			if (name.current) {
				requestGun.put(JSON.stringify({ type: 'draw', player: name.current, turn: turn(), publicRsa }));
			}
		},
		off() {
			deckGun.off();
			requestGun.off();
			keysGun.off();
		},
	};
}

export default function (roomId: string, players: Accessor<string>, name: Ref<string>) {
	let decks: ReturnType<typeof deckGun> | null = null;

	if (!decks) {
		decks = deckGun(roomId, players, name);
	}

	return decks;
}
