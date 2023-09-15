import { For, createSignal } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

const container: JSX.CSSProperties = {
	display: 'flex',
	'justify-content': 'space-evenly',
	'align-items': 'center',
	gap: '10px',
	margin: '10px',
};
const playerContainer: (name: string, player: string, turn: string, selected: string) => JSX.CSSProperties = (
	name: string,
	player: string,
	turn: string,
	selectedPlayer: string
) => {
	const selected = selectedPlayer === player;
	const myTurn = turn === name;
	const turnOf = turn === player;

	return {
		'background-color': turnOf && !myTurn ? 'yellow' : 'white',
		border: `1px solid ${myTurn && selected ? 'green' : 'black'}`,
		padding: '10px',
		'border-radius': '10px',
		'font-size': '1.5em',
		'font-weight': 'bold',
		cursor: myTurn ? 'pointer' : 'default',
		'user-select': 'none',
	};
};

interface IProps {
	players: string[];
	player: string;
	turnOf: string;
}

export function Players(props: IProps) {
	const [selectedPlayer, setSelectedPlayer] = createSignal<string>('');

	function select(selected: string) {
		if (props.player !== selected && props.turnOf === props.player) {
			if (selectedPlayer() === selected) {
				setSelectedPlayer('');
			} else {
				setSelectedPlayer(selected);
			}
		}
	}

	return (
		<div style={container}>
			<For each={props.players}>
				{player => (
					<div onClick={() => select(player)} style={playerContainer(props.player, player, props.turnOf, selectedPlayer())}>
						{player}
					</div>
				)}
			</For>
		</div>
	);
}
