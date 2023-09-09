import { gun } from '@/gun';
import { nanoid } from 'nanoid';
import roomGun, { IRoomGun } from './room.gun';
import { APP, ROOMS } from './tables.index';
import { Accessor, createSignal } from 'solid-js';

export interface IRoomsGun {
	roomIds: Accessor<Set<string>>;
	activeRoom: Accessor<IRoomGun | undefined>;
	join(name: string, roomId?: string): Promise<VoidFunction>;
}

function roomsGun(): IRoomsGun {
	const roomsGun = gun.get(APP).get(ROOMS);
	const [roomIds, setRoomIds] = createSignal<Set<string>>(new Set());
	const [activeRoom, setActiveRoom] = createSignal<IRoomGun>();

	roomsGun.map().on((data: Record<string, boolean>, key: any) => {
		const set = new Set([...roomIds().values()]);
		data.players ? set.add(key) : set.delete(key);
		setRoomIds(set);
	});

	return {
		roomIds,
		activeRoom,
		async join(name: string, roomId?: string) {
			if (activeRoom()) {
				throw new Error("Can't create room while already in a room");
			} else if (!roomId) {
				roomId = nanoid();
			}

			const room = roomGun(roomId);
			const leave = await room.join(name);
			setActiveRoom(room);

			return () => {
				leave();
				setActiveRoom();
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
