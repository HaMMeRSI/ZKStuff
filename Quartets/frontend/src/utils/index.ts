export function createRef<T>(initial?: T) {
	return {
		current: initial,
	};
}
