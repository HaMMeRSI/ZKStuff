import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { createRef, defer, gunOn, padArray } from '@/utils';
import { IDeferedObject } from '@/utils/types';
import { CARDS } from '@/utils/cards';
import { pickNoirInit } from '@/zk/pickNoirInit';
import { quartetNoirInit } from '@/zk/quartetNoirInit';
import { wonNoirInit } from '@/zk/wonNoirInit';
import { nanoid } from 'nanoid';

export enum GameState {
	READY,
	GAME_STARTED,
}

export enum ZKStatus {
	READY = 'ready',
	PROOF_GEN = 'generating proof',
	PROOF_WAIT = 'waiting for proof',
	PROOF_VERIFY = 'verifying proof',
	PROOF_FAILED = 'proof failed',
}

export interface IGameGun {
	roomId: string;
	deck?: Accessor<BigInt[]>;
	zkStatus: Accessor<ZKStatus>;
	hand: Accessor<number[]>;
	quartets: Accessor<number[]>;
	gameState: Accessor<GameState>;
	playersOrder: Accessor<string[]>;
	winner: Accessor<string>;
	start: () => void;
	draw: () => Promise<number>;
	request: (from: string, card: number) => Promise<Boolean>;
	leave: VoidFunction;
	turn: Accessor<number>;
}

function getPlayers(roomGun: any, name: string): Promise<string> {
	return new Promise((resolve, _reject) => {
		roomGun.get('players').once((data: string, _key: any) => {
			let players = name;

			if (data) {
				players = [...data.split(',').filter(n => n !== name), name].join(',');
			}

			resolve(players);
		});
	});
}

function cardToNumber(card: number) {
	return card % (CARDS.length / 4);
}

