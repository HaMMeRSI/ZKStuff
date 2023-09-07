import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import './App.css';
import { shamir3pass } from 'shamir3pass';
import RoomsGun from './repositories/rooms.gun';
import { createRef } from './utils';

function App() {
	const { activeRoom, join, roomIds } = RoomsGun();
	const leaveRoom = createRef<VoidFunction>();

	const [name, setName] = createSignal('');

	createEffect(() => {
		// const a = gun.get(name()).on((data: any, key: any) => {
		//     console.log('realtime updates:', data, key);
		// });
		// const intervalID = setInterval(() => gun.get(name()).get('live').put(Math.random()), 1000);
		// onCleanup(() => {
		//     clearInterval(intervalID);
		//     a.off();
		// });
	});

	function createRoom() {
		if (name()) {
			leaveRoom.current = join(name());
		}
	}

	window.onbeforeunload = () => leaveRoom.current?.();

	return (
		<div>
			<h1>Hello {name()}!</h1>
			<Show when={!activeRoom()}>
				<input type="text" value={name()} onInput={e => setName(e.currentTarget.value)} />
				<br />
			</Show>
			<Show when={!activeRoom()}>
				<For each={roomIds()}>
					{roomId => (
						<div>
							{roomId}
							<button onClick={() => name() && (leaveRoom.current = join(name(), roomId))}>Join</button>
						</div>
					)}
				</For>
				<button onClick={createRoom}>Create Room</button>
			</Show>
			<Show when={activeRoom()}>
				<For each={Object.entries(activeRoom()?.players() ?? {})}>{([player, active]) => active && <div>{player}</div>}</For>
				<button onClick={() => leaveRoom.current?.()}>Leave Room</button>
				<Show when={!activeRoom()?.players()?.lenght}>
					<button onClick={() => {}}>Start Game</button>
				</Show>
			</Show>
		</div>
	);
}

export default App;
