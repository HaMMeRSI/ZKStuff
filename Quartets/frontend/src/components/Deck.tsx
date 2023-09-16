const DIAMOND = '♦';
const SPADE = '♠';
const CLUB = '♣';
const HEART = '♥';
const CARDS = [
	'A' + DIAMOND,
	'2' + DIAMOND,
	'3' + DIAMOND,
	'4' + DIAMOND,
	'5' + DIAMOND,
	'6' + DIAMOND,
	'7' + DIAMOND,
	'8' + DIAMOND,
	'9' + DIAMOND,
	'10' + DIAMOND,
	'J' + DIAMOND,
	'Q' + DIAMOND,
	'K' + DIAMOND,
	'A' + SPADE,
	'2' + SPADE,
	'3' + SPADE,
	'4' + SPADE,
	'5' + SPADE,
	'6' + SPADE,
	'7' + SPADE,
	'8' + SPADE,
	'9' + SPADE,
	'10' + SPADE,
	'J' + SPADE,
	'Q' + SPADE,
	'K' + SPADE,
	'A' + CLUB,
	'2' + CLUB,
	'3' + CLUB,
	'4' + CLUB,
	'5' + CLUB,
	'6' + CLUB,
	'7' + CLUB,
	'8' + CLUB,
	'9' + CLUB,
	'10' + CLUB,
	'J' + CLUB,
	'Q' + CLUB,
	'K' + CLUB,
	'A' + HEART,
	'2' + HEART,
	'3' + HEART,
	'4' + HEART,
	'5' + HEART,
	'6' + HEART,
	'7' + HEART,
	'8' + HEART,
	'9' + HEART,
	'10' + HEART,
	'J' + HEART,
	'Q' + HEART,
	'K' + HEART,
];

interface IProps {
	hand: BigInt[];
}

export function Deck(props: IProps) {
	console.log(CARDS.length);

	return (
		<div
			style={{
				'max-width': '300px',
				overflow: 'auto',
				padding: '10px',
			}}>
			{props.hand.map(card => (
				<span>{CARDS[Number(card)]},</span>
			))}
		</div>
	);
}
