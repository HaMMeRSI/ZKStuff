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
	FINAL_ENCRYPTION_ROUND,
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

interface IShufleTurnPayload {
	turn: number;
	deck: string;
	prime: string;
	playerOrder: string;
	gameState: GameState;
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

	deckGun.on((data: IShufleTurnPayload, _key: any) => {
		const deck = toDeck(data.deck);
		playerOrder = data.playerOrder.split(',');
		prime = BigInt(data.prime);
		setDeck(deck);

		const myTurn = playerOrder.indexOf(name.current ?? '') === data.turn;
		const nextTurn = (data.turn + 1) % playerOrder.length;

		if (data.gameState === GameState.GAME_STARTED) {
			setTurn(data.turn);
			setGameState(GameState.GAME_STARTED);
		} else if (myTurn) {
			if (gameState() === GameState.NOT_ENCRYPTED) {
				console.log('NOT_ENCRYPTED', data.turn);
				key = generateKeyFromPrime(prime);
				eachKey = deck.map(_ => generateKeyFromPrime(prime!).toString());
				setGameState(GameState.ENCRYPTED);

				const encryptedDeck = deck.map(card => encrypt(card, key!)).sort(() => Math.random() - 0.5);

				deckGun.put({ prime: data.prime, deck: toGunDeck(encryptedDeck), playerOrder: data.playerOrder, turn: nextTurn });
			} else if (gameState() === GameState.ENCRYPTED) {
				console.log('ENCRYPTED', data.turn);
				const decryptedDeck = deck.map(card => decrypt(card, key!));
				const eachEncryptedDeck = decryptedDeck.map((card, i) => encrypt(card, keyFromString(eachKey![i])));
				setGameState(GameState.EACH_ENCRYPTED);
				setDeck(eachEncryptedDeck);

				deckGun.put({ prime: data.prime, deck: toGunDeck(eachEncryptedDeck), playerOrder: data.playerOrder, turn: nextTurn });
			} else if (gameState() === GameState.EACH_ENCRYPTED) {
				console.log('EACH_ENCRYPTED', data.turn);
				if (data.turn === 0) {
					setGameState(GameState.FINAL_ENCRYPTION_ROUND);
				}

				deckGun.put({ prime: data.prime, deck: data.deck, playerOrder: data.playerOrder, turn: nextTurn });
			} else if (gameState() === GameState.FINAL_ENCRYPTION_ROUND) {
				console.log('FINAL_ENCRYPTION_ROUND', data.turn);

				deckGun.put({ gameState: GameState.GAME_STARTED, turn: 0 });
			}
		}
	});

	requestGun.on(async (data: string, _key: any) => {
		const { type, turn, publicRsa, player } = JSON.parse(data || '{}') as IRequestPayload;
		turnOf = player;

		if (name.current && type === 'draw') {
			const message = new TextEncoder().encode(eachKey![turn].toString());
			const encrypted = await rsa.encrypt(message, publicRsa);
			keysGun.put({ [name.current]: encrypted.join(',') });
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
			requestGun.put('');
			deckGun.put({ turn: turn() + 1 });

			const nulled = Object.fromEntries(Object.entries(rest).map(([key]) => [key, null]));
			keysGun.put(nulled);
		}
	});

	return {
		deck,
		gameState,
		init() {
			deckGun.put({ prime: randomNBitPrime(8).toString(), deck: toGunDeck(deck()), playerOrder: players(), turn: 0 });
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
