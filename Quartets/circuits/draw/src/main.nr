use dep::std::{println, hash};
use dep::modpow::{modPow};

fn main(encryptedCard: pub u16, keys: [u16; 8], prime: pub u16, oldHand: [Field; 32], newHash: pub Field) {
    let mut decrypted = encryptedCard;

    for i in 0..8 {
        let key = keys[i];
        
        if key != 0 {
            decrypted = modPow(decrypted, key, prime);
        }
    }

    let mut newHand = oldHand;
    let mut setted = false;

    for i in 0..32 {
        if !setted {
            if oldHand[i] == 0 {
                // + 1 because 0 is reserved for empty
                // -2 because we add 2 to each decrypted card
                newHand[i] = (decrypted - 1) as Field;
                setted = true;
            }
        }
    }

    let hash = hash::pedersen(newHand);

    assert(hash[0] == newHash);
}

#[test]
fn test_main() {
    let secret = 183; 
    let e = [113, 105,0, 0, 0, 0, 0, 0];
    let m = 233; 
    let expected = 13 + 1;
    
    let hand = [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let newHand = [3, 4, 1, 2, 5, 6, expected, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = hash::pedersen(newHand)[0];

    main(secret, e, m, hand, handHash);
}
 
#[test]
fn test_main_2() {
    let encryptedCard = 105;
    let keys = [131, 23, 0, 0, 0, 0, 0, 0];
    let newHash = 2390262085433883194659221372125686417043081357532654045931071843150164049082;
    let oldHand= [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // let newHand = [6+1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // let newHash = hash::pedersen(newHand)[0];
    let prime = 137;

    main(encryptedCard, keys, prime, oldHand, newHash);
}
 