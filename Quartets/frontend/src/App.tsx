import { For, Show, createSignal } from 'solid-js';
import './App.css';
import RoomsGun from './repositories/rooms.gun';
import { createRef } from './utils';
import { GameState } from './repositories/deck.gun';

function App() {
	const { activeRoom, join, roomIds } = RoomsGun();
	const leaveRoom = createRef<VoidFunction>();

	const [name, setName] = createSignal('');

	async function createRoom() {
		if (name()) {
			leaveRoom.current = await join(name());
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
				<For each={[...roomIds().values()]}>
					{roomId => (
						<div>
							{roomId}
							<button onClick={async () => name() && (leaveRoom.current = await join(name(), roomId))}>Join</button>
						</div>
					)}
				</For>
				<button onClick={createRoom}>Create Room</button>
			</Show>
			<Show when={activeRoom()}>
				<For each={(activeRoom()?.players() ?? '').split(',')}>{player => <div>{player}</div>}</For>
				<button onClick={() => leaveRoom.current?.()}>Leave Room</button>
				<Show when={(activeRoom()?.players()?.split(',').length ?? 0) > 1 && (activeRoom()?.gameState() ?? 0) < GameState.GAME_STARTED}>
					<button onClick={() => activeRoom()?.start()}>Start Game</button>
				</Show>
				<Show when={(activeRoom()?.gameState() ?? 0) === GameState.GAME_STARTED}>
					<button onClick={() => activeRoom()?.draw()}>Draw</button>
				</Show>
			</Show>
			<Show when={activeRoom()?.players()?.length}>
				<For each={activeRoom()?.deck?.() ?? []}>{item => <span>{item.toString()},</span>}</For>
			</Show>
		</div>
	);
}

export default App;
