import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, PLAYERS, ROOMS } from './tables.index';

type Players = Record<string, boolean>;

export interface IRoomGun {
	roomId: string;
	players: Accessor<Players>;
	join(name: string): () => void;
}

function roomGun(roomId: string): IRoomGun {
	const [players, setPlayers] = createSignal<Players>({});

	const playersGun = gun.get(APP).get(ROOMS).get(roomId).get(PLAYERS);

	const playersListener = playersGun.on((data: Players, _key: any) => {
		const { _, ...rest } = data ?? {};
		setPlayers(rest);
	});

	return {
		roomId,
		players,
		join(name: string) {
			playersGun.put({ [name]: true });

			return () => {
				playersGun.put({ [name]: null });
				playersListener.off();
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
