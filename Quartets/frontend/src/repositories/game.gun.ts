import { gun } from '@/gun';
import { Accessor, createSignal } from 'solid-js';

import { APP, ROOMS } from './tables.index';
import deckGun from './deck.gun';
import { shamir3pass } from 'shamir3pass';
import { defer, gunOn, padArray } from '@/utils';
import { IDeferedObject, INoirCircuits } from '@/utils/types';
import { CARDS } from '@/utils/cards';
import { nanoid } from 'nanoid';

export enum GameState {
	READY,
	GAME_STARTED,
	WON,
}

export enum ZKStatus {
	READY = 'ready',
	PROOF_GEN = 'generating proof',
	PROOF_WAIT = 'waiting for proof',
	PROOF_VERIFY = 'verifying proof',
	PROOF_FAILED = 'proof failed',
}

export interface IGameGun {
	gameId: string;
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
				players = [...data.split(',').filter(n => n !== name), name].join();
			}

			resolve(players);
		});
	});
}

function cardToNumber(card: number) {
	return card % (CARDS.length / 4);
}

async function gameGun(gameId: string, name: string, onLeave: VoidFunction, noirCircuits: Accessor<INoirCircuits>): Promise<IGameGun> {
	const { deck, init, off, draw, shuffle } = deckGun(gameId, name);

	const [zkStatus, setZkStatus] = createSignal(ZKStatus.READY);
	const [turn, setTurn] = createSignal(0);
	const [hand, setHand] = createSignal<number[]>([]);
	const [winner, setWinner] = createSignal<string>('');
	const [quartets, setQuartets] = createSignal<number[]>([]);
	const [gameState, setGameState] = createSignal(GameState.READY);
	const [playersOrder, setPlayersOrder] = createSignal<string[]>([]);

	const { pickNoir, quartetNoir, wonNoir, drawNoir } = noirCircuits();

	const gameGun = gun.get(APP).get(ROOMS).get(gameId);
	gameGun.get('players').put(await getPlayers(gameGun, name));

	const draw4Defer = defer();
	const drawed: Record<number, boolean> = {};
	const handHashes: Record<string, bigint> = {};

	let requestCardDefer: IDeferedObject<Boolean>;
	let oldRequest = '';
	let oldResponse = '';
	let oldWinner = '';
	let oldTurn = '';
	let oldDraw = '';
	let handHistory: number[] = [];
	let prime = 0n;

	const offPlayers = gunOn(gameGun.get('players'), (data: string) => setPlayersOrder(data.split(',') ?? []));

	const offState = gunOn(gameGun.get('gameState'), async (data: GameState | null) => {
		if (data === null) {
			leave();
		} else {
			setGameState(data);

			if (data === GameState.GAME_STARTED) {
				await publishHandHash();
			}
		}
	});

	const offHandHash = gunOn(gameGun.get('handHash'), (data: string) => {
		const [_name, _value] = data.split('|');
		handHashes[_name] = BigInt(_value);
	});

	const offTurn = gunOn(gameGun.get('turn'), async (data: string) => {
		if (!data || oldTurn === data) return;
		oldTurn = data;

		const [turn, encryptedCard, handHash, proof] = data.split('|');
		if (+turn > 0) {
			setZkStatus(ZKStatus.PROOF_VERIFY);
			await drawNoir.verify(proof, BigInt(handHash), BigInt(encryptedCard), prime).catch(_e => setZkStatus(ZKStatus.PROOF_FAILED));
			setZkStatus(ZKStatus.READY);
		}

		setTurn(+turn);
	});

	const offInit = gunOn(gameGun.get('init'), (data: any) => {
		if (!data.prime || !data.playerOrder) return;
		prime = BigInt('0x' + data.prime);

		setPlayersOrder(data.playerOrder.split(','));
		init(prime, data.playerOrder.split(','));
	});

	const offDrawInitial4 = gunOn(gameGun.get('draw'), async (data: string) => {
		if (!data || oldDraw === data) return;
		oldDraw = data;

		const [drawCount, encryptedCard, handHash, proof] = data.split('|');
		const myDrawTurn = playersOrder().indexOf(name) === +drawCount % playersOrder().length;

		if (+drawCount > 0) {
			setZkStatus(ZKStatus.PROOF_VERIFY);
			await drawNoir.verify(proof, BigInt(handHash), BigInt(encryptedCard), prime).catch(_e => setZkStatus(ZKStatus.PROOF_FAILED));
			setZkStatus(ZKStatus.READY);
		}

		if (+drawCount === playersOrder().length * 4) {
			draw4Defer.resolve(null);
			offDrawInitial4.current?.();
		} else if (myDrawTurn && !drawed[+drawCount]) {
			drawed[+drawCount] = true;
			setZkStatus(ZKStatus.PROOF_GEN);

			const { card, keys, encryptedCard } = await draw();
			const [handHash, drawProof] = await drawNoir
				.proof(
					card,
					encryptedCard,
					keys.map(x => x.decryption),
					keys[0].prime,
					handHistory
				)
				.catch(e => {
					setZkStatus(ZKStatus.PROOF_FAILED);
					throw e;
				});
			setZkStatus(ZKStatus.READY);

			handHistory = [...handHistory, card];
			addToHand(card);
			gameGun.get('draw').put(`${+drawCount + 1}|${encryptedCard}|${handHash}|${drawProof}`);
		}
	});

	const offRequestCard = gunOn(gameGun.get('request').get('card'), async (data: string) => {
		if (!data || data === oldRequest) return;
		oldRequest = data;

		const [from, reqCard] = data.split('|');
		const card = +reqCard;

		if (name === from) {
			const includes = hand().includes(card);

			if (includes) {
				setHand(hand().filter(val => val !== card));
				await publishHandHash();
				gameGun.get('response').put(`${from}|1|${nanoid(4)}`);
			} else {
				setZkStatus(ZKStatus.PROOF_GEN);
				const proof = await pickNoir.proof(hand(), card);
				setZkStatus(ZKStatus.READY);
				gameGun.get('response').put(`${from}|${proof}|${nanoid(4)}}`);
			}
		}
	});

	const offResponseCard = gunOn(gameGun.get('response'), async (data: string) => {
		if (!data || data === oldResponse) return;
		oldResponse = data;

		const [from, proofStr] = data.split('|');

		if (proofStr === '1') {
			requestCardDefer?.resolve(true);
		} else {
			setZkStatus(ZKStatus.PROOF_VERIFY);

			pickNoir
				.verify(proofStr, handHashes[from])
				.then(() => {
					setZkStatus(ZKStatus.READY);
					requestCardDefer?.resolve(false);
				})
				.catch(e => {
					setZkStatus(ZKStatus.PROOF_FAILED);
					console.error(e);

					console.log('CHEATER DRAW!!!!');
				});
		}
	});

	const offWinner = gunOn(gameGun.get('winner'), async (data: string) => {
		if (!data || oldWinner === data) return;
		oldWinner = data;

		const [winner, proof] = data.split('|');
		setZkStatus(ZKStatus.PROOF_VERIFY);

		await wonNoir
			.verify(proof, handHashes[winner])
			.then(() => {
				console.log('ok won');
				setZkStatus(ZKStatus.READY);
				gameGun.get('gameState').put(GameState.WON);
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

		if (nextTurn < CARDS.length) {
			setZkStatus(ZKStatus.PROOF_GEN);

			const { card, keys, encryptedCard } = await draw();
			const [handHash, drawProof] = await drawNoir
				.proof(
					card,
					encryptedCard,
					keys.map(x => x.decryption),
					keys[0].prime,
					handHistory
				)
				.catch(e => {
					setZkStatus(ZKStatus.PROOF_FAILED);
					throw e;
				});

			setZkStatus(ZKStatus.READY);

			addToHand(card);
			handHistory = [...handHistory, card];
			gameGun.get('turn').put(`${nextTurn}|${encryptedCard}|${handHash}|${drawProof}`);

			return card;
		}

		gameGun.get('turn').put(nextTurn.toString());
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
			gameGun.get('handHash').put(`${name}|${hash}`, _ => resolve(null));
		});
	}

	function leave() {
		gameGun.get('gameState').put(null);
		offPlayers.current?.();
		offTurn.current?.();
		offState.current?.();
		offInit.current?.();
		offDrawInitial4.current?.();
		offRequestCard.current?.();
		offResponseCard.current?.();
		offWinner.current?.();
		offHandHash.current?.();

		gameGun.get('players').put(null);
		gameGun.get('turn').put(null);
		gameGun.get('init').put({ prime: null, playerOrder: null });

		pickNoir.noir.destroy();
		quartetNoir.noir.destroy();
		wonNoir.noir.destroy();

		off();
		onLeave();
	}

	return {
		deck,
		zkStatus,
		hand,
		quartets,
		turn,
		winner,
		gameId,
		playersOrder,
		gameState,
		draw: endTurn,
		leave,
		async request(from: string, card: number) {
			if (!from || card < 0) return false;

			requestCardDefer = defer<Boolean>();
			gameGun
				.get('request')
				.get('card')
				.put(`${from}|${card}|${nanoid(4)}`);

			setZkStatus(ZKStatus.PROOF_WAIT);
			const res = await requestCardDefer;
			setZkStatus(ZKStatus.READY);

			res ? addToHand(card) : await endTurn();
			await publishHandHash();

			const [won, proof] = await handleQuartet();
			if (won) {
				gameGun.get('winner').put([name, proof, nanoid(4)].join('|'));
			} else {
				// TODO: handle quartet proof publish
				await publishHandHash();
			}

			return res;
		},
		start() {
			const { randomNBitPrime } = shamir3pass();
			const excluded = playersOrder().filter(val => val !== name);

			const playerOrder = [name, ...excluded].join();

			gameGun.get('init').put({ prime: randomNBitPrime(8).toString(16), playerOrder }, async _ => {
				await shuffle();
				gameGun.get('draw').put('0');
				await draw4Defer;
				gameGun.get('gameState').put(GameState.GAME_STARTED);
			});
		},
	};
}

export default function (roomId: string, name: string, onLeave: VoidFunction, noirCircuits: Accessor<INoirCircuits>) {
	let room: ReturnType<typeof gameGun> | null = null;

	if (!room) {
		room = gameGun(roomId, name, onLeave, noirCircuits);
	}

	return room;
}
