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
	hand: Accessor<number[]>;
	quartets: Accessor<number[]>;
	gameState: Accessor<GameState>;
	playersOrder: Accessor<string[]>;
	start: () => void;
	draw: () => Promise<number>;
	request: (from: string, card: number) => Promise<Boolean>;
	leave: VoidFunction;
	turn: Accessor<number>;
}

function getPlayers(roomGun: any, name: string): Promise<string> {
	return new Promise((resolve, _reject) => {
		roomGun.get('players').once((data: string, _key: any) => {
			let players = name;

			if (data) {
				players = [...data.split(',').filter(n => n !== name), name].join(',');
			}

			resolve(players);
		});
	});
}

async function gameGun(roomId: string, name: string, onLeave: VoidFunction): Promise<IGameGun> {
	const { deck, init, off, draw, shuffle } = deckGun(roomId, name);

	const [turn, setTurn] = createSignal(0);
	const [hand, setHand] = createSignal<number[]>([]);
	const [quartets, setQuartets] = createSignal<number[]>([]);
	const [gameState, setGameState] = createSignal(GameState.READY);
	const [playersOrder, setPlayersOrder] = createSignal<string[]>([]);

	const roomGun = gun.get(APP).get(ROOMS).get(roomId);
	const atEnterPlayers = await getPlayers(roomGun, name);

	const offPlayers = gunOn(roomGun.get('players'), (data: string) => setPlayersOrder(data?.split(',') ?? []));
	const offState = gunOn(roomGun.get('gameState'), (data: GameState) => setGameState(data));
	const offTurn = gunOn(roomGun.get('turn'), (data: number) => setTurn(data));
	const offInit = gunOn(roomGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;
		setPlayersOrder(data.playerOrder.split(','));
		init(BigInt('0x' + data.prime), data.playerOrder.split(','));
	});

	roomGun.get('players').put(atEnterPlayers);

	const requestCardDefer = createRef<IDeferedObject<Boolean>>();
	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};

	const offDraw4 = gunOn(roomGun.get('draw'), async (turn: number) => {
		const myTurn = playersOrder().indexOf(name) === turn % playersOrder().length;
		const nextTurn = turn + 1;

		if (turn === playersOrder().length * 24) {
			draw4Defer.resolve(null);
			offDraw4.current?.();
		} else if (myTurn && !drawed[turn]) {
			drawed[turn] = true;

			const card = await draw();
			setHand([...hand(), card].sort((x, y) => (x % 13) - (y % 13)));
			roomGun.get('draw').put(nextTurn);
		}
	});

	const offRequestCard = gunOn(roomGun.get('request').get('card'), async (data: string) => {
		if (!data) return;

		const [from, reqCard] = data.split('|');
		const card = +reqCard;

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
		roomGun.get('turn').put(turn() + 1);
		const newCard = await draw();
		setHand([...hand(), newCard].sort((x, y) => (x % 13) - (y % 13)));

		return newCard;
	}

	function handleQuartet() {
		const quartet = hand().filter(card => hand().filter(c => c % 13 === card % 13).length === 4)[0] % 13;

		if (quartet) {
			setQuartets([...quartets(), quartet]);
			setHand(
				hand()
					.filter(card => card % 13 !== quartet)
					.sort((x, y) => (x % 13) - (y % 13))
			);
		}

		console.log(quartets());
	}

	return {
		deck,
		hand,
		quartets,
		turn,
		roomId,
		playersOrder,
		gameState,
		draw: drawCard,
		async request(from: string, card: number) {
			if (!from || card < 0) return false;

			requestCardDefer.current = defer<Boolean>();
			roomGun.get('request').get('card').put(`${from}|${card}`);

			const res = await requestCardDefer.current;

			if (res) {
				setHand([...hand(), card].sort((x, y) => (x % 13) - (y % 13)));
			} else {
				await drawCard();
			}

			handleQuartet();

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
