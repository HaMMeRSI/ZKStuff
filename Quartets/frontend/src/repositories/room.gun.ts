import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, PLAYERS, ROOMS } from './tables.index';
import deckGun, { GameState } from './deck.gun';
import { createRef } from '@/utils';

export interface IRoomGun {
	deck?: Accessor<BigInt[]>;
	gameState: Accessor<GameState>;
	roomId: string;
	players: Accessor<string>;
	join(name: string): Promise<() => void>;
	start: () => void;
	draw: VoidFunction;
}

function getPlayers(roomGun: any): Promise<string> {
	return new Promise((resolve, _reject) => {
		roomGun.get(PLAYERS).once((data: string, _key: any) => {
			resolve(data);
		});
	});
}

function roomGun(roomId: string): IRoomGun {
	let playerName = createRef('');
	const [players, setPlayers] = createSignal<string>('');
	const { deck, init, gameState, off, draw } = deckGun(roomId, players, playerName);

	const roomGun = gun.get(APP).get(ROOMS).get(roomId);
	const playersGun = gun.get(APP).get(ROOMS).get(roomId).get(PLAYERS);
	const playersListener = roomGun.on((data: Record<string, string>, _key: any) => {
		const { players } = data ?? {};

		setPlayers(players);
	});

	return {
		draw,
		deck,
		roomId,
		players,
		gameState,
		start() {
			init();
		},
		async join(name: string) {
			playerName.current = name;
			const aplayers = await getPlayers(roomGun);

			playersGun.put(aplayers ? [...aplayers.split(',').filter(n => n !== name), name].join(',') : name);

			return () => {
				playersListener.off();
				playersGun.off();
				roomGun.off();
				off();

				const afterPlayers = players()
					.split(',')
					.filter(val => val !== name);

				if (afterPlayers.length === 0) {
					playersGun.put(null);
				} else {
					playersGun.put(afterPlayers.join(','));
				}
			};
		},
	};
}

export default function (roomId: string) {
	let room: ReturnType<typeof roomGun> | null = null;

	if (!room) {
		room = roomGun(roomId);
	}

	return room;
}
