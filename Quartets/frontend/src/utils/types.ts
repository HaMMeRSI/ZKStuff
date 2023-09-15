export type Ref<T> = {
	current?: T;
};

export interface IDeferedObject<T> extends Promise<T> {
	resolve: (arg: T) => void;
	reject: (arg: unknown) => void;
}

export interface IPubSub<T> {
	action: string;
	data?: T;
}
