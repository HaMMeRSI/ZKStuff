import { GameState, IGameGun } from '@/repositories/game.gun';
import { JSX, Show, createEffect, createSignal } from 'solid-js';
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
	room: IGameGun;
	leaveRoom: () => void;
}

export function Game(props: IProps) {
	const players = () => props.room.playersOrder();
	const gameState = () => props.room.gameState();
	const myTurn = () => props.player === turnOf();
	const turnOf = () => props.room.playersOrder()[props.room.turn() % props.room.playersOrder().length];
	const leftDeck = () => CARDS.map((_, i) => (!props.room.hand().includes(BigInt(i)) ? BigInt(i) : -1n)).filter(x => x !== -1n);

	const [requestedCard, setRequestedCard] = createSignal<BigInt | null>(null);
	const [requestedFrom, setRequestedFrom] = createSignal<string>('');


	createEffect(() => {
		if (!myTurn()) {
			setRequestedCard(null);
			setRequestedFrom('');
		}
	});

	return (
		<>
			<Players players={players()} player={props.player} turnOf={turnOf()} selectedPlayer={requestedFrom()} onPlayerSelect={setRequestedFrom} />
			<div style={contolsContainer}>
				<button onClick={() => props.leaveRoom()}>Leave Room</button>
				<Show when={players().length > 1 && gameState() < GameState.GAME_STARTED}>
					<button onClick={() => props.room.start()}>Start Game</button>
				</Show>
				<Show when={gameState() === GameState.GAME_STARTED}>
					<button disabled={!myTurn()} onClick={() => props.room.request(requestedFrom(), requestedCard())}>
						Request
					</button>
				</Show>
			</div>
			<div>turn: {props.room.turn()}</div>
			<Deck hand={props.room.hand()} />
			<br />
			<br />
			<Deck hand={leftDeck()} myTurn={myTurn()} onCardSelect={setRequestedCard} selectedCard={requestedCard()} />
		</>
	);
}
