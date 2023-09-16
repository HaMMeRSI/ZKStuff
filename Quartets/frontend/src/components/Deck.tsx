import { CARDS } from '@/utils/cards';
import { createSignal } from 'solid-js';
import { JSX } from 'solid-js/jsx-runtime';

const deckContainer: JSX.CSSProperties = {
	'max-width': '380px',
	display: 'flex',
	'flex-wrap': 'wrap',
	gap: '10px',
	'justify-content': 'space-between',
	'max-height': '230px',
	overflow: 'auto',
};

const cardContainer = (myTurn: boolean, selected: Boolean): JSX.CSSProperties => {
	return {
		border: '1px solid gray',
		outline: selected ? '3px solid green' : 'none',
		padding: '10px',
		'border-radius': '10px',
		'font-size': '1.5em',
		'font-weight': 'bold',
		'user-select': 'none',
		width: '45px',
		cursor: myTurn ? 'pointer' : 'default',
	};
};

interface IProps {
	hand: BigInt[];
	onSelect?(card: BigInt): void;
	myTurn?: boolean;
}

export function Deck(props: IProps) {
	const [selectedCard, setSelectedCard] = createSignal<BigInt>(-1n);

	return (
		<div style={deckContainer}>
			{props.hand.map(x => (
				<div onClick={() => props.myTurn && setSelectedCard(x)} style={cardContainer(props.myTurn ?? false, selectedCard() === x)}>
					{CARDS[Number(x)]}
				</div>
			))}
		</div>
	);
}
