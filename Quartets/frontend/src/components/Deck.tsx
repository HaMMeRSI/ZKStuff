import { CARDS } from '@/utils/cards';
import { JSX } from 'solid-js/jsx-runtime';

const deckContainer: JSX.CSSProperties = {
	'max-width': '380px',
	display: 'flex',
	'flex-wrap': 'wrap',
	gap: '10px',
	'justify-content': 'space-between',
	'max-height': '230px',
	overflow: 'auto',
	padding: '5px',
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
	hand: number[];

	onCardSelect?(card: number): void;
	selectedCard?: number;
	myTurn?: boolean;
}

export function Deck(props: IProps) {
	return (
		<div style={deckContainer}>
			{props.hand.map(x => (
				<div onClick={() => props.myTurn && props.onCardSelect?.(x)} style={cardContainer(props.myTurn ?? false, props.selectedCard === x)}>
					{CARDS[Number(x)]}
				</div>
			))}
		</div>
	);
}
