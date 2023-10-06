import { DrawNoir } from '@/zk/drawNoirInit';
import { PickNoir } from '@/zk/pickNoirInit';
import { QuartetNoir } from '@/zk/quartetNoirInit';
import { WonNoir } from '@/zk/wonNoirInit';

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

export interface INoirCircuits {
	drawNoir: DrawNoir;
	pickNoir: PickNoir;
	quartetNoir: QuartetNoir;
	wonNoir: WonNoir;
}
