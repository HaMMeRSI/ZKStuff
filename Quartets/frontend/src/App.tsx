import { Show, createSignal } from 'solid-js';
import './App.css';
import RoomsGun from './repositories/rooms.gun';
import { Welcome } from './components/Welcome';
import { Rooms } from './components/Rooms';
import { Game } from './components/Game';
import { blake2s } from '@noble/hashes/blake2s';
import { quartetsZk } from './zk';

function App() {
	const { activeRoom, join, roomIds } = RoomsGun();
	const [name, setName] = createSignal('');
	const [leaveRoom, setLeaveRoom] = createSignal(() => {});

	const hasActiveRoom = () => !!activeRoom();
	window.onbeforeunload = () => leaveRoom()();
	// const hand = [3, 4, 12, 56];
	// const u8Hand = Uint8Array.from(hand);
	// console.log('hand', hand);
	// const hash = blake2s(u8Hand);

	// console.log(
	// 	'hash',
	// 	Array.from(hash).map(x => +x)
	// );

	quartetsZk().then(async doer => {
		console.log('er');
		
		await doer();
	});

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
				<Game room={activeRoom()!} leaveRoom={leaveRoom()} player={name()} />
			</Show>
		</div>
	);
}

export default App;
