import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { createRef, defer, gunOn } from '@/utils';
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

	const offPlayers = gunOn(roomGun.get('players'), (data: string) => setPlayersOrder(data?.split(',') ?? []));
	const offState = gunOn(roomGun.get('gameState'), (data: GameState) => setGameState(data));
	const offTurn = gunOn(roomGun.get('turn'), (data: number) => setTurn(data));
	const offInit = gunOn(roomGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;
		setPlayersOrder(data.playerOrder.split(','));
		init(BigInt('0x' + data.prime), data.playerOrder.split(','));
	});

	roomGun.get('players').put(atEnterPlayers);

	const requestCardDefer = createRef<IDeferedObject<Boolean>>();
	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};

	let oldRequest = '';
	let oldResponse = '';
	let oldWinner = '';

	function addToHand(card: number) {
		setHand([...hand(), card].sort((x, y) => cardToNumber(x) - cardToNumber(y)));
	}

	const offDraw4 = gunOn(roomGun.get('draw'), async (turn: number) => {
		const myTurn = playersOrder().indexOf(name) === turn % playersOrder().length;
		const nextTurn = turn + 1;

		if (turn === playersOrder().length * 4) {
			draw4Defer.resolve(null);
			offDraw4.current?.();
		} else if (myTurn && !drawed[turn]) {
			drawed[turn] = true;

			const card = await draw();
			setHand([...hand(), card].sort((x, y) => cardToNumber(x) - cardToNumber(y)));
			roomGun.get('draw').put(nextTurn);
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
				roomGun
					.get('response')
					.get('card')
					.put('1|' + nanoid(4));
			} else {
				setZkStatus(ZKStatus.PROOF_GEN);
				const proof = await pickNoir.proof(hand(), card);
				setZkStatus(ZKStatus.READY);
				roomGun
					.get('response')
					.get('card')
					.put(`${proof}|${nanoid(4)}}`);
			}
		}
	});

	const offResponseCard = gunOn(roomGun.get('response').get('card'), async (data: string) => {
		if (!data || data === oldResponse) return;
		oldResponse = data;
		const [proofStr] = data.split('|');

		if (proofStr === '1') {
			requestCardDefer.current?.resolve(true);
		} else {
			setZkStatus(ZKStatus.PROOF_VERIFY);

			pickNoir
				.verify(proofStr)
				.then(() => {
					console.log('ok draw');
					setZkStatus(ZKStatus.READY);
					requestCardDefer.current?.resolve(false);
				})
				.catch(() => {
					setZkStatus(ZKStatus.PROOF_FAILED);
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
			.verify(proof)
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

	async function endTurn() {
		const nextTurn = turn() + 1;
		roomGun.get('turn').put(nextTurn);

		if (nextTurn < CARDS.length) {
			const newCard = await draw();
			addToHand(newCard);
			return newCard;
		}

		return -1;
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
			setZkStatus(ZKStatus.READY);

			setQuartets([...quartets(), quartet]);
			setHand(postHand);

			return [won, proof];
		}

		return [false];
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
			const [won, proof] = await handleQuartet();

			if (won) {
				roomGun.get('winner').put([name, proof, nanoid(4)].join('|'));
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

					roomGun.get('turn').put(playersOrder().length * 4, () => {
						roomGun.get('gameState').put(GameState.GAME_STARTED);
					});
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
				offDraw4.current?.();
				offRequestCard.current?.();
				offResponseCard.current?.();
				offWinner.current?.();

				roomGun.get('players').put(null);
				roomGun.get('turn').put(null);
				roomGun.get('gameState').put(null);
				roomGun.get('init').put({ prime: null, playerOrder: null });
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
