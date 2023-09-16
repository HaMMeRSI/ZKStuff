import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { createRef, defer, gunOn } from '@/utils';
import { IDeferedObject } from '@/utils/types';

export enum GameState {
	READY,
	GAME_STARTED,
}

export interface IGameGun {
	roomId: string;
	deck?: Accessor<BigInt[]>;
	hand: Accessor<BigInt[]>;
	gameState: Accessor<GameState>;
	playersOrder: Accessor<string[]>;
	start: () => void;
	draw: () => Promise<BigInt>;
	request: (from: string, card: BigInt | null) => Promise<Boolean>;
	leave: VoidFunction;
	turn: Accessor<number>;
}

function getPlayers(roomGun: any): Promise<string> {
	return new Promise((resolve, _reject) => {
		roomGun.get('players').once((data: string, _key: any) => {
			resolve(data);
		});
	});
}

async function gameGun(roomId: string, name: string, onLeave: VoidFunction): Promise<IGameGun> {
	const [gameState, setGameState] = createSignal(GameState.READY);
	const [hand, setHand] = createSignal<BigInt[]>([]);
	const [turn, setTurn] = createSignal(0);
	const [playersOrder, setPlayersOrder] = createSignal<string[]>([]);
	const { deck, init, off, draw, shuffle } = deckGun(roomId, name);

	const roomGun = gun.get(APP).get(ROOMS).get(roomId);
	const atEnterPlayers = await getPlayers(roomGun);
	roomGun.get('players').put(atEnterPlayers ? [...atEnterPlayers.split(',').filter(n => n !== name), name].join(',') : name);

	const offPlayers = gunOn(roomGun.get('players'), (data: string) => setPlayersOrder(data?.split(',') ?? []));
	const offState = gunOn(roomGun.get('gameState'), (data: GameState) => setGameState(data));
	const offTurn = gunOn(roomGun.get('turn'), (data: number) => setTurn(data));
	const offInit = gunOn(roomGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;
		setPlayersOrder(data.playerOrder.split(','));
		init(BigInt('0x' + data.prime), data.playerOrder.split(','));
	});

	const requestCardDefer = createRef<IDeferedObject<Boolean>>();
	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};

	const offDraw4 = gunOn(roomGun.get('draw'), async (turn: number) => {
		const myTurn = playersOrder().indexOf(name) === turn % playersOrder().length;
		const nextTurn = turn + 1;

		if (turn === playersOrder().length * 4) {
			draw4Defer.resolve(null);
			offDraw4.current?.();
		} else if (myTurn && !drawed[turn]) {
			drawed[turn] = true;

			const card = await draw();
			setHand([...hand(), card]);
			roomGun.get('draw').put(nextTurn);
		}
	});

	const offRequestCard = gunOn(roomGun.get('request').get('card'), async (data: string) => {
		if (!data) return;

		const [from, reqCard] = data.split('|');
		const card = BigInt('0x' + reqCard);

		if (name === from) {
			const includes = hand().includes(card);
			if (includes) {
				setHand(hand().filter(val => val !== card));
			}

			roomGun.get('request').get('card').put(null);
			roomGun.get('response').get('card').put(includes);
		}
	});

	const offResponseCard = gunOn(roomGun.get('response').get('card'), (data: Boolean) => {
		requestCardDefer.current?.resolve(data);
	});

	async function drawCard() {
		const newCard = await draw();
		setHand([...hand(), newCard]);

		return newCard;
	}

	return {
		deck,
		hand,
		turn,
		roomId,
		playersOrder,
		gameState,
		draw: drawCard,
		async request(from: string, card: BigInt | null) {
			if (!card || !from) return false;

			requestCardDefer.current = defer<Boolean>();
			roomGun
				.get('request')
				.get('card')
				.put(`${from}|${card.toString(16)}`);

			const res = await requestCardDefer.current;

			if (res) {
				setHand([...hand(), card]);
			} else {
				roomGun.get('turn').put(turn() + 1);
				await drawCard();
			}

			return res;
		},
		start() {
			const { randomNBitPrime } = shamir3pass();
			const excluded = playersOrder().filter(val => val !== name);

			const playerOrder = [name, ...excluded].join(',');

			roomGun.get('init').put({ prime: randomNBitPrime(8).toString(16), playerOrder }, _ =>
				shuffle(async () => {
					roomGun.get('draw').put(0);
					await draw4Defer;

					roomGun.get('turn').put(playersOrder().length * 4, () => {
						roomGun.get('gameState').put(GameState.GAME_STARTED);
					});
				})
			);
		},
		leave() {
			const afterPlayers = playersOrder().filter(val => val !== name);

			if (afterPlayers.length === 0) {
				offPlayers.current?.();
				offTurn.current?.();
				offState.current?.();
				offInit.current?.();
				offDraw4.current?.();
				offRequestCard.current?.();
				offResponseCard.current?.();

				roomGun.get('players').put(null);
				roomGun.get('turn').put(null);
				roomGun.get('gameState').put(null);
				roomGun.get('init').put({ prime: null, playerOrder: null });
			} else {
				roomGun.get('players').put(afterPlayers.join(','));
			}

			off();
			onLeave();
		},
	};
}

export default function (roomId: string, name: string, onLeave: VoidFunction) {
	let room: ReturnType<typeof gameGun> | null = null;

	if (!room) {
		room = gameGun(roomId, name, onLeave);
	}

	return room;
}
