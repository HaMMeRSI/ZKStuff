use dep::std;

fn main(hand: [Field; 32], handHash: pub Field, card: pub u8, cardsPerSymbol: pub u8) {
    let mut found = false;
    let hash = std::hash::pedersen(hand);
    // std::println(hash);


    assert(card > 0);
    assert(card < cardsPerSymbol * 4 + 1);
    assert(hash[0] == handHash);
    
    for i in 0..32 {
        let currCard = hand[i] as u8;
        
        if currCard == card {
            found = true;
        }
    }

    assert(!found);
}

#[test]
fn test_main() {
    let hand = [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = 0x12d303c7a9a41f0d3ed27a2c35ea734ef8ae6dcebd40c98df625e6b683c8499d;
    
    main(hand, handHash, 32, 13);
}
#[test]
fn test_main_3() {
    let hand = [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = 0x12d303c7a9a41f0d3ed27a2c35ea734ef8ae6dcebd40c98df625e6b683c8499d;
    
    main(hand, handHash, 7, 3);
}
