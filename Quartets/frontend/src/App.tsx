// @ts-nocheck
import { Show, createSignal } from 'solid-js';
import './App.css';
import RoomsGun from './repositories/rooms.gun';
import { Welcome } from './components/Welcome';
import { Rooms } from './components/Rooms';
import { Game } from './components/Game';
import { pickNoirInit } from './zk/pickNoirInit';
import { quartetNoirInit } from './zk/quartetNoirInit';
import { wonNoirInit } from './zk/wonNoirInit';
import { INoirCircuits } from './utils/types';
import { DrawNoirNoirInit } from './zk/drawNoirInit';

function App() {
	const { activeRoom, join, roomIds } = RoomsGun();
	const [name, setName] = createSignal('');
	const [leaveRoom, setLeaveRoom] = createSignal(() => {});
	const [noirCircuits, setNoirCircuits] = createSignal<INoirCircuits>(undefined as any);

	const hasActiveRoom = () => !!activeRoom();
	window.onbeforeunload = () => leaveRoom()();

	async function onJoin(roomId: string) {
		if (name()) {
			const leave = await join(name(), noirCircuits, roomId);
			setLeaveRoom(() => leave);
		}
	}

	async function createRoom() {
		if (name()) {
			const leave = await join(name(), noirCircuits);
			setLeaveRoom(() => leave);
		}
	}

	Promise.all([pickNoirInit(), quartetNoirInit(), wonNoirInit(), DrawNoirNoirInit()]).then(([pickNoir, quartetNoir, wonNoir, drawNoir]) =>
		setNoirCircuits(() => ({ pickNoir, quartetNoir, wonNoir, drawNoir }))
	);

	return (
		<div>
			<h1>Hello {name() || 'Guest'}!</h1>
			<Show when={!noirCircuits()}>Loading..</Show>
			<Show when={!hasActiveRoom() && !!noirCircuits()}>
				<Welcome name={name()} setName={setName} />
				<Rooms join={onJoin} create={createRoom} rooms={[...roomIds().values()]} />
			</Show>
			<Show when={hasActiveRoom()}>
				<Game room={activeRoom()!} leaveRoom={leaveRoom()} player={name()} noirCircuits={noirCircuits()} />
			</Show>
		</div>
	);
}

export default App;
