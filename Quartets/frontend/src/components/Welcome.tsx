interface IProps {
	name: string;
	setName: (name: string) => void;
}

export function Welcome(props: IProps) {
	return (
		<>
			<input type="text" value={props.name} onInput={e => props.setName(e.currentTarget.value)} placeholder="Enter Name" />
			<br />
		</>
	);
}
