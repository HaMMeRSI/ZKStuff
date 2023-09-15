import { Show, createSignal } from 'solid-js';
import './App.css';
import RoomsGun from './repositories/rooms.gun';
import { Welcome } from './components/Welcome';
import { Rooms } from './components/Rooms';
import { Room } from './components/Room';

function App() {
	const { activeRoom, join, roomIds } = RoomsGun();
	const [name, setName] = createSignal('');
	const [leaveRoom, setLeaveRoom] = createSignal(() => {});

	const hasActiveRoom = () => !!activeRoom();
	window.onbeforeunload = () => leaveRoom();

	async function onJoin(roomId: string) {
		if (name()) {
			const leave = await join(name(), roomId);
			setLeaveRoom(() => leave);
		}
	}

	async function createRoom() {
		if (name()) {
			const leave = await join(name());
			setLeaveRoom(() => leave);
		}
	}

	return (
		<div>
			<h1>Hello {name() || 'Guest'}!</h1>
			<Show when={!hasActiveRoom()}>
				<Welcome name={name()} setName={setName} />
				<Rooms join={onJoin} create={createRoom} rooms={[...roomIds().values()]} />
			</Show>
			<Show when={hasActiveRoom()}>
				<Room room={activeRoom()!} leaveRoom={leaveRoom()} player={name()} />
			</Show>
		</div>
	);
}

export default App;
