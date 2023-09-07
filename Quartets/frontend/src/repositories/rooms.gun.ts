import { gun } from '@/gun';
import { nanoid } from 'nanoid';
import roomGun, { IRoomGun } from './room.gun';
import { APP, ROOMS } from './tables.index';
import { Accessor, createSignal } from 'solid-js';

export interface IRoomsGun {
	roomIds: Accessor<string[]>;
	activeRoom: Accessor<IRoomGun | undefined>;
	join(name: string, roomId?: string): VoidFunction;
}

function roomsGun(): IRoomsGun {
	const roomsGun = gun.get(APP).get(ROOMS);
	const [roomIds, setRoomIds] = createSignal<string[]>([]);
	const [activeRoom, setActiveRoom] = createSignal<IRoomGun>();

	roomsGun.on((data: Record<string, boolean>, _key: any) => {
		const { _, ...rest } = data ?? {};
		console.log('rooms Listner', rest);

		setRoomIds(Object.keys(rest));
	});

	return {
		roomIds,
		activeRoom,
		join(name: string, roomId?: string) {
			if (activeRoom()) {
				throw new Error("Can't create room while already in a room");
			} else if (!roomId) {
				roomId = nanoid();
			}

			const room = roomGun(roomId);
			const leave = room.join(name);
			setActiveRoom(room);

			return () => {
				setActiveRoom();
				leave();
			};
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
