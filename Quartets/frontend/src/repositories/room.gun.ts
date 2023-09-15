import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { gunOn } from '@/utils';

export enum GameState {
	READY,
	GAME_STARTED,
}

export interface IRoomGun {
	roomId: string;
	deck?: Accessor<BigInt[]>;
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
	const [turn, setTurn] = createSignal(0);
	const [playersOrder, setPlayersOrder] = createSignal<string[]>([]);
	const { deck, init, off, draw, shuffle } = deckGun(roomId, name);

	const roomGun = gun.get(APP).get(ROOMS).get(roomId);
	const atEnterPlayers = await getPlayers(roomGun);
	roomGun.get('players').put(atEnterPlayers ? [...atEnterPlayers.split(',').filter(n => n !== name), name].join(',') : name);

	const offTurn = gunOn(roomGun.get('turn'), (data: number) => setTurn(data));
	const offPlayers = gunOn(roomGun.get('players'), (data: string) => setPlayersOrder(data.split(',')));
	const offState = gunOn(roomGun.get('gameState'), (data: GameState) => setGameState(data));
	const offInit = gunOn(roomGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;
		setPlayersOrder(data.playerOrder.split(','));
		init(BigInt('0x' + data.prime), data.playerOrder.split(','));
	});

	return {
		deck,
		turn,
		roomId,
		playersOrder,
		gameState,
		draw: () => {
			draw(turn());
			roomGun.get('turn').put(turn() + 1);
		},
		start() {
			const { randomNBitPrime } = shamir3pass();
			const excluded = playersOrder().filter(val => val !== name);

			const playerOrder = [name, ...excluded].join(',');

			roomGun
				.get('init')
				.put({ prime: randomNBitPrime(8).toString(16), playerOrder }, _ => shuffle(() => roomGun.get('gameState').put(GameState.GAME_STARTED)));
		},
		leave() {
			const afterPlayers = playersOrder().filter(val => val !== name);

			if (afterPlayers.length === 0) {
				offPlayers.current?.();
				offTurn.current?.();
				offState.current?.();
				offInit.current?.();
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
