import { GameState, IRoomGun } from '@/repositories/room.gun';
import { JSX, Show, createSignal } from 'solid-js';
import { Players } from './Players';
import { Deck } from './Deck';
import { CARDS } from '@/utils/cards';

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
	const myTurn = () => props.player === turnOf();

	const leftDeck = () => CARDS.map((_, i) => (!props.room.hand().includes(BigInt(i)) ? BigInt(i) : -1n)).filter(x => x !== -1n);

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
			<div>turn: {props.room.turn()}</div>
			<Deck hand={props.room.hand()} />
			<br />
			<br />
			<Deck hand={leftDeck()} myTurn={myTurn()} />
		</>
	);
}
