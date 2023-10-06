import { gun } from '@/gun';
import { nanoid } from 'nanoid';
import gameGun, { GameState, IGameGun } from './game.gun';
import { APP, ROOMS } from './tables.index';
import { Accessor, createSignal } from 'solid-js';
import { INoirCircuits } from '@/utils/types';

export interface IRoomsGun {
	roomIds: Accessor<Set<string>>;
	activeRoom: Accessor<IGameGun | undefined>;
	join(name: string, noirCircuits: Accessor<INoirCircuits>, roomId?: string): Promise<VoidFunction>;
}

function roomsGun(): IRoomsGun {
	const roomsGun = gun.get(APP).get(ROOMS);
	const [gameIds, setGameIds] = createSignal<Set<string>>(new Set());
	const [activeGame, setActiveGame] = createSignal<IGameGun>();

	roomsGun.map().on((data: Record<string, GameState>, key: any) => {
		const set = new Set([...gameIds().values()]);

		const included = [GameState.WON, null].includes(data.gameState);
		included ? set.delete(key) : set.add(key);

		setGameIds(set);
	});

	return {
		roomIds: gameIds,
		activeRoom: activeGame,
		async join(name: string, noirCircuits: Accessor<INoirCircuits>, gameId?: string) {
			if (activeGame()) {
				throw new Error("Can't create room while already in a room");
			} else if (!gameId) {
				gameId = nanoid();
			}

			const newGame = await gameGun(gameId, name, () => setActiveGame(), noirCircuits);
			setActiveGame(newGame);

			return newGame.leave;
		},
	};
}

export default function () {
	let rooms: ReturnType<typeof roomsGun> | null = null;

	if (!rooms) {
		rooms = roomsGun();
	}

	return rooms;
}
