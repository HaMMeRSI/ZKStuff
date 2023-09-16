import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { defer, gunOn } from '@/utils';

export enum GameState {
	READY,
	GAME_STARTED,
}

export interface IRoomGun {
	roomId: string;
	deck?: Accessor<BigInt[]>;
	hand: Accessor<BigInt[]>;
	gameState: Accessor<GameState>;
	playersOrder: Accessor<string[]>;
	start: () => void;
	draw: VoidFunction;
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

async function roomGun(roomId: string, name: string, onLeave: VoidFunction): Promise<IRoomGun> {
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

	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};

	const offDraw = gunOn(roomGun.get('draw'), async (turn: number) => {
		const myTurn = playersOrder().indexOf(name) === turn % playersOrder().length;
		const nextTurn = turn + 1;

		if (turn === playersOrder().length * 4) {
			draw4Defer.resolve(null);
			offDraw.current?.();
		} else if (myTurn && !drawed[turn]) {
			drawed[turn] = true;

			const card = await draw(turn);
			setHand([...hand(), card]);
			roomGun.get('draw').put(nextTurn);
		}
	});

	return {
		deck,
		hand,
		turn,
		roomId,
		playersOrder,
		gameState,
		async draw() {
			const newCard = await draw(turn());
			setHand([...hand(), newCard]);
			roomGun.get('turn').put(turn() + 1);
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
				offDraw.current?.();
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
	let room: ReturnType<typeof roomGun> | null = null;

	if (!room) {
		room = roomGun(roomId, name, onLeave);
	}

	return room;
}