async function gameGun(roomId: string, name: string, onLeave: VoidFunction): Promise<IGameGun> {
	const { deck, init, off, draw, shuffle } = deckGun(roomId, name);

	const [zkStatus, setZkStatus] = createSignal(ZKStatus.READY);
	const [turn, setTurn] = createSignal(0);
	const [hand, setHand] = createSignal<number[]>([]);
	const [winner, setWinner] = createSignal<string>('');
	const [quartets, setQuartets] = createSignal<number[]>([]);
	const [gameState, setGameState] = createSignal(GameState.READY);
	const [playersOrder, setPlayersOrder] = createSignal<string[]>([]);

	const roomGun = gun.get(APP).get(ROOMS).get(roomId);

	const atEnterPlayers = await getPlayers(roomGun, name);
	const [pickNoir, quartetNoir, wonNoir] = await Promise.all([pickNoirInit(), quartetNoirInit(), wonNoirInit()]);

	roomGun.get('players').put(atEnterPlayers);

	const requestCardDefer = createRef<IDeferedObject<Boolean>>();
	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};
	const handHashes: Record<string, bigint> = {};

	let oldRequest = '';
	let oldResponse = '';
	let oldWinner = '';

	const offPlayers = gunOn(roomGun.get('players'), (data: string) => setPlayersOrder(data?.split(',') ?? []));
	const offState = gunOn(roomGun.get('gameState'), async (data: GameState) => {
		if (data === GameState.GAME_STARTED) {
			await publishHandHash();
		}

		setGameState(data);
	});
	const offTurn = gunOn(roomGun.get('turn'), (turn: number) => setTurn(turn));
	const offHandHash = gunOn(roomGun.get('handHash'), (data: string) => {
		const [_name, _value] = data.split('|');
		handHashes[_name] = BigInt(_value);
	});
	const offInit = gunOn(roomGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;

		setPlayersOrder(data.playerOrder.split(','));
		init(BigInt('0x' + data.prime), data.playerOrder.split(','));
	});

	const offDrawInitial4 = gunOn(roomGun.get('draw'), async (drawCount: number) => {
		const myDrawTurn = playersOrder().indexOf(name) === drawCount % playersOrder().length;

		if (drawCount === playersOrder().length * 4) {
			draw4Defer.resolve(null);
			offDrawInitial4.current?.();
		} else if (myDrawTurn && !drawed[drawCount]) {
			drawed[drawCount] = true;
			const card = await draw();
			setHand([...hand(), card].sort((x, y) => cardToNumber(x) - cardToNumber(y)));
			roomGun.get('draw').put(drawCount + 1);
		}
	});

	const offRequestCard = gunOn(roomGun.get('request').get('card'), async (data: string) => {
		if (!data || data === oldRequest) return;
		oldRequest = data;

		const [from, reqCard] = data.split('|');
		const card = +reqCard;

		if (name === from) {
			const includes = hand().includes(card);
			roomGun.get('request').get('card').put(null);

			if (includes) {
				setHand(hand().filter(val => val !== card));
				await publishHandHash();

				roomGun
					.get('response')
					.get('card')
					.put(`${from}|1|${nanoid(4)}`);
			} else {
				setZkStatus(ZKStatus.PROOF_GEN);
				const proof = await pickNoir.proof(hand(), card);
				setZkStatus(ZKStatus.READY);

				roomGun
					.get('response')
					.get('card')
					.put(`${from}|${proof}|${nanoid(4)}}`);
			}
		}
	});

	const offResponseCard = gunOn(roomGun.get('response').get('card'), async (data: string) => {
		if (!data || data === oldResponse) return;
		oldResponse = data;
		const [from, proofStr] = data.split('|');

		if (proofStr === '1') {
			requestCardDefer.current?.resolve(true);
		} else {
			setZkStatus(ZKStatus.PROOF_VERIFY);

			pickNoir
				.verify(proofStr, handHashes[from])
				.then(() => {
					console.log('ok draw');
					setZkStatus(ZKStatus.READY);
					requestCardDefer.current?.resolve(false);
				})
				.catch(e => {
					setZkStatus(ZKStatus.PROOF_FAILED);
					console.error(e);

					console.log('CHEATER DRAW!!!!');
				});
		}
	});

	const offWinner = gunOn(roomGun.get('winner'), async (data: string) => {
		if (!data || oldWinner === data) return;
		oldWinner = data;

		const [winner, proof] = data.split('|');

		setZkStatus(ZKStatus.PROOF_VERIFY);

		await wonNoir
			.verify(proof, handHashes[winner])
			.then(() => {
				console.log('ok won');
				setZkStatus(ZKStatus.READY);
			})
			.catch(() => {
				setZkStatus(ZKStatus.PROOF_FAILED);
				console.log('CHEATER WON!!!!');
			});

		setWinner(winner);
	});

	function addToHand(card: number) {
		setHand([...hand(), card].sort((x, y) => cardToNumber(x) - cardToNumber(y)));
	}

	async function endTurn() {
		const nextTurn = turn() + 1;
		let newCard = -1;
		if (nextTurn < CARDS.length) {
			newCard = await draw();
			addToHand(newCard);
		}

		roomGun.get('turn').put(nextTurn);
		return newCard;
	}

	async function handleQuartet() {
		const quartet = cardToNumber(hand().filter(card => hand().filter(c => cardToNumber(c) === cardToNumber(card)).length === 4)[0]);

		if (quartet >= 0) {
			const postHand = hand()
				.filter(card => cardToNumber(card) !== quartet)
				.sort((x, y) => cardToNumber(x) - cardToNumber(y));

			const won = postHand.length === 0;

			setZkStatus(ZKStatus.PROOF_GEN);
			const proofGen = won ? wonNoir.proof : quartetNoir.proof;
			const proof = await proofGen(hand(), quartet);

			setQuartets([...quartets(), quartet]);
			setHand(postHand);
			setZkStatus(ZKStatus.READY);

			return [won, proof];
		}

		return [false];
	}

	function publishHandHash() {
		return new Promise(async resolve => {
			const handarr = padArray(
				hand().map(h => h + 1),
				32,
				0
			);
			const { value: hash } = await pickNoir.noir.pedersenHash(handarr);
			roomGun.get('handHash').put(`${name}|${hash}`, _ => resolve(null));
		});
	}

	return {
		deck,
		zkStatus,
		hand,
		quartets,
		turn,
		winner,
		roomId,
		playersOrder,
		gameState,
		draw: endTurn,
		async request(from: string, card: number) {
			if (!from || card < 0) return false;

			requestCardDefer.current = defer<Boolean>();
			roomGun
				.get('request')
				.get('card')
				.put(`${from}|${card}|${nanoid(4)}`);

			setZkStatus(ZKStatus.PROOF_WAIT);
			const res = await requestCardDefer.current;
			setZkStatus(ZKStatus.READY);

			res ? addToHand(card) : await endTurn();
			await publishHandHash();

			const [won, proof] = await handleQuartet();
			if (won) {
				roomGun.get('winner').put([name, proof, nanoid(4)].join('|'));
			} else {
				// TODO: handle quartet proof publish
				await publishHandHash();
			}

			return res;
		},
		start() {
			const { randomNBitPrime } = shamir3pass();
			const excluded = playersOrder().filter(val => val !== name);

			const playerOrder = [name, ...excluded].join(',');

			roomGun.get('init').put({ prime: randomNBitPrime(8).toString(16), playerOrder }, _ =>
				shuffle(async () => {
					roomGun.get('draw').put(0);
					await draw4Defer;
					roomGun.get('gameState').put(GameState.GAME_STARTED);
				})
			);
		},
		leave() {
			const afterPlayers = playersOrder().filter(val => val !== name);

			if (afterPlayers.length === 0) {
				offPlayers.current?.();
				offTurn.current?.();
				offState.current?.();
				offInit.current?.();
				offDrawInitial4.current?.();
				offRequestCard.current?.();
				offResponseCard.current?.();
				offWinner.current?.();
				offHandHash.current?.();

				roomGun.get('players').put(null);
				roomGun.get('turn').put(null);
				roomGun.get('gameState').put(null);
				roomGun.get('init').put({ prime: null, playerOrder: null });

				pickNoir.noir.destroy();
				quartetNoir.noir.destroy();
				wonNoir.noir.destroy();
			} else {
				roomGun.get('players').put(afterPlayers.join(','));
			}

			off();
			onLeave();
		},
	};
}

export default function (roomId: string, name: string, onLeave: VoidFunction) {
	let room: ReturnType<typeof gameGun> | null = null;

	if (!room) {
		room = gameGun(roomId, name, onLeave);
	}

	return room;
}
