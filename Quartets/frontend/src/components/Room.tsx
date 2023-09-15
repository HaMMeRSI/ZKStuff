import { GameState, IRoomGun } from '@/repositories/room.gun';
import { JSX, Show } from 'solid-js';
import { Players } from './Players';

const contolsContainer: JSX.CSSProperties = {
	display: 'flex',
	'justify-content': 'space-evenly',
	'align-items': 'center',
	gap: '10px',
	margin: '10px',
};

interface IProps {
	player: string;
	room: IRoomGun;
	leaveRoom: () => void;
}

export function Room(props: IProps) {
	const players = () => props.room.playersOrder();
	const gameState = () => props.room.gameState();
	const turnOf = () => props.room.playersOrder()[props.room.turn() % props.room.playersOrder().length];

	return (
		<>
			<Players players={players()} player={props.player} turnOf={turnOf()} />
			<div style={contolsContainer}>
				<button onClick={() => props.leaveRoom()}>Leave Room</button>
				<Show when={players().length > 1 && gameState() < GameState.GAME_STARTED}>
					<button onClick={() => props.room.start()}>Start Game</button>
				</Show>
				<Show when={gameState() === GameState.GAME_STARTED}>
					<button onClick={() => props.room.draw()}>Draw</button>
				</Show>
			</div>
		</>
	);
}
