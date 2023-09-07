import { shamir3pass, Key } from 'shamir3pass';

const PrimeBitLength = 8;

const encryption = shamir3pass();
const deck = Array.from(new Array(52), (_, i) => BigInt(i));

function eachLock(deck: BigInt[], prime: BigInt) {
    const { encrypt, generateKeyFromPrime } = shamir3pass();
    const keys: Key[] = [];
    const encrypted: BigInt[] = [];

    deck.forEach(card => {
        const key = generateKeyFromPrime(prime);
        keys.push(key);
        encrypted.push(encrypt(card, key));
    });

    return { keys, encrypted };
}

function mentalPoker() {
    const prime = encryption.randomNBitPrime(PrimeBitLength);
    const [aliceKey, bobKey] = [encryption.generateKeyFromPrime(prime), encryption.generateKeyFromPrime(prime)];

    const alice_toBob = deck.sort(() => Math.random() - 0.5).map(card => encryption.encrypt(card, aliceKey));
    const bob_toAlice = alice_toBob.map(card => encryption.encrypt(card, bobKey));

    const alice_decryptHers = bob_toAlice.sort(() => Math.random() - 0.5).map(card => encryption.decrypt(card, aliceKey));
    const { keys: aliceKeys, encrypted: alice_secretDeck } = eachLock(alice_decryptHers, prime);

    const bob_decryptHis = alice_secretDeck.map(card => encryption.decrypt(card, bobKey));
    const { keys: bobKeys, encrypted: bob_secretDeck } = eachLock(bob_decryptHis, prime);

    const final = bob_secretDeck.map((card, i) => {
        const bobDecrypted = encryption.decrypt(card, bobKeys[i]);
        const aliceDecrypted = encryption.decrypt(bobDecrypted, aliceKeys[i]);
        return aliceDecrypted;
    });

    return final;
}

console.log(mentalPoker());
