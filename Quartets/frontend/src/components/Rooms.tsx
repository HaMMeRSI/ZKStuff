import { Index } from 'solid-js';

interface IProps {
	rooms: string[];
	join: (roomId: string) => void;
	create: VoidFunction;
}

export function Rooms(props: IProps) {
	return (
		<>
			<Index each={props.rooms}>
				{roomId => (
					<div>
						{roomId()}
						<button onClick={() => props.join(roomId())}>Join</button>
					</div>
				)}
			</Index>
			<button onClick={props.create}>Create Room</button>
		</>
	);
}
